import { decidePending, getPending, insertEvent, tx } from "@/db/queries";
import { processCounter } from "@/core/engine";
import { EventDataSchema } from "@/core/validate";
import { json, bad, requireAdmin } from "../../../_shared";

export const dynamic = "force-dynamic";

type Action = "approve" | "reject";

// POST /api/admin/queue/:id  with body { action: 'approve' | 'reject' }
// Approvals go through processCounter just like manual/cron paths.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const guard = requireAdmin(req);
  if (guard !== true) return guard;
  const { id } = await ctx.params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) return bad("invalid_id");

  let body: { action?: Action } = {};
  try {
    body = (await req.json()) as { action?: Action };
  } catch {
    return bad("invalid_json");
  }
  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return bad("invalid_action");
  }

  const row = getPending(numId);
  if (!row || row.status !== "pending") return bad("not_pending", 404);

  if (action === "reject") {
    decidePending(numId, "rejected", "admin");
    return json({ ok: true, decided: "rejected" });
  }

  const sources = JSON.parse(row.sources) as string[];
  const eventData = EventDataSchema.parse({
    isValidEvent: true, // tiering was checked when the candidate was coalesced
    eventTime: row.candidate_event_time,
    label: row.label,
    sources,
    fingerprint: row.fingerprint,
  });

  // Atomic: mark decision + process the event inside one txn so a crash
  // in the middle cannot leave the queue approved but the counter untouched.
  const result = tx(() => {
    decidePending(numId, "approved", "admin");
    return processCounter(row.counter_id, eventData, row.scope);
  });
  return json({ ok: true, result });
}
