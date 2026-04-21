import {
  COUNTERS,
  COUNTERS_BY_ID,
  isAllowedScope,
  scopedId,
  scopesToSeed,
  seedForScope,
  type CounterDef,
} from "@/config/counters";
import { ensureDb, getPool } from "./client";
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
export async function seedOne(def: CounterDef, scope: string | null): Promise<void> {
  const id = scopedId(def.id, scope);

  await upsertCounter({
    id,
    counter_def_id: def.id,
    scope,
    title: def.title,
    subtitle: def.subtitle,
    kind: def.kind,
  });

  if (def.kind === "special") return;

  const existing = await getCounter(id);
  const s = seedForScope(def, scope);

  // Yearly counters: seed a count directly without inserting a
  // placeholder event (the count is what matters, not the history).
  if (def.kind === "yearly") {
    if (!existing?.previous_value_json) {
      await setCounterPrevValue(id, JSON.stringify({ count: s.count ?? 0 }));
      await ensureDb();
      await getPool().query(
        `UPDATE counters
           SET last_event_at = $1, last_event_label = $2, last_event_source = $3,
               first_event_at = COALESCE(first_event_at, $4)
          WHERE id = $5`,
        [s.event_time, s.label, s.source, s.event_time, id],
      );
    }
    return;
  }

  // auto / queue: seed a first event so days-since is defined.
  if (existing?.last_event_at) return;

  const fp = fpSeed(id);
  if (await eventFingerprintExists(fp)) return;

  await insertEvent({
    counter_id: id,
    scope,
    event_time: s.event_time,
    label: s.label,
    sources: [s.source],
    fingerprint: fp,
  });
  await updateCounterOnReset({
    id,
    event_time: s.event_time,
    label: s.label,
    source: s.source,
  });
  await ensureDb();
  await getPool().query(
    "UPDATE counters SET first_event_at = $1 WHERE id = $2 AND first_event_at IS NULL",
    [s.event_time, id],
  );
}

// Ensure a scoped counter row + seed event exist for the given (defId,
// scope). Returns false if the def/scope is unknown or not allowed.
export async function ensureSeeded(
  defId: string,
  scope: string | null,
): Promise<boolean> {
  const def = COUNTERS_BY_ID[defId];
  if (!def) return false;
  if (!isAllowedScope(def, scope)) return false;
  const id = scopedId(def.id, scope);
  const existing = await getCounter(id);
  const alreadySeeded =
    def.kind === "yearly"
      ? !!existing?.previous_value_json
      : !!existing?.last_event_at;
  if (alreadySeeded) return true;
  await seedOne(def, scope);
  return true;
}

export async function seed(): Promise<void> {
  for (const def of COUNTERS) {
    for (const scope of scopesToSeed(def)) {
      await seedOne(def, scope);
    }
  }
}

const isDirect =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("src/db/seed.ts");
if (isDirect) {
  void (async () => {
    try {
      await seed();
      console.log("[seed] ok - counters initialised");
    } catch (e) {
      console.error("[seed] failed", e);
      process.exit(1);
    }
  })();
}
