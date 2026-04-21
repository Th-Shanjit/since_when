import { processCounter, type ProcessResult } from "@/core/engine";
import { tierOf } from "@/core/sources";
import { EventDataSchema, ManualEventInputSchema } from "@/core/validate";
import { fingerprint } from "@/core/fingerprint";
import { COUNTERS_BY_ID, isAllowedScope } from "@/config/counters";

// Shared path for human-driven events: POST /api/manual-event and the
// admin "approve" button on /admin/queue. Both must obey the same rules
// as the cron jobs - there is no bypass.

export type ManualResult =
  | { ok: true; result: ProcessResult }
  | { ok: false; error: string };

export function handleManualEvent(input: unknown): ManualResult {
  const parsed = ManualEventInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { counter_id, event_time, label, source_url, scope } = parsed.data;

  const def = COUNTERS_BY_ID[counter_id];
  if (!def) return { ok: false, error: "unknown_counter" };
  if (def.kind === "special") return { ok: false, error: "not_resettable" };

  const scopeValue: string | null = scope ?? null;
  if (!isAllowedScope(def, scopeValue)) {
    return { ok: false, error: "invalid_scope" };
  }

  const tier = tierOf(source_url);
  if (tier == null) return { ok: false, error: "unrecognised_source_domain" };

  // Manual entries are trusted once the source domain is whitelisted, so
  // we skip the >=2-Tier-2 requirement but still enforce the whitelist.
  const fp = fingerprint("manual", counter_id, scopeValue ?? "", event_time, label, source_url);
  const eventData = EventDataSchema.parse({
    isValidEvent: true,
    eventTime: new Date(event_time).toISOString(),
    label,
    sources: [source_url],
    fingerprint: fp,
  });

  const result = processCounter(counter_id, eventData, scopeValue);
  return { ok: true, result };
}
