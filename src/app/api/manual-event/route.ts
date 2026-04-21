import { handleManualEvent } from "@/manual/handler";
import { json, bad, requireAdmin } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ok = requireAdmin(req);
  if (ok !== true) return ok;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("invalid_json");
  }
  const r = await handleManualEvent(body);
  if (!r.ok) return bad(r.error, 400);
  const result = r.result;
  return json({ ok: true, result });
}
