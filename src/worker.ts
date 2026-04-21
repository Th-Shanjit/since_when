// Cron worker entry. Run with `tsx src/worker.ts` alongside `next start`.
//
// On boot:
//   1. Open DB + apply schema
//   2. Seed counters (idempotent)
//   3. Kick off the node-cron schedules (pinned to Asia/Kolkata)
//   4. Do NOT run a full sweep immediately - the first scheduled tick
//      will pick everything up within ~15 minutes. Running on boot would
//      cause thundering-herd outbound requests on every deploy.

import { log } from "@/core/logger";
import { getDb, closeDb } from "@/db/client";
import { seed } from "@/db/seed";
import { startScheduler } from "@/jobs/scheduler";
import { runAllNow } from "@/jobs/runners";
import { startAlertsWorker } from "@/jobs/alertsWorker";

async function main() {
  getDb();
  seed();
  startAlertsWorker();

  if (process.env.RUN_ON_BOOT === "true") {
    log.info("run_on_boot", {});
    await runAllNow();
  }
  startScheduler();

  const stop = (sig: string) => {
    log.info("shutdown", { sig });
    closeDb();
    process.exit(0);
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));
}

main().catch((err) => {
  log.error("worker_fatal", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
