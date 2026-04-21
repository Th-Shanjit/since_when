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
  // #region agent log
  try {
    console.error(
      "SINCEWHEN_DEBUG",
      JSON.stringify({
        hypothesisId: "H1_H2",
        location: "src/db/client.ts:getDb_enter",
        dbPath: DB_PATH,
        cwd: process.cwd(),
        vercel: !!process.env.VERCEL,
        nodeVersion: process.version,
      }),
    );
    fetch(
      "http://127.0.0.1:7501/ingest/5c255479-366d-4a87-a893-97d7a50d094a",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "746cbe",
        },
        body: JSON.stringify({
          sessionId: "746cbe",
          hypothesisId: "H1_H2",
          location: "src/db/client.ts:getDb_enter",
          message: "getDb_enter",
          data: { dbPath: DB_PATH, cwd: process.cwd(), vercel: !!process.env.VERCEL },
          timestamp: Date.now(),
        }),
      },
    ).catch(() => {});
  } catch {}
  // #endregion
  try {
    ensureDir(DB_PATH);
  } catch (err) {
    console.error(
      "SINCEWHEN_DEBUG",
      JSON.stringify({
        hypothesisId: "H2",
        location: "src/db/client.ts:ensureDir_failed",
        dbPath: DB_PATH,
        error: err instanceof Error ? err.message : String(err),
        code: (err as NodeJS.ErrnoException)?.code,
      }),
    );
    throw err;
  }
  try {
    _db = new Database(DB_PATH);
  } catch (err) {
    console.error(
      "SINCEWHEN_DEBUG",
      JSON.stringify({
        hypothesisId: "H1",
        location: "src/db/client.ts:new_Database_failed",
        dbPath: DB_PATH,
        error: err instanceof Error ? err.message : String(err),
        code: (err as NodeJS.ErrnoException)?.code,
      }),
    );
    throw err;
  }
  try {
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    migrate(_db);
    applySchema(_db);
  } catch (err) {
    console.error(
      "SINCEWHEN_DEBUG",
      JSON.stringify({
        hypothesisId: "H4",
        location: "src/db/client.ts:schema_failed",
        error: err instanceof Error ? err.message : String(err),
        code: (err as NodeJS.ErrnoException)?.code,
      }),
    );
    throw err;
  }
  return _db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
