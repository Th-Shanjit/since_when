import * as cheerio from "cheerio";
import { processCounter } from "@/core/engine";
import { politeFetch } from "@/core/fetch";
import { fp } from "@/core/fingerprint";
import { toIstParts } from "@/core/time";
import { makeEvent } from "@/core/validate";
import type { CounterModule, CounterRunResult } from "./types";

// IMD's daily nowcast/warning page lists regions under "Heat Wave" /
// "Severe Heat Wave" headings. We read the plain text and match those
// classifications alongside a region string.
const IMD_URL = "https://mausam.imd.gov.in/responsive/all_india_warnings.php";

type Hit = { classification: string; region: string; measuredAt: string };

async function fetchData() {
  return politeFetch(IMD_URL, { counterId: "heatwave" });
}

function normalize(html: string): Hit[] {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const nowIso = new Date().toISOString();
  const hits: Hit[] = [];

  const patterns: Array<{ re: RegExp; cls: string }> = [
    { re: /severe heat ?wave[^.]{0,120}over ([^.;]{3,80})/gi, cls: "Severe heat wave" },
    { re: /heat ?wave[^.]{0,120}over ([^.;]{3,80})/gi, cls: "Heat wave" },
  ];
  for (const p of patterns) {
    for (const m of text.matchAll(p.re)) {
      hits.push({
        classification: p.cls,
        region: m[1].trim().replace(/[.,;:]+$/, ""),
        measuredAt: nowIso,
      });
    }
  }
  return hits;
}

function toEvent(h: Hit) {
  const { date } = toIstParts(h.measuredAt);
  return makeEvent({
    eventTime: h.measuredAt,
    label: `IMD: ${h.classification} - ${h.region}`,
    sources: ["https://mausam.imd.gov.in/"],
    fingerprint: fp.regionDate("heatwave", h.region, date),
  });
}

// Try to extract one of the known MAJOR_CITIES from the IMD region text.
// If it doesn't map to a city we track, scope stays null and the engine
// falls back to the global heatwave row.
import { MAJOR_CITIES } from "@/config/cities";
function cityScope(region: string): string | null {
  const lower = region.toLowerCase();
  for (const c of MAJOR_CITIES) {
    if (lower.includes(c.toLowerCase())) return c;
  }
  return null;
}

export const heatwave: CounterModule = {
  id: "heatwave",
  async run(): Promise<CounterRunResult> {
    const r = await fetchData();
    if (!r.ok) return { kind: "error", error: r.error };
    const hits = normalize(r.body);
    if (!hits.length) return { kind: "none", reason: "no_heatwave_language" };

    // Prefer severe over regular; bucket by city-scope.
    hits.sort((a, b) =>
      b.classification.localeCompare(a.classification), // "Severe..." wins
    );
    const seen = new Set<string>();
    let last: CounterRunResult = { kind: "none", reason: "no_event" };
    for (const h of hits) {
      const city = cityScope(h.region);
      const key = city ?? "__global__";
      if (seen.has(key)) continue;
      seen.add(key);
      const event = toEvent(h);
      last = {
        kind: "processed",
        result: await processCounter("heatwave", event, city),
      };
    }
    return last;
  },
};
