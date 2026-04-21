import * as cheerio from "cheerio";
import { processCounter } from "@/core/engine";
import { politeFetch } from "@/core/fetch";
import { fp } from "@/core/fingerprint";
import { toIstParts } from "@/core/time";
import { makeEvent } from "@/core/validate";
import { getCounter, setCounterPrevValue } from "@/db/queries";
import type { CounterModule, CounterRunResult } from "./types";

// Indian Oil publishes daily retail prices per metro. We scrape the Delhi
// row and compare it to `previous_value_json` on the counter. Only a
// numerical delta triggers a reset - formatting changes are ignored.
const IOCL_URL = "https://iocl.com/petrol-diesel-price";

type Prev = { petrol?: number; diesel?: number };
type Snapshot = { petrol: number | null; diesel: number | null };

async function fetchData() {
  return politeFetch(IOCL_URL, { counterId: "fuel" });
}

function normalize(html: string): Snapshot {
  const $ = cheerio.load(html);
  const text = $("body").text();

  // Look for "Delhi ... ₹96.72" style patterns. IOCL's page reshuffles
  // occasionally; a permissive regex is more resilient than a CSS path.
  const delhi = text.split(/delhi/i)[1] ?? "";
  const slice = delhi.slice(0, 400);

  const petrolMatch = slice.match(/petrol[^\d]{0,40}(\d{2,3}\.\d{2})/i);
  const dieselMatch = slice.match(/diesel[^\d]{0,40}(\d{2,3}\.\d{2})/i);
  return {
    petrol: petrolMatch ? Number(petrolMatch[1]) : null,
    diesel: dieselMatch ? Number(dieselMatch[1]) : null,
  };
}

function detectEvent(snap: Snapshot, prev: Prev, nowIso: string) {
  if (snap.petrol == null && snap.diesel == null) return null;
  const changed: string[] = [];
  if (snap.petrol != null && prev.petrol != null && snap.petrol !== prev.petrol) {
    changed.push(`petrol ${prev.petrol} -> ${snap.petrol}`);
  }
  if (snap.diesel != null && prev.diesel != null && snap.diesel !== prev.diesel) {
    changed.push(`diesel ${prev.diesel} -> ${snap.diesel}`);
  }
  if (!changed.length) return null;
  const { date } = toIstParts(nowIso);
  return makeEvent({
    eventTime: nowIso,
    label: `Delhi ${changed.join("; ")}`,
    sources: ["https://iocl.com/petrol-diesel-price"],
    fingerprint: fp.date("fuel", date),
  });
}

export const fuel: CounterModule = {
  id: "fuel",
  async run(): Promise<CounterRunResult> {
    const r = await fetchData();
    if (!r.ok) return { kind: "error", error: r.error };
    const snap = normalize(r.body);
    if (snap.petrol == null && snap.diesel == null) {
      return { kind: "none", reason: "no_prices_parsed" };
    }
    const row = await getCounter("fuel");
    const prev: Prev = row?.previous_value_json
      ? (JSON.parse(row.previous_value_json) as Prev)
      : {};
    const event = detectEvent(snap, prev, new Date().toISOString());
    // Always persist the latest snapshot for next comparison.
    await setCounterPrevValue(
      "fuel",
      JSON.stringify({
        petrol: snap.petrol ?? prev.petrol ?? null,
        diesel: snap.diesel ?? prev.diesel ?? null,
      }),
    );
    if (!event) return { kind: "none", reason: "no_change" };
    return { kind: "processed", result: await processCounter("fuel", event) };
  },
};
