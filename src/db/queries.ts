import { getDb } from "./client";

// All counter rows are identified by a composite "scoped id": the def id
// ("aqi") when the counter isn't scoped, or "<defId>#<scope>" when it is
// (e.g. "aqi#Delhi"). The `counter_def_id` and `scope` columns are
// denormalised copies of those two pieces so range queries stay trivial.

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
  sources: string; // JSON array string
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

// ---------- counters ----------

export function listCounters(): CounterRow[] {
  return getDb().prepare("SELECT * FROM counters ORDER BY id").all() as CounterRow[];
}

export function getCounter(id: string): CounterRow | undefined {
  return getDb().prepare("SELECT * FROM counters WHERE id = ?").get(id) as
    | CounterRow
    | undefined;
}

export function listCountersByDef(defId: string): CounterRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM counters
        WHERE counter_def_id = ? OR id = ?
        ORDER BY scope IS NULL DESC, scope ASC`,
    )
    .all(defId, defId) as CounterRow[];
}

export function upsertCounter(c: {
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
}) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO counters
         (id, counter_def_id, scope, title, subtitle, kind,
          first_event_at, last_event_at, last_event_label,
          last_event_source, previous_value_json, baseline_json, status,
          consecutive_failures, updated_at)
       VALUES
         (@id, @counter_def_id, @scope, @title, @subtitle, @kind,
          @first_event_at, @last_event_at,
          @last_event_label, @last_event_source, @previous_value_json,
          @baseline_json, @status, @consecutive_failures, @updated_at)
       ON CONFLICT(id) DO UPDATE SET
         counter_def_id = excluded.counter_def_id,
         scope = excluded.scope,
         title = excluded.title,
         subtitle = excluded.subtitle,
         kind = excluded.kind,
         updated_at = excluded.updated_at`,
    )
    .run({
      id: c.id,
      counter_def_id: c.counter_def_id,
      scope: c.scope,
      title: c.title,
      subtitle: c.subtitle ?? null,
      kind: c.kind,
      first_event_at: c.first_event_at ?? null,
      last_event_at: c.last_event_at ?? null,
      last_event_label: c.last_event_label ?? null,
      last_event_source: c.last_event_source ?? null,
      previous_value_json: c.previous_value_json ?? null,
      baseline_json: c.baseline_json ?? null,
      status: c.status ?? "live",
      consecutive_failures: c.consecutive_failures ?? 0,
      updated_at: now,
    });
}

export function updateCounterOnReset(p: {
  id: string;
  event_time: string;
  label: string;
  source: string;
}) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE counters
         SET last_event_at = @event_time,
             last_event_label = @label,
             last_event_source = @source,
             status = 'live',
             consecutive_failures = 0,
             updated_at = @updated_at
       WHERE id = @id`,
    )
    .run({ ...p, updated_at: now });
}

export function setCounterPrevValue(id: string, json: string) {
  getDb()
    .prepare(
      `UPDATE counters SET previous_value_json = ?, updated_at = ? WHERE id = ?`,
    )
    .run(json, new Date().toISOString(), id);
}

export function setCounterBaseline(id: string, json: string) {
  getDb()
    .prepare(`UPDATE counters SET baseline_json = ?, updated_at = ? WHERE id = ?`)
    .run(json, new Date().toISOString(), id);
}

export function markFetchFailure(id: string) {
  const row = getCounter(id);
  if (!row) return;
  const next = row.consecutive_failures + 1;
  const status: "live" | "frozen" = next >= 3 ? "frozen" : row.status;
  getDb()
    .prepare(
      `UPDATE counters
         SET consecutive_failures = ?, status = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(next, status, new Date().toISOString(), id);
}

export function markFetchSuccess(id: string) {
  getDb()
    .prepare(
      `UPDATE counters
         SET consecutive_failures = 0, status = 'live', updated_at = ?
       WHERE id = ?`,
    )
    .run(new Date().toISOString(), id);
}

// ---------- events ----------

export function insertEvent(e: {
  counter_id: string;
  scope: string | null;
  event_time: string;
  label: string;
  sources: string[];
  fingerprint: string;
}) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO events_log
         (counter_id, scope, event_time, label, sources, fingerprint, created_at)
       VALUES
         (@counter_id, @scope, @event_time, @label, @sources, @fingerprint, @created_at)`,
    )
    .run({
      counter_id: e.counter_id,
      scope: e.scope,
      event_time: e.event_time,
      label: e.label,
      sources: JSON.stringify(e.sources),
      fingerprint: e.fingerprint,
      created_at: now,
    });
}

export function eventFingerprintExists(fp: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM events_log WHERE fingerprint = ?")
    .get(fp);
  return !!row;
}

export function listEventsForCounter(counterId: string, limit = 100): EventRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM events_log
        WHERE counter_id = ?
        ORDER BY event_time DESC
        LIMIT ?`,
    )
    .all(counterId, limit) as EventRow[];
}

export function listRecentEvents(limit = 30): EventRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM events_log ORDER BY event_time DESC LIMIT ?`,
    )
    .all(limit) as EventRow[];
}

export function countEventsSince(counterId: string, sinceIso: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM events_log
        WHERE counter_id = ? AND event_time >= ?`,
    )
    .get(counterId, sinceIso) as { n: number };
  return row?.n ?? 0;
}

// ---------- pending events ----------

