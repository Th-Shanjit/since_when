import { ensureDb, getPool } from "./client";

/** Pool or transaction client — anything that can run parameterized SQL. */
export type Sql = {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: unknown[]; rowCount?: number | null }>;
};

// ---------- types ----------

export type CounterKind = "auto" | "queue" | "special" | "yearly";

export type CounterRow = {
  id: string;
  counter_def_id: string | null;
  scope: string | null;
  title: string;
  subtitle: string | null;
  kind: CounterKind;
  first_event_at: string | null;
  last_event_at: string | null;
  last_event_label: string | null;
  last_event_source: string | null;
  previous_value_json: string | null;
  baseline_json: string | null;
  status: "live" | "frozen";
  consecutive_failures: number;
  updated_at: string;
};

export type EventRow = {
  id: number;
  counter_id: string;
  scope: string | null;
  event_time: string;
  label: string;
  sources: string;
  fingerprint: string;
  created_at: string;
};

export type PendingEventRow = {
  id: number;
  counter_id: string;
  scope: string | null;
  candidate_event_time: string;
  label: string;
  sources: string;
  fingerprint: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  approved_by: string | null;
  decided_at: string | null;
};

export type AlertSubscriptionRow = {
  id: number;
  email: string;
  counter_id: string;
  confirm_token: string;
  confirmed_at: string | null;
  unsub_token: string;
  created_at: string;
};

function pgUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string };
  return e.code === "23505";
}

// ---------- counters ----------

export async function listCounters(): Promise<CounterRow[]> {
  await ensureDb();
  const r = await getPool().query(
    "SELECT * FROM counters ORDER BY id",
  );
  return r.rows as CounterRow[];
}

export async function getCounter(
  id: string,
  db?: Sql,
): Promise<CounterRow | undefined> {
  await ensureDb();
  const sql = db ?? getPool();
  const r = await sql.query("SELECT * FROM counters WHERE id = $1", [id]);
  return (r.rows[0] as CounterRow | undefined) ?? undefined;
}

export async function listCountersByDef(defId: string): Promise<CounterRow[]> {
  await ensureDb();
  const r = await getPool().query(
    `SELECT * FROM counters
      WHERE counter_def_id = $1 OR id = $2
      ORDER BY (scope IS NULL) DESC, scope ASC`,
    [defId, defId],
  );
  return r.rows as CounterRow[];
}

export async function upsertCounter(c: {
  id: string;
  counter_def_id: string | null;
  scope: string | null;
  title: string;
  subtitle?: string | null;
  kind: CounterKind;
  first_event_at?: string | null;
  last_event_at?: string | null;
  last_event_label?: string | null;
  last_event_source?: string | null;
  previous_value_json?: string | null;
  baseline_json?: string | null;
  status?: "live" | "frozen";
  consecutive_failures?: number;
}): Promise<void> {
  await ensureDb();
  const now = new Date().toISOString();
  await getPool().query(
    `INSERT INTO counters
       (id, counter_def_id, scope, title, subtitle, kind,
        first_event_at, last_event_at, last_event_label,
        last_event_source, previous_value_json, baseline_json, status,
        consecutive_failures, updated_at)
     VALUES
       ($1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (id) DO UPDATE SET
       counter_def_id = EXCLUDED.counter_def_id,
       scope = EXCLUDED.scope,
       title = EXCLUDED.title,
       subtitle = EXCLUDED.subtitle,
       kind = EXCLUDED.kind,
       updated_at = EXCLUDED.updated_at`,
    [
      c.id,
      c.counter_def_id,
      c.scope,
      c.title,
      c.subtitle ?? null,
      c.kind,
      c.first_event_at ?? null,
      c.last_event_at ?? null,
      c.last_event_label ?? null,
      c.last_event_source ?? null,
      c.previous_value_json ?? null,
      c.baseline_json ?? null,
      c.status ?? "live",
      c.consecutive_failures ?? 0,
      now,
    ],
  );
}

export async function updateCounterOnReset(p: {
  id: string;
  event_time: string;
  label: string;
  source: string;
}): Promise<void> {
  await ensureDb();
  const now = new Date().toISOString();
  await getPool().query(
    `UPDATE counters
       SET last_event_at = $1,
           last_event_label = $2,
           last_event_source = $3,
           status = 'live',
           consecutive_failures = 0,
           updated_at = $4
     WHERE id = $5`,
    [p.event_time, p.label, p.source, now, p.id],
  );
}

export async function setCounterPrevValue(id: string, json: string): Promise<void> {
  await ensureDb();
  await getPool().query(
    `UPDATE counters SET previous_value_json = $1, updated_at = $2 WHERE id = $3`,
    [json, new Date().toISOString(), id],
  );
}

export async function setCounterBaseline(id: string, json: string): Promise<void> {
  await ensureDb();
  await getPool().query(
    `UPDATE counters SET baseline_json = $1, updated_at = $2 WHERE id = $3`,
    [json, new Date().toISOString(), id],
  );
}

