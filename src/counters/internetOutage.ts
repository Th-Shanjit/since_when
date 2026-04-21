import { processCounter } from "@/core/engine";
import { politeFetch } from "@/core/fetch";
import { fp } from "@/core/fingerprint";
import { toIstParts } from "@/core/time";
import { makeEvent } from "@/core/validate";
import { TRACKED_SERVICES } from "@/config/services";
import { THRESHOLDS } from "@/config/thresholds";
import { getCounter, setCounterBaseline } from "@/db/queries";
import type { CounterModule, CounterRunResult } from "./types";

// Downdetector has no public API; their own frontend reads a JSON ping
// blob scoped per service/country. The endpoint structure below is the
// undocumented pattern their site uses. We extract the most-recent hour's
// report count and compare it against a rolling 24-sample baseline stored
// in the counter's baseline_json blob.

type BaselineState = Record<
  string,
  { ringBuffer: number[]; lastHour: string | null }
>;

function ddUrl(slug: string) {
  return `https://downdetector.in/status/${slug}/`;
}

async function fetchData(slug: string) {
  return politeFetch(ddUrl(slug), { counterId: "internetOutage" });
}

function normalize(html: string): number | null {
  const m = html.match(/reports\s*:\s*(\[\[.*?\]\])/);
  if (!m) return null;
  try {
    const arr = JSON.parse(m[1]) as Array<[unknown, unknown]>;
    if (!arr.length) return null;
    const last = arr[arr.length - 1];
    const n = Number(last[1]);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function updateRingBuffer(
  state: BaselineState,
  serviceId: string,
  reports: number,
) {
  const entry = state[serviceId] ?? { ringBuffer: [], lastHour: null };
  entry.ringBuffer.push(reports);
  const keep = THRESHOLDS.outage.baselineWindowHours;
  if (entry.ringBuffer.length > keep) {
    entry.ringBuffer.splice(0, entry.ringBuffer.length - keep);
  }
  entry.lastHour = new Date().toISOString();
  state[serviceId] = entry;
  return entry;
}

function baselineOf(entry: { ringBuffer: number[] }) {
  if (!entry.ringBuffer.length) return 0;
  const sum = entry.ringBuffer.reduce((a, b) => a + b, 0);
  return sum / entry.ringBuffer.length;
}

function detectEvent(
  serviceLabel: string,
  reports: number,
  baseline: number,
  now: string,
) {
  const { multiplier, absoluteMinReports } = THRESHOLDS.outage;
  const trigger = Math.max(baseline * multiplier, absoluteMinReports);
  if (reports < trigger) return null;
  const { hour } = toIstParts(now);
  return makeEvent({
    eventTime: now,
    label: `${serviceLabel} reports ${reports} (baseline ${Math.round(baseline)})`,
    sources: ["https://downdetector.in/"],
    fingerprint: fp.serviceHour(serviceLabel, hour),
  });
}

export const internetOutage: CounterModule = {
  id: "internetOutage",
  async run(): Promise<CounterRunResult> {
    // Baseline ring buffers live on the unscoped "internetOutage" row so
    // every service shares a single state bag. This keeps the legacy
    // seed row useful after migration.
    const baseRow = getCounter("internetOutage");
    const state: BaselineState = baseRow?.baseline_json
      ? (JSON.parse(baseRow.baseline_json) as BaselineState)
      : {};

    let last: CounterRunResult = { kind: "none", reason: "no_service_over_threshold" };

    for (const svc of TRACKED_SERVICES) {
      const r = await fetchData(svc.downdetectorSlug);
      if (!r.ok) continue;
      const reports = normalize(r.body);
      if (reports == null) continue;
      const entry = updateRingBuffer(state, svc.id, reports);
      const baseline = baselineOf(entry);
      const event = detectEvent(
        svc.label,
        reports,
        baseline,
        new Date().toISOString(),
      );
      if (event) {
        last = {
          kind: "processed",
          result: processCounter("internetOutage", event, svc.label),
        };
      }
    }

    setCounterBaseline("internetOutage", JSON.stringify(state));
    return last;
  },
};
