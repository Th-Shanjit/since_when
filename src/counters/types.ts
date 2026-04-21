// Shape every counter module implements. The runner in src/jobs/runners.ts
// calls run() in a try/catch; each module returns the processing result.
//
// Queue counters return `kind: 'queued'` when they push to pending_events,
// `kind: 'none'` when nothing newsworthy was found.

import type { ProcessResult } from "@/core/engine";

export type CounterRunResult =
  | { kind: "processed"; result: ProcessResult }
  | { kind: "queued"; count: number }
  | { kind: "none"; reason: string }
  | { kind: "error"; error: string };

export type CounterModule = {
  id: string;
  run: () => Promise<CounterRunResult>;
};