export async function markFetchFailure(id: string): Promise<void> {
  const row = await getCounter(id);
  if (!row) return;
  const next = row.consecutive_failures + 1;
  const status: "live" | "frozen" = next >= 3 ? "frozen" : row.status;
  await ensureDb();
  await getPool().query(
    `UPDATE counters
       SET consecutive_failures = $1, status = $2, updated_at = $3
     WHERE id = $4`,
    [next, status, new Date().toISOString(), id],
  );
}

export async function markFetchSuccess(id: string): Promise<void> {
  await ensureDb();
  await getPool().query(
    `UPDATE counters
       SET consecutive_failures = 0, status = 'live', updated_at = $1
     WHERE id = $2`,
    [new Date().toISOString(), id],
  );
}

// ---------- events ----------

export async function insertEvent(
  e: {
    counter_id: string;
    scope: string | null;
    event_time: string;
    label: string;
    sources: string[];
    fingerprint: string;
  },
  db?: Sql,
): Promise<void> {
  await ensureDb();
  const sql = db ?? getPool();
  const now = new Date().toISOString();
  await sql.query(
    `INSERT INTO events_log
       (counter_id, scope, event_time, label, sources, fingerprint, created_at)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7)`,
    [
      e.counter_id,
      e.scope,
      e.event_time,
      e.label,
      JSON.stringify(e.sources),
      e.fingerprint,
      now,
    ],
  );
}

export async function eventFingerprintExists(
  fp: string,
  db?: Sql,
): Promise<boolean> {
  await ensureDb();
  const sql = db ?? getPool();
  const r = await sql.query(
    "SELECT 1 AS x FROM events_log WHERE fingerprint = $1 LIMIT 1",
    [fp],
  );
  return r.rows.length > 0;
}

export async function listEventsForCounter(
  counterId: string,
  limit = 100,
): Promise<EventRow[]> {
  await ensureDb();
  const r = await getPool().query(
    `SELECT * FROM events_log
      WHERE counter_id = $1
      ORDER BY event_time DESC
      LIMIT $2`,
    [counterId, limit],
  );
  return r.rows as EventRow[];
}

export async function listRecentEvents(limit = 30): Promise<EventRow[]> {
  await ensureDb();
  const r = await getPool().query(
    `SELECT * FROM events_log ORDER BY event_time DESC LIMIT $1`,
    [limit],
  );
  return r.rows as EventRow[];
}

export async function countEventsSince(
  counterId: string,
  sinceIso: string,
  db?: Sql,
): Promise<number> {
  await ensureDb();
  const sql = db ?? getPool();
  const r = await sql.query(
    `SELECT COUNT(*)::int AS n FROM events_log
      WHERE counter_id = $1 AND event_time >= $2`,
    [counterId, sinceIso],
  );
  const row = r.rows[0] as { n: number } | undefined;
  return row?.n ?? 0;
}

// ---------- pending events ----------

export async function insertPendingEvent(p: {
  counter_id: string;
  scope: string | null;
  candidate_event_time: string;
  label: string;
  sources: string[];
  fingerprint: string;
}): Promise<void> {
  await ensureDb();
  const now = new Date().toISOString();
  try {
    await getPool().query(
      `INSERT INTO pending_events
         (counter_id, scope, candidate_event_time, label, sources, fingerprint,
          status, created_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, 'pending', $7)`,
      [
        p.counter_id,
        p.scope,
        p.candidate_event_time,
        p.label,
        JSON.stringify(p.sources),
        p.fingerprint,
        now,
      ],
    );
  } catch (err: unknown) {
    if (!pgUniqueViolation(err)) throw err;
  }
}

export async function pendingFingerprintExists(fp: string): Promise<boolean> {
  await ensureDb();
  const r = await getPool().query(
    "SELECT 1 AS x FROM pending_events WHERE fingerprint = $1 LIMIT 1",
    [fp],
  );
  return r.rows.length > 0;
}

export async function listPending(limit = 50): Promise<PendingEventRow[]> {
  await ensureDb();
  const r = await getPool().query(
    `SELECT * FROM pending_events
      WHERE status = 'pending'
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit],
  );
  return r.rows as PendingEventRow[];
}

export async function getPending(id: number): Promise<PendingEventRow | undefined> {
  await ensureDb();
  const r = await getPool().query(
    "SELECT * FROM pending_events WHERE id = $1",
    [id],
  );
  return (r.rows[0] as PendingEventRow | undefined) ?? undefined;
}

export async function decidePending(
  id: number,
  status: "approved" | "rejected",
  by: string,
  db?: Sql,
): Promise<void> {
  await ensureDb();
  const sql = db ?? getPool();
  await sql.query(
    `UPDATE pending_events
       SET status = $1, approved_by = $2, decided_at = $3
     WHERE id = $4`,
    [status, by, new Date().toISOString(), id],
  );
}

// ---------- fetch log ----------

export async function logFetch(p: {
  counter_id: string;
  started_at: string;
  ok: boolean;
  error?: string | null;
  duration_ms: number;
}): Promise<void> {
  await ensureDb();
  await getPool().query(
    `INSERT INTO fetch_log
       (counter_id, started_at, ok, error, duration_ms)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      p.counter_id,
      p.started_at,
      p.ok ? 1 : 0,
      p.error ?? null,
      p.duration_ms,
    ],
  );
}

