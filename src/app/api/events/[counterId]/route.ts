import { listEventsForCounter } from "@/db/queries";
import { json, bad } from "../../_shared";
import {
  COUNTERS_BY_ID,
  isAllowedScope,
  scopedId,
} from "@/config/counters";

export const dynamic = "force-dynamic";

// GET /api/events/:defId?scope=...&limit=6
// `defId` is the def id (e.g. "aqi"). Scope is optional - omit to fetch
// the default scope's history. The modal usually requests limit=6 (hero
// + 5 recent); the standalone event page uses larger values.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ counterId: string }> },
) {
  const { counterId: defId } = await ctx.params;
  const def = COUNTERS_BY_ID[defId];
  if (!def) return bad("unknown_counter", 404);

  const url = new URL(req.url);
  const scopeParam = url.searchParams.get("scope");
  const scope = scopeParam && scopeParam.length ? scopeParam : def.defaultScope;
  if (!isAllowedScope(def, scope)) return bad("invalid_scope", 400);

  const limitParam = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(1, limitParam), 500)
    : 100;

  const id = scopedId(defId, scope);
  const rows = listEventsForCounter(id, limit).map((r) => ({
    id: r.id,
    counterId: r.counter_id,
    scope: r.scope,
    eventTime: r.event_time,
    label: r.label,
    sources: JSON.parse(r.sources) as string[],
    fingerprint: r.fingerprint,
    createdAt: r.created_at,
  }));
  return json({ ok: true, defId, scope, events: rows });
}
