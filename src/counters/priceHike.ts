import * as cheerio from "cheerio";
import { processCounter } from "@/core/engine";
import { politeFetch } from "@/core/fetch";
import { fp } from "@/core/fingerprint";
import { toIstParts } from "@/core/time";
import { makeEvent } from "@/core/validate";
import { TRACKED_SERVICES } from "@/config/services";
import { getCounter, setCounterPrevValue } from "@/db/queries";
import type { CounterModule, CounterRunResult } from "./types";

// Scrape each service's own pricing page and extract numeric price per
// plan via the regexes declared in config/services.ts. Compare against
// the last-known snapshot stored in previous_value_json. A *strict* price
// increase (>, not !=) fires the event. Decreases, new tiers, and
// formatting jitter are deliberately ignored.

type Snapshot = Record<string, Record<string, number>>; // service -> plan -> price

async function fetchData(url: string) {
  return politeFetch(url, { counterId: "priceHike" });
}

function extract(html: string, regexStrs: string[]): Record<string, number> {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const out: Record<string, number> = {};
  for (const rs of regexStrs) {
    const re = new RegExp(rs, "i");
    const m = text.match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) out[rs] = n;
    }
  }
  return out;
}

type Hike = {
  serviceId: string;
  serviceLabel: string;
  plan: string;
  from: number;
  to: number;
  sourceUrl: string;
};

function diff(
  snap: Snapshot,
  prev: Snapshot,
  services: typeof TRACKED_SERVICES,
): Hike[] {
  const hikes: Hike[] = [];
  for (const svc of services) {
    if (!svc.priceRegexes) continue;
    const snapS = snap[svc.id] ?? {};
    const prevS = prev[svc.id] ?? {};
    for (const p of svc.priceRegexes) {
      const curr = snapS[p.plan];
      const was = prevS[p.plan];
      if (curr == null || was == null) continue;
      if (curr > was) {
        hikes.push({
          serviceId: svc.id,
          serviceLabel: svc.label,
          plan: p.plan,
          from: was,
          to: curr,
          sourceUrl: svc.pricingUrl!,
        });
      }
    }
  }
  return hikes;
}

function detectEvent(h: Hike, nowIso: string) {
  const { date } = toIstParts(nowIso);
  return makeEvent({
    eventTime: nowIso,
    label: `${h.serviceLabel} ${h.plan} INR ${h.from} -> INR ${h.to}`,
    sources: [h.sourceUrl],
    fingerprint: fp.serviceDate(`${h.serviceId}:${h.plan}`, date),
  });
}

export const priceHike: CounterModule = {
  id: "priceHike",
  async run(): Promise<CounterRunResult> {
    const row = await getCounter("priceHike");
    const prev: Snapshot = row?.previous_value_json
      ? (JSON.parse(row.previous_value_json) as Snapshot)
      : {};
    const snap: Snapshot = { ...prev };

    for (const svc of TRACKED_SERVICES) {
      if (!svc.pricingUrl || !svc.priceRegexes?.length) continue;
      const r = await fetchData(svc.pricingUrl);
      if (!r.ok) continue;
      const raw = extract(
        r.body,
        svc.priceRegexes.map((p) => p.regex),
      );
      const byPlan: Record<string, number> = {};
      for (const p of svc.priceRegexes) {
        const n = raw[p.regex];
        if (n != null) byPlan[p.plan] = n;
      }
      if (Object.keys(byPlan).length) snap[svc.id] = byPlan;
    }

    const hikes = diff(snap, prev, TRACKED_SERVICES);
    await setCounterPrevValue("priceHike", JSON.stringify(snap));

    if (!hikes.length) return { kind: "none", reason: "no_hike" };

    // Fire one event per service (each scoped to the service label).
    hikes.sort((a, b) => b.to / b.from - a.to / a.from);
    const nowIso = new Date().toISOString();
    let last: CounterRunResult = { kind: "none", reason: "no_hike" };
    for (const h of hikes) {
      const event = detectEvent(h, nowIso);
      last = {
        kind: "processed",
        result: await processCounter("priceHike", event, h.serviceLabel),
      };
    }
    return last;
  },
};
