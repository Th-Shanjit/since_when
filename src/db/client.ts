import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// Singleton DB handle shared across the Next.js web process and the worker.
// SQLite WAL mode lets both processes open the same file safely.

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "sincewhen.db");

let _db: Database.Database | null = null;

function ensureDir(filepath: string) {
  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function applySchema(db: Database.Database) {
  const schemaPath = path.join(process.cwd(), "src", "db", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  db.exec(sql);
}

// Additive migrations for DBs created before the scope/yearly work.
// ALTER TABLE ... ADD COLUMN is not idempotent in SQLite, so we peek at
// pragma table_info first.
function migrate(db: Database.Database) {
  const hasTable = (table: string): boolean => {
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(table) as { name?: string } | undefined;
    return !!row?.name;
  };

  const hasColumn = (table: string, col: string): boolean => {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
      name: string;
    }>;
    return rows.some((r) => r.name === col);
  };

  if (hasTable("counters") && !hasColumn("counters", "scope")) {
    db.exec(`ALTER TABLE counters ADD COLUMN scope TEXT`);
  }
  if (hasTable("counters") && !hasColumn("counters", "counter_def_id")) {
    db.exec(`ALTER TABLE counters ADD COLUMN counter_def_id TEXT`);
  }
  if (hasTable("events_log") && !hasColumn("events_log", "scope")) {
    db.exec(`ALTER TABLE events_log ADD COLUMN scope TEXT`);
  }
  if (hasTable("pending_events") && !hasColumn("pending_events", "scope")) {
    db.exec(`ALTER TABLE pending_events ADD COLUMN scope TEXT`);
  }
}

export function getDb(): Database.Database {
  if (_db) return _db;
  ensureDir(DB_PATH);
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  applySchema(_db);
  return _db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