export function insertPendingEvent(p: {
  counter_id: string;
  scope: string | null;
  candidate_event_time: string;
  label: string;
  sources: string[];
  fingerprint: string;
}) {
  const now = new Date().toISOString();
  try {
    getDb()
      .prepare(
        `INSERT INTO pending_events
           (counter_id, scope, candidate_event_time, label, sources, fingerprint,
            status, created_at)
         VALUES
           (@counter_id, @scope, @candidate_event_time, @label, @sources, @fingerprint,
            'pending', @created_at)`,
      )
      .run({
        counter_id: p.counter_id,
        scope: p.scope,
        candidate_event_time: p.candidate_event_time,
        label: p.label,
        sources: JSON.stringify(p.sources),
        fingerprint: p.fingerprint,
        created_at: now,
      });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code !== "SQLITE_CONSTRAINT_UNIQUE") throw err;
  }
}

export function pendingFingerprintExists(fp: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM pending_events WHERE fingerprint = ?")
    .get(fp);
  return !!row;
}

export function listPending(limit = 50): PendingEventRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM pending_events
        WHERE status = 'pending'
        ORDER BY created_at DESC
        LIMIT ?`,
    )
    .all(limit) as PendingEventRow[];
}

export function getPending(id: number): PendingEventRow | undefined {
  return getDb()
    .prepare("SELECT * FROM pending_events WHERE id = ?")
    .get(id) as PendingEventRow | undefined;
}

export function decidePending(id: number, status: "approved" | "rejected", by: string) {
  getDb()
    .prepare(
      `UPDATE pending_events
         SET status = ?, approved_by = ?, decided_at = ?
       WHERE id = ?`,
    )
    .run(status, by, new Date().toISOString(), id);
}

// ---------- fetch log ----------

export function logFetch(p: {
  counter_id: string;
  started_at: string;
  ok: boolean;
  error?: string | null;
  duration_ms: number;
}) {
  getDb()
    .prepare(
      `INSERT INTO fetch_log
         (counter_id, started_at, ok, error, duration_ms)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      p.counter_id,
      p.started_at,
      p.ok ? 1 : 0,
      p.error ?? null,
      p.duration_ms,
    );
}

export function recentFetchHealth(hours = 1): Array<{
  counter_id: string;
  ok_count: number;
  fail_count: number;
  last_started_at: string;
}> {
  return getDb()
    .prepare(
      `SELECT
         counter_id,
         SUM(ok) AS ok_count,
         SUM(1 - ok) AS fail_count,
         MAX(started_at) AS last_started_at
       FROM fetch_log
       WHERE started_at >= datetime('now', ?)
       GROUP BY counter_id
       ORDER BY counter_id`,
    )
    .all(`-${hours} hours`) as Array<{
    counter_id: string;
    ok_count: number;
    fail_count: number;
    last_started_at: string;
  }>;
}

// ---------- admin settings ----------

export function getAdminSetting(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM admin_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setAdminSetting(key: string, value: string | null) {
  if (value == null) {
    getDb().prepare("DELETE FROM admin_settings WHERE key = ?").run(key);
    return;
  }
  getDb()
    .prepare(
      `INSERT INTO admin_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, value);
}

// ---------- alert subscriptions ----------

export function insertAlertSubscription(p: {
  email: string;
  counter_id: string;
  confirm_token: string;
  unsub_token: string;
}): { inserted: boolean; row: AlertSubscriptionRow | null } {
  const now = new Date().toISOString();
  try {
    getDb()
      .prepare(
        `INSERT INTO alert_subscriptions
           (email, counter_id, confirm_token, unsub_token, created_at)
         VALUES (@email, @counter_id, @confirm_token, @unsub_token, @created_at)`,
      )
      .run({ ...p, created_at: now });
    const row = getDb()
      .prepare(
        "SELECT * FROM alert_subscriptions WHERE email = ? AND counter_id = ?",
      )
      .get(p.email, p.counter_id) as AlertSubscriptionRow | undefined;
    return { inserted: true, row: row ?? null };
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "SQLITE_CONSTRAINT_UNIQUE") {
      const row = getDb()
        .prepare(
          "SELECT * FROM alert_subscriptions WHERE email = ? AND counter_id = ?",
        )
        .get(p.email, p.counter_id) as AlertSubscriptionRow | undefined;
      return { inserted: false, row: row ?? null };
    }
    throw err;
  }
}

export function getSubscriptionByConfirm(token: string): AlertSubscriptionRow | undefined {
  return getDb()
    .prepare("SELECT * FROM alert_subscriptions WHERE confirm_token = ?")
    .get(token) as AlertSubscriptionRow | undefined;
}

export function getSubscriptionByUnsub(token: string): AlertSubscriptionRow | undefined {
  return getDb()
    .prepare("SELECT * FROM alert_subscriptions WHERE unsub_token = ?")
    .get(token) as AlertSubscriptionRow | undefined;
}

export function confirmSubscription(id: number) {
  getDb()
    .prepare("UPDATE alert_subscriptions SET confirmed_at = ? WHERE id = ?")
    .run(new Date().toISOString(), id);
}

export function deleteSubscription(id: number) {
  getDb().prepare("DELETE FROM alert_subscriptions WHERE id = ?").run(id);
}

export function listConfirmedSubscribers(counterId: string): AlertSubscriptionRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM alert_subscriptions
        WHERE counter_id = ? AND confirmed_at IS NOT NULL`,
    )
    .all(counterId) as AlertSubscriptionRow[];
}

// ---------- transaction helper ----------

export function tx<T>(fn: () => T): T {
  return getDb().transaction(fn)();
}
