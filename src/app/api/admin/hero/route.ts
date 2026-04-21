import { z } from "zod";
import {
  COUNTERS_BY_ID,
  isAllowedScope,
  scopedId,
} from "@/config/counters";
import { setAdminSetting } from "@/db/queries";
import { bad, json, requireAdmin } from "../../_shared";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  counterId: z.string().min(1).nullable(),  // null = unpin
  scope: z.string().min(1).max(80).nullable().optional(),
});

// POST /api/admin/hero { counterId, scope? }
//   counterId=null clears the pin and restores the automatic "smallest
//   daysSince" hero selection.
export async function POST(req: Request) {
  const guard = requireAdmin(req);
  if (guard !== true) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("invalid_json");
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return bad("invalid_input");

  const { counterId, scope } = parsed.data;
  if (counterId === null) {
    await setAdminSetting("pinnedHeroId", null);
    return json({ ok: true, pinned: null });
  }

  const def = COUNTERS_BY_ID[counterId];
  if (!def) return bad("unknown_counter", 404);
  const scopeValue = scope ?? def.defaultScope;
  if (!isAllowedScope(def, scopeValue)) return bad("invalid_scope");

  const id = scopedId(counterId, scopeValue);
  await setAdminSetting("pinnedHeroId", id);
  return json({ ok: true, pinned: id });
}
