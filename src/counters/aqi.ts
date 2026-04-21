import { processCounter } from "@/core/engine";
import { politeFetch } from "@/core/fetch";
import { fp } from "@/core/fingerprint";
import { toIstParts } from "@/core/time";
import { makeEvent } from "@/core/validate";
import { matchCity } from "@/config/cities";
import { THRESHOLDS } from "@/config/thresholds";
import type { CounterModule, CounterRunResult } from "./types";

// CPCB's public "all stations" JSON feed. Structure varies across deploys,
// so we normalise defensively. If the endpoint moves, the freeze rule
// keeps the counter honest - no reset happens on parse failure.
const CPCB_URL =
  "https://airquality.cpcb.gov.in/dataRepository/all_station_realtime_data.json";

type RawStation = {
  station?: string;
  city?: string;
  state?: string;
  aqi?: string | number;
  last_update?: string;
};

type Normalised = {
  station: string;
  city: string;
  aqi: number;
  measuredAt: string;
};

async function fetchData() {
  return politeFetch(CPCB_URL, { counterId: "aqi" });
}

function normalize(body: string): Normalised[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }
  const rows: RawStation[] = Array.isArray(parsed)
    ? (parsed as RawStation[])
    : Array.isArray((parsed as { data?: unknown })?.data)
    ? ((parsed as { data: RawStation[] }).data)
    : [];

  const out: Normalised[] = [];
  for (const r of rows) {
    const name = (r.station ?? r.city ?? "").toString();
    const city = matchCity(name);
    if (!city) continue;
    const aqiNum = Number(r.aqi);
    if (!Number.isFinite(aqiNum)) continue;
    const measured = (() => {
      const raw = (r.last_update ?? "").toString();
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    })();
    out.push({ station: name, city, aqi: aqiNum, measuredAt: measured });
  }
  return out;
}

// Return one worst-AQI event per (city, date) bucket over the threshold.
function detectEvents(rows: Normalised[]) {
  const bestByCity = new Map<string, Normalised>();
  for (const r of rows) {
    if (r.aqi < THRESHOLDS.aqi.trigger) continue;
    const prev = bestByCity.get(r.city);
    if (!prev || r.aqi > prev.aqi) bestByCity.set(r.city, r);
  }
  return [...bestByCity.values()].map((r) => {
    const { date } = toIstParts(r.measuredAt);
    return {
      city: r.city,
      event: makeEvent({
        eventTime: r.measuredAt,
        label: `${r.city} AQI ${r.aqi} (${r.station})`,
        sources: ["https://airquality.cpcb.gov.in/"],
        fingerprint: fp.cityDate(r.city, date),
      }),
    };
  });
}

export const aqi: CounterModule = {
  id: "aqi",
  async run(): Promise<CounterRunResult> {
    const r = await fetchData();
    if (!r.ok) return { kind: "error", error: r.error };
    const rows = normalize(r.body);
    if (!rows.length) return { kind: "none", reason: "no_stations_matched" };
    const events = detectEvents(rows);
    if (!events.length) return { kind: "none", reason: "under_threshold" };

    // Fire each city's event through the engine. The first processed
    // result bubbles back as the representative return for the runner.
    let last: CounterRunResult = { kind: "none", reason: "no_city_reset" };
    for (const { city, event } of events) {
      const result = processCounter("aqi", event, city);
      last = { kind: "processed", result };
    }
    return last;
  },
};
