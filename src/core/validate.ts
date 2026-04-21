import { z } from "zod";
import { sourcesSatisfyTiering } from "./sources";

// Shape every counter's detectEvent() produces.
// isValidEvent is computed in this module so counter authors can't forget.

export const EventDataSchema = z.object({
  isValidEvent: z.boolean(),
  eventTime: z.string().min(10), // ISO UTC string
  label: z.string().min(1).max(240),
  sources: z.array(z.string().url()).min(0),
  fingerprint: z.string().min(6),
});

export type EventData = z.infer<typeof EventDataSchema>;

export function parseEventData(v: unknown): EventData {
  return EventDataSchema.parse(v);
}

// Convenience constructor that enforces source tiering.
// If sources don't satisfy Tier-1 OR ≥2 Tier-2 domains, the event is
// flagged invalid regardless of what the caller claimed.
export function makeEvent(input: {
  eventTime: string;
  label: string;
  sources: string[];
  fingerprint: string;
  // Override only for counters whose sources are vetted out-of-band
  // (e.g. manual-entry handler). Must be explicit.
  skipTierCheck?: boolean;
}): EventData {
  const tieredOk = input.skipTierCheck
    ? true
    : sourcesSatisfyTiering(input.sources);
  return EventDataSchema.parse({
    isValidEvent: tieredOk,
    eventTime: input.eventTime,
    label: input.label,
    sources: input.sources,
    fingerprint: input.fingerprint,
  });
}

export function invalidEvent(reason: string): EventData {
  return {
    isValidEvent: false,
    eventTime: new Date().toISOString(),
    label: `invalid: ${reason}`,
    sources: [],
    fingerprint: `invalid:${reason}:${Date.now()}`,
  };
}

// Zod schemas for POST /api/manual-event and admin decision payloads.
export const ManualEventInputSchema = z.object({
  counter_id: z.string().min(1),
  // Optional scope for counters whose def declares a scopeKind. Validation
  // against the allowed list happens in the handler where the def is known.
  scope: z.string().min(1).max(80).nullable().optional(),
  event_time: z.string().min(10),
  label: z.string().min(1).max(240),
  source_url: z.string().url(),
});
export type ManualEventInput = z.infer<typeof ManualEventInputSchema>;
