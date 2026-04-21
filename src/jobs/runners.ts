import { log } from "@/core/logger";
import { COUNTER_MAP } from "@/counters";
import type { CounterRunResult } from "@/counters/types";

// Each runner batches counters by frequency. Per-counter try/catch so one
// broken fetcher cannot take the whole batch down.

async function runOne(id: string): Promise<CounterRunResult> {
  const mod = COUNTER_MAP[id];
  if (!mod) return { kind: "error", error: `unknown_counter:${id}` };
  try {
    const result = await mod.run();
    log.info("counter_run", { id, result });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("counter_crash", { id, error: msg });
    return { kind: "error", error: msg };
  }
}

async function runBatch(label: string, ids: string[]) {
  log.info("batch_start", { label, ids });
  for (const id of ids) {
    // Sequential keeps us polite to external hosts; there's no urgency
    // that would justify parallel outbound bursts.
    await runOne(id);
  }
  log.info("batch_done", { label });
}

export const runEvery15 = () => runBatch("15m", ["aqi", "internetOutage"]);
export const runHourly = () => runBatch("1h", ["fuel", "heatwave"]);
export const run3Hourly = () =>
  runBatch("3h", ["internetShutdownOrders", "trainAccident"]);
export const run6Hourly = () =>
  runBatch("6h", ["flooding", "examLeak", "priceHike"]);

export const runAllNow = async () => {
  await runEvery15();
  await runHourly();
  await run3Hourly();
  await run6Hourly();
};
