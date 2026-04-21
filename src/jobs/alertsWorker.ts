import { COUNTERS_BY_ID } from "@/config/counters";
import { log } from "@/core/logger";
import { onCounterChange, type CounterChangeEvent } from "@/core/events";
import { sendEmail, siteUrl } from "@/core/mailer";
import { listConfirmedSubscribers, logFetch } from "@/db/queries";
import { formatIst } from "@/core/time";

// Fan-out listener: whenever the engine fires a reset or yearly-increment,
// enumerate confirmed subscriptions for that scoped counter id and send
// one email per subscriber. Failures are swallowed and logged to fetch_log
// with counter_id '_alerts' so they show up on /api/health.

let started = false;

export function startAlertsWorker(): void {
  if (started) return;
  started = true;
  onCounterChange((e) => {
    // Fire-and-forget: listener can't block engine path.
    void dispatch(e).catch((err) => {
      log.error("alerts_dispatch_fatal_error", {
        counter_id: e.counterId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  });
  log.info("alerts_worker_started", {});
}

async function dispatch(e: CounterChangeEvent) {
  const subs = await listConfirmedSubscribers(e.counterId);
  if (!subs.length) return;

  const def = COUNTERS_BY_ID[e.counterDefId];
  const title = def?.title ?? e.counterDefId;
  const subtitle = def?.subtitle ?? "";
  const scopeBit = e.scope ? ` (${e.scope})` : "";
  const eventLine = formatIst(e.eventTime, "d MMM yyyy, HH:mm 'IST'");
  const base = siteUrl();
  const shareUrl = `${base}/?open=${encodeURIComponent(e.counterDefId)}${
    e.scope ? `&scope=${encodeURIComponent(e.scope)}` : ""
  }`;

  const kindLine =
    e.kind === "reset"
      ? `Reset to zero.`
      : `Tally is now ${e.value ?? "?"} for 2026.`;

  let sent = 0;
  let failed = 0;
  for (const s of subs) {
    const unsubUrl = `${base}/api/alerts/unsubscribe?token=${s.unsub_token}`;
    const r = await sendEmail({
      to: s.email,
      subject: `Since When: ${subtitle}${scopeBit} - ${kindLine}`,
      text:
        `${title} - ${subtitle}${scopeBit}\n\n` +
        `${kindLine}\n` +
        `Event: ${e.label}\n` +
        `When: ${eventLine}\n` +
        `Source: ${e.source}\n\n` +
        `Board: ${shareUrl}\n\n` +
        `Unsubscribe: ${unsubUrl}\n`,
      html:
        `<h2 style="margin:0 0 6px">${subtitle}${scopeBit}</h2>` +
        `<p style="margin:0 0 14px;color:#555">${title}</p>` +
        `<p><strong>${kindLine}</strong></p>` +
        `<p>${e.label}<br/><small>${eventLine} &middot; <a href="${e.source}">source</a></small></p>` +
        `<p><a href="${shareUrl}">Open on Since When</a></p>` +
        `<p style="color:#888;font-size:12px;margin-top:28px">` +
        `<a href="${unsubUrl}" style="color:#888">Unsubscribe</a></p>`,
    });
    if (r.ok) sent += 1;
    else failed += 1;
  }

  await logFetch({
    counter_id: "_alerts",
    started_at: new Date().toISOString(),
    ok: failed === 0,
    error: failed ? `${failed}_send_failures` : null,
    duration_ms: 0,
  });
  log.info("alerts_dispatched", {
    counter_id: e.counterId,
    sent,
    failed,
  });
}
