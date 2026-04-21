import { Pool, neonConfig } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";
import ws from "ws";

// Neon `Pool` + `connect()` use WebSockets. Node's built-in `WebSocket` (when
// present) is not reliable for the driver's protocol — use the `ws` package.
neonConfig.webSocketConstructor = ws;

let pool: Pool | null = null;
let ready: Promise<void> | null = null;

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) {
    throw new Error(
      "DATABASE_URL is not set. Add your Neon connection string (postgresql://…).",
    );
  }
  return url;
}

function splitSqlStatements(sql: string): string[] {
  const noComments = sql.replace(/--[^\n]*/g, "");
  return noComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function applySchema(p: Pool): Promise<void> {
  const schemaPath = path.join(process.cwd(), "src", "db", "schema.pg.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  for (const stmt of splitSqlStatements(sql)) {
    await p.query(stmt);
  }
}

/**
 * Neon connection pool. Call `await ensureDb()` before first query in a process.
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: getConnectionString() });
  }
  return pool;
}

/**
 * Ensures the pool exists and base schema has been applied (idempotent).
 */
export function ensureDb(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const p = getPool();
      await applySchema(p);
    })();
  }
  return ready;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    ready = null;
  }
}
