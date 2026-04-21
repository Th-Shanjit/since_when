import { COUNTERS_BY_ID, isAllowedScope } from "@/config/counters";
import { loadCounter } from "@/app/boardData";
import { bad, json } from "../../_shared";

export const dynamic = "force-dynamic";

// GET /api/counter/:defId?scope=Delhi
// Used by per-tile scope dropdowns to hot-swap values without a page
// navigation. `defId` is the stable definition id (e.g. "aqi"), not the
// composite scoped id.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ defId: string }> },
) {
  const { defId } = await ctx.params;
  const def = COUNTERS_BY_ID[defId];
  if (!def) return bad("unknown_counter", 404);

  const url = new URL(req.url);
  const scopeParam = url.searchParams.get("scope");
  const scope = scopeParam && scopeParam.length ? scopeParam : def.defaultScope;

  if (!isAllowedScope(def, scope)) return bad("invalid_scope", 400);

  const counter = loadCounter(defId, scope);
  if (!counter) return bad("not_found", 404);

  return json({ ok: true, counter });
}
