import { listPending } from "@/db/queries";
import { json, requireAdmin } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ok = requireAdmin(req);
  if (ok !== true) return ok;
  const pendingRows = await listPending(100);
  const rows = pendingRows.map((r) => ({
    id: r.id,
    counterId: r.counter_id,
    candidateEventTime: r.candidate_event_time,
    label: r.label,
    sources: JSON.parse(r.sources) as string[],
    fingerprint: r.fingerprint,
    createdAt: r.created_at,
  }));
  return json({ ok: true, pending: rows });
}
