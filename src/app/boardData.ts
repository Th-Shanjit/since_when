import {
  COUNTERS,
  COUNTERS_BY_ID,
  allowedScopes,
  scopedId,
} from "@/config/counters";
import { getAdminSetting, listCounters, type CounterRow } from "@/db/queries";
import { daysSinceIst } from "@/core/time";
import { ensureDb } from "@/db/client";
import { ensureSeeded, seed } from "@/db/seed";

export type BoardCounter = {
  id: string; // scoped id e.g. "aqi#Delhi"
  defId: string; // "aqi"
  scope: string | null; // "Delhi"
  title: string;
  subtitle: string;
  kind: "auto" | "queue" | "yearly";
  scopeKind: "city" | "service" | "exam" | null;
  scopeOptions: readonly string[];
  daysSince: number | null; // null for yearly
  count: number | null; // null for days-since
  status: "live" | "frozen";
  lastEventAt: string | null;
  lastEventLabel: string | null;
  lastEventSource: string | null;
};

function readCount(row: CounterRow | undefined): number | null {
  if (!row?.previous_value_json) return null;
  try {
    const parsed = JSON.parse(row.previous_value_json) as { count?: number };
    return typeof parsed.count === "number" ? parsed.count : null;
  } catch {
    return null;
  }
}

// Build a BoardCounter from the def + its (possibly missing) DB row.
function toBoard(
  def: (typeof COUNTERS)[number],
  scope: string | null,
  row: CounterRow | undefined,
): BoardCounter {
  const id = scopedId(def.id, scope);
  const isYearly = def.kind === "yearly";
  return {
    id,
    defId: def.id,
    scope,
    title: def.title,
    subtitle: def.subtitle,
    kind: def.kind === "special" ? "auto" : (def.kind as "auto" | "queue" | "yearly"),
    scopeKind: def.scopeKind,
    scopeOptions: allowedScopes(def),
    daysSince: isYearly ? null : daysSinceIst(row?.last_event_at ?? null),
    count: isYearly ? readCount(row) : null,
    status: (row?.status ?? "live") as "live" | "frozen",
    lastEventAt: row?.last_event_at ?? null,
    lastEventLabel: row?.last_event_label ?? null,
    lastEventSource: row?.last_event_source ?? null,
  };
}

export async function loadBoard(): Promise<BoardCounter[]> {
  await ensureDb();
  await seed();
  const rows = await listCounters();
  const byId = new Map(rows.map((r) => [r.id, r]));

  return COUNTERS.filter((c) => c.kind !== "special").map((def) => {
    const scope = def.scopeKind != null ? def.defaultScope : null;
    const id = scopedId(def.id, scope);
    return toBoard(def, scope, byId.get(id));
  });
}

// Fetch a single scoped counter's current state (for the tile dropdown
// re-fetch and the modal). Lazy-seeds the (def, scope) pair on demand -
// the dropdown lists every allowed scope, but the bulk seed only writes
// rows for defaultScope + explicit scopeSeeds, so previously-unseen
// picks (e.g. "Chennai" for AQI) would otherwise return an empty tile.
export async function loadCounter(
  defId: string,
  scope: string | null,
): Promise<BoardCounter | null> {
  const def = COUNTERS_BY_ID[defId];
  if (!def) return null;
  await ensureDb();
  await ensureSeeded(defId, scope);
  const id = scopedId(def.id, scope);
  const rows = await listCounters();
  const row = rows.find((r) => r.id === id);
  return toBoard(def, scope, row);
}

// Fallback hero pin when admin hasn't set one. Internet shutdown orders is
// the most editorially damning yearly tally, so it makes a stronger opener
// than "Delhi AQI at zero days" which is also visually noisy (scope city).
const DEFAULT_HERO_ID = "internetShutdownOrders";

export async function pickHero(
  counters: BoardCounter[],
): Promise<BoardCounter> {
  const pinned = await getAdminSetting("pinnedHeroId");
  if (pinned) {
    const match = counters.find((c) => c.id === pinned);
    if (match) return match;
  }
  const defaultMatch = counters.find((c) => c.id === DEFAULT_HERO_ID);
  if (defaultMatch) return defaultMatch;
  return [...counters].sort((a, b) => {
    const aIsYearly = a.kind === "yearly";
    const bIsYearly = b.kind === "yearly";
    if (aIsYearly !== bIsYearly) return aIsYearly ? 1 : -1;
    const aD = a.daysSince ?? Number.POSITIVE_INFINITY;
    const bD = b.daysSince ?? Number.POSITIVE_INFINITY;
    if (aD !== bD) return aD - bD;
    return (b.lastEventAt ?? "").localeCompare(a.lastEventAt ?? "");
  })[0];
}
