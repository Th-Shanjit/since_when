import { listPending } from "@/db/queries";
import { COUNTERS_BY_ID } from "@/config/counters";
import { formatIst } from "@/core/time";
import { QueueClient } from "./QueueClient";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const raw = await listPending(200);
  const pending = raw.map((r) => ({
    id: r.id,
    counterId: r.counter_id,
    scope: r.scope,
    counterTitle: COUNTERS_BY_ID[r.counter_id]?.subtitle ?? r.counter_id,
    candidateEventTime: r.candidate_event_time,
    candidateEventTimePretty: formatIst(
      r.candidate_event_time,
      "d MMM yyyy, HH:mm 'IST'",
    ),
    label: r.label,
    sources: JSON.parse(r.sources) as string[],
    fingerprint: r.fingerprint,
    createdAt: r.created_at,
  }));

  return (
    <main className="min-h-screen paper py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <div
          className="uppercase tracking-[0.35em] text-ink/70"
          style={{ fontFamily: "var(--font-stencil)", fontSize: 13 }}
        >
          Since When / Clipboard
        </div>
        <h1
          className="mt-4 text-ink"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(2rem, 5vw, 3rem)",
            lineHeight: 1.05,
          }}
        >
          Pending resets
        </h1>
        <p
          className="mt-3 text-ink/70"
          style={{ fontFamily: "var(--font-sans)", fontSize: 17 }}
        >
          These candidates were detected by the automated sweep but will not
          reset their counter until a human approves. If the sourcing is
          insufficient or the claim is weak, reject it. If unsure, do not
          approve.
        </p>

        <QueueClient initial={pending} />
      </div>
    </main>
  );
}
