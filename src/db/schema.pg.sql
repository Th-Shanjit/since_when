-- Since When — PostgreSQL (Neon). Applied on boot via src/db/client.ts.

CREATE TABLE IF NOT EXISTS counters (
  id                   TEXT PRIMARY KEY,
  counter_def_id       TEXT,
  scope                TEXT,
  title                TEXT NOT NULL,
  subtitle             TEXT,
  kind                 TEXT NOT NULL DEFAULT 'auto',
  first_event_at       TEXT,
  last_event_at        TEXT,
  last_event_label     TEXT,
  last_event_source    TEXT,
  previous_value_json  TEXT,
  baseline_json        TEXT,
  status               TEXT NOT NULL DEFAULT 'live',
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  updated_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS counters_def_scope
  ON counters(counter_def_id, scope);

CREATE TABLE IF NOT EXISTS events_log (
  id           SERIAL PRIMARY KEY,
  counter_id   TEXT NOT NULL REFERENCES counters(id),
  scope        TEXT,
  event_time   TEXT NOT NULL,
  label        TEXT NOT NULL,
  sources      TEXT NOT NULL,
  fingerprint  TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_log_counter_time
  ON events_log(counter_id, event_time DESC);

CREATE TABLE IF NOT EXISTS pending_events (
  id                   SERIAL PRIMARY KEY,
  counter_id           TEXT NOT NULL,
  scope                TEXT,
  candidate_event_time TEXT NOT NULL,
  label                TEXT NOT NULL,
  sources              TEXT NOT NULL,
  fingerprint          TEXT NOT NULL UNIQUE,
  status               TEXT NOT NULL DEFAULT 'pending',
  created_at           TEXT NOT NULL,
  approved_by          TEXT,
  decided_at           TEXT
);
CREATE INDEX IF NOT EXISTS pending_status
  ON pending_events(status, created_at DESC);

CREATE TABLE IF NOT EXISTS fetch_log (
  id          SERIAL PRIMARY KEY,
  counter_id  TEXT NOT NULL,
  started_at  TEXT NOT NULL,
  ok          INTEGER NOT NULL,
  error       TEXT,
  duration_ms INTEGER
);
CREATE INDEX IF NOT EXISTS fetch_log_counter_time
  ON fetch_log(counter_id, started_at DESC);

CREATE TABLE IF NOT EXISTS admin_settings (
  key    TEXT PRIMARY KEY,
  value  TEXT
);

CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id             SERIAL PRIMARY KEY,
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