export async function recentFetchHealth(hours = 1): Promise<
  Array<{
    counter_id: string;
    ok_count: number;
    fail_count: number;
    last_started_at: string;
  }>
> {
  await ensureDb();
  const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const r = await getPool().query(
    `SELECT
       counter_id,
       COALESCE(SUM(ok), 0)::int AS ok_count,
       COALESCE(SUM(1 - ok), 0)::int AS fail_count,
       MAX(started_at) AS last_started_at
     FROM fetch_log
     WHERE started_at >= $1
     GROUP BY counter_id
     ORDER BY counter_id`,
    [cutoff],
  );
  return r.rows as Array<{
    counter_id: string;
    ok_count: number;
    fail_count: number;
    last_started_at: string;
  }>;
}

// ---------- admin settings ----------

export async function getAdminSetting(key: string): Promise<string | null> {
  await ensureDb();
  const r = await getPool().query(
    "SELECT value FROM admin_settings WHERE key = $1",
    [key],
  );
  const row = r.rows[0] as { value: string } | undefined;
  return row?.value ?? null;
}

export async function setAdminSetting(key: string, value: string | null): Promise<void> {
  await ensureDb();
  if (value == null) {
    await getPool().query("DELETE FROM admin_settings WHERE key = $1", [key]);
    return;
  }
  await getPool().query(
    `INSERT INTO admin_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value],
  );
}

// ---------- alert subscriptions ----------

export async function insertAlertSubscription(p: {
  email: string;
  counter_id: string;
  confirm_token: string;
  unsub_token: string;
}): Promise<{ inserted: boolean; row: AlertSubscriptionRow | null }> {
  await ensureDb();
  const now = new Date().toISOString();
  try {
    await getPool().query(
      `INSERT INTO alert_subscriptions
         (email, counter_id, confirm_token, unsub_token, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [p.email, p.counter_id, p.confirm_token, p.unsub_token, now],
    );
    const r = await getPool().query(
      "SELECT * FROM alert_subscriptions WHERE email = $1 AND counter_id = $2",
      [p.email, p.counter_id],
    );
    const row = r.rows[0] as AlertSubscriptionRow | undefined;
    return { inserted: true, row: row ?? null };
  } catch (err: unknown) {
    if (!pgUniqueViolation(err)) throw err;
    const r = await getPool().query(
      "SELECT * FROM alert_subscriptions WHERE email = $1 AND counter_id = $2",
      [p.email, p.counter_id],
    );
    const row = r.rows[0] as AlertSubscriptionRow | undefined;
    return { inserted: false, row: row ?? null };
  }
}

export async function getSubscriptionByConfirm(
  token: string,
): Promise<AlertSubscriptionRow | undefined> {
  await ensureDb();
  const r = await getPool().query(
    "SELECT * FROM alert_subscriptions WHERE confirm_token = $1",
    [token],
  );
  return (r.rows[0] as AlertSubscriptionRow | undefined) ?? undefined;
}

export async function getSubscriptionByUnsub(
  token: string,
): Promise<AlertSubscriptionRow | undefined> {
  await ensureDb();
  const r = await getPool().query(
    "SELECT * FROM alert_subscriptions WHERE unsub_token = $1",
    [token],
  );
  return (r.rows[0] as AlertSubscriptionRow | undefined) ?? undefined;
}

export async function confirmSubscription(id: number): Promise<void> {
  await ensureDb();
  await getPool().query(
    "UPDATE alert_subscriptions SET confirmed_at = $1 WHERE id = $2",
    [new Date().toISOString(), id],
  );
}

export async function deleteSubscription(id: number): Promise<void> {
  await ensureDb();
  await getPool().query("DELETE FROM alert_subscriptions WHERE id = $1", [id]);
}

export async function listConfirmedSubscribers(
  counterId: string,
): Promise<AlertSubscriptionRow[]> {
  await ensureDb();
  const r = await getPool().query(
    `SELECT * FROM alert_subscriptions
      WHERE counter_id = $1 AND confirmed_at IS NOT NULL`,
    [counterId],
  );
  return r.rows as AlertSubscriptionRow[];
}

// ---------- transaction helper ----------

export async function tx<T>(fn: (db: Sql) => Promise<T>): Promise<T> {
  await ensureDb();
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function updateCounterOnResetWithClient(
  db: Sql,
  p: { id: string; event_time: string; label: string; source: string },
): Promise<void> {
  const now = new Date().toISOString();
  await db.query(
    `UPDATE counters
       SET last_event_at = $1,
           last_event_label = $2,
           last_event_source = $3,
           status = 'live',
           consecutive_failures = 0,
           updated_at = $4
     WHERE id = $5`,
    [p.event_time, p.label, p.source, now, p.id],
  );
}

export async function setCounterPrevValueWithClient(
  db: Sql,
  id: string,
  json: string,
): Promise<void> {
  await db.query(
    `UPDATE counters SET previous_value_json = $1, updated_at = $2 WHERE id = $3`,
    [json, new Date().toISOString(), id],
  );
}
