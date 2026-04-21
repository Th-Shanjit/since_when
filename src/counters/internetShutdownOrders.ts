import * as cheerio from "cheerio";
import { processCounter, YEAR_START_ISO } from "@/core/engine";
import { politeFetch } from "@/core/fetch";
import { fp } from "@/core/fingerprint";
import { toIstParts } from "@/core/time";
import { makeEvent } from "@/core/validate";
import type { CounterModule, CounterRunResult } from "./types";

// SFLC maintains https://internetshutdowns.in/ with a table of every
// confirmed shutdown order. We pull every 2026 row and fire one event per
// (region, startDate) bucket - the engine's yearly-kind processing picks
// up each one as an increment, not a reset, via fingerprint dedupe.
const SFLC_URL = "https://internetshutdowns.in/";

type Shutdown = { region: string; startDateIso: string };

async function fetchData() {
  return politeFetch(SFLC_URL, { counterId: "internetShutdownOrders" });
}

function normalize(html: string): Shutdown[] {
  const $ = cheerio.load(html);
  const out: Shutdown[] = [];
  $("tr").each((_, tr) => {
    const cells = $(tr)
      .find("td")
      .map((__, td) => $(td).text().trim())
      .get();
    if (cells.length < 2) return;
    const dateCell = cells.find((c) => /\b\d{1,2}[-/ ][A-Za-z0-9]{2,9}[-/ ]\d{2,4}\b/.test(c));
    if (!dateCell) return;
    const region = cells.find(
      (c) => c !== dateCell && c.length > 2 && c.length < 60 && /[A-Za-z]/.test(c),
    );
    if (!region) return;
    const d = new Date(dateCell);
    if (Number.isNaN(d.getTime())) return;
    out.push({ region, startDateIso: d.toISOString() });
  });
  return out;
}

export const internetShutdownOrders: CounterModule = {
  id: "internetShutdownOrders",
  async run(): Promise<CounterRunResult> {
    const r = await fetchData();
    if (!r.ok) return { kind: "error", error: r.error };
    const rows = normalize(r.body);
    if (!rows.length) return { kind: "none", reason: "no_rows" };

    const yearStart = new Date(YEAR_START_ISO).getTime();
    const thisYear = rows.filter((s) => new Date(s.startDateIso).getTime() >= yearStart);
    if (!thisYear.length) return { kind: "none", reason: "nothing_in_year" };

    let fired = 0;
    for (const s of thisYear) {
      const { date } = toIstParts(s.startDateIso);
      const event = makeEvent({
        eventTime: s.startDateIso,
        label: `${s.region}: shutdown order`,
        sources: [SFLC_URL],
        fingerprint: fp.regionStartDate(s.region, date),
      });
      const res = await processCounter("internetShutdownOrders", event, null);
      if (res.action === "increment") fired += 1;
    }

    return fired
      ? { kind: "processed", result: { action: "increment", counter_id: "internetShutdownOrders", scope: null, count: fired } }
      : { kind: "none", reason: "no_new_orders" };
  },
};
