import {
  COUNTERS,
  COUNTERS_BY_ID,
  isAllowedScope,
  scopedId,
  scopesToSeed,
  seedForScope,
  type CounterDef,
} from "@/config/counters";
import { getDb } from "./client";
import {
  eventFingerprintExists,
  getCounter,
  insertEvent,
  setCounterPrevValue,
  upsertCounter,
  updateCounterOnReset,
} from "./queries";

// One-shot seed. Idempotent: safe to run more than once. Inserts plausible
// "first events" per (def, scope) so the board lights up on day one. The
// engine's usual fingerprint guard prevents duplicates.

function fpSeed(id: string) {
  return `seed:${id}`;
}

// Seed a single (def, scope) pair. Extracted so it can run from:
//   - the bulk seed() on boot (for defaultScope + explicit scopeSeeds), and
//   - loadCounter() / loadBoard() lazily when the user opens a scope that
//     has no DB row yet (e.g. picks "Chennai" for AQI). Lazy seeding uses
//     the def's fallback seed, so the tile fills in immediately instead of
//     showing "no event".
export function seedOne(def: CounterDef, scope: string | null): void {
  const id = scopedId(def.id, scope);

  upsertCounter({
    id,
    counter_def_id: def.id,
    scope,
    title: def.title,
    subtitle: def.subtitle,
    kind: def.kind,
  });

  if (def.kind === "special") return;

  const existing = getCounter(id);
  const s = seedForScope(def, scope);

  // Yearly counters: seed a count directly without inserting a
  // placeholder event (the count is what matters, not the history).
  if (def.kind === "yearly") {
    if (!existing?.previous_value_json) {
      setCounterPrevValue(id, JSON.stringify({ count: s.count ?? 0 }));
      getDb()
        .prepare(
          `UPDATE counters
             SET last_event_at = ?, last_event_label = ?, last_event_source = ?,
                 first_event_at = COALESCE(first_event_at, ?)
            WHERE id = ?`,
        )
        .run(s.event_time, s.label, s.source, s.event_time, id);
    }
    return;
  }

  // auto / queue: seed a first event so days-since is defined.
  if (existing?.last_event_at) return;

  const fp = fpSeed(id);
  if (eventFingerprintExists(fp)) return;

  insertEvent({
    counter_id: id,
    scope,
    event_time: s.event_time,
    label: s.label,
    sources: [s.source],
    fingerprint: fp,
  });
  updateCounterOnReset({
    id,
    event_time: s.event_time,
    label: s.label,
    source: s.source,
  });
  getDb()
    .prepare(
      "UPDATE counters SET first_event_at = ? WHERE id = ? AND first_event_at IS NULL",
    )
    .run(s.event_time, id);
}

// Ensure a scoped counter row + seed event exist for the given (defId,
// scope). Returns false if the def/scope is unknown or not allowed.
export function ensureSeeded(defId: string, scope: string | null): boolean {
  const def = COUNTERS_BY_ID[defId];
  if (!def) return false;
  if (!isAllowedScope(def, scope)) return false;
  const id = scopedId(def.id, scope);
  const existing = getCounter(id);
  const alreadySeeded =
    def.kind === "yearly"
      ? !!existing?.previous_value_json
      : !!existing?.last_event_at;
  if (alreadySeeded) return true;
  seedOne(def, scope);
  return true;
}

export function seed() {
  for (const def of COUNTERS) {
    for (const scope of scopesToSeed(def)) {
      seedOne(def, scope);
    }
  }
}

const isDirect =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("src/db/seed.ts");
if (isDirect) {
  seed();
  // eslint-disable-next-line no-console
  console.log("[seed] ok - counters initialised");
}
