-- Since When / Days Since India
-- SQLite schema. Applied idempotently on boot by src/db/client.ts.
-- Incremental schema changes live in migrate() in client.ts and are safe
-- to re-run against an existing DB.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- A counter row is identified by a composite "scoped id" in `id`:
--   e.g. "aqi#Delhi", "priceHike#netflix", "fuel" (unscoped).
-- `counter_def_id` and `scope` are denormalised copies of the two parts
-- so queries by either dimension stay trivial and indexable.
CREATE TABLE IF NOT EXISTS counters (
  id                   TEXT PRIMARY KEY,
  counter_def_id       TEXT,                            -- e.g. 'aqi'
  scope                TEXT,                            -- e.g. 'Delhi', NULL for global
  title                TEXT NOT NULL,
  subtitle             TEXT,
  kind                 TEXT NOT NULL DEFAULT 'auto',   -- 'auto' | 'queue' | 'special' | 'yearly'
  first_event_at       TEXT,                            -- ISO UTC
  last_event_at        TEXT,                            -- ISO UTC
  last_event_label     TEXT,
  last_event_source    TEXT,
  previous_value_json  TEXT,
  baseline_json        TEXT,
  status               TEXT NOT NULL DEFAULT 'live',    -- 'live' | 'frozen'
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  updated_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS counters_def_scope
  ON counters(counter_def_id, scope);

CREATE TABLE IF NOT EXISTS events_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  counter_id   TEXT NOT NULL REFERENCES counters(id),
  scope        TEXT,
  event_time   TEXT NOT NULL,        -- ISO UTC (first public-report time)
  label        TEXT NOT NULL,
  sources      TEXT NOT NULL,        -- JSON array of URLs
  fingerprint  TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_log_counter_time
  ON events_log(counter_id, event_time DESC);

CREATE TABLE IF NOT EXISTS pending_events (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  counter_id           TEXT NOT NULL,
  scope                TEXT,
  candidate_event_time TEXT NOT NULL,
  label                TEXT NOT NULL,
  sources              TEXT NOT NULL,  -- JSON array
  fingerprint          TEXT NOT NULL UNIQUE,
  status               TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  created_at           TEXT NOT NULL,
  approved_by          TEXT,
  decided_at           TEXT
);
CREATE INDEX IF NOT EXISTS pending_status
  ON pending_events(status, created_at DESC);

CREATE TABLE IF NOT EXISTS fetch_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  counter_id  TEXT NOT NULL,
  started_at  TEXT NOT NULL,
  ok          INTEGER NOT NULL,       -- 0 | 1
  error       TEXT,
  duration_ms INTEGER
);
CREATE INDEX IF NOT EXISTS fetch_log_counter_time
  ON fetch_log(counter_id, started_at DESC);

-- Simple key-value bag for admin-controlled flags.
-- Known keys: 'pinnedHeroId'.
CREATE TABLE IF NOT EXISTS admin_settings (
  key    TEXT PRIMARY KEY,
  value  TEXT
);

-- Email alert subscriptions with double opt-in. `counter_id` is the
-- full scoped id (e.g. "aqi#Delhi") so a user can subscribe to a single
-- city without also subscribing to every other scope of the same def.
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL,
  counter_id     TEXT NOT NULL,
  confirm_token  TEXT NOT NULL UNIQUE,
  confirmed_at   TEXT,
  unsub_token    TEXT NOT NULL UNIQUE,
  created_at     TEXT NOT NULL,
  UNIQUE(email, counter_id)
);
CREATE INDEX IF NOT EXISTS alert_subs_counter
  ON alert_subscriptions(counter_id, confirmed_at);
