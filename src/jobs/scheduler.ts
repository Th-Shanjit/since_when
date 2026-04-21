import cron from "node-cron";
import { log } from "@/core/logger";
import {
  runEvery15,
  runHourly,
  run3Hourly,
  run6Hourly,
} from "./runners";

const IST = "Asia/Kolkata";

export function startScheduler() {
  log.info("scheduler_start", { tz: IST });

  // Every 15 minutes: AQI, Internet outages
  cron.schedule("*/15 * * * *", () => void runEvery15(), { timezone: IST });

  // Every 1 hour: Fuel, Heatwave
  cron.schedule("0 * * * *", () => void runHourly(), { timezone: IST });

  // Every 3 hours: Shutdowns, Train accidents (candidates)
  cron.schedule("0 */3 * * *", () => void run3Hourly(), { timezone: IST });

  // Every 6 hours: Flooding, Exam leaks, Price hikes
  cron.schedule("0 */6 * * *", () => void run6Hourly(), { timezone: IST });

  log.info("scheduler_armed", {
    schedules: ["*/15", "hourly", "every_3h", "every_6h"],
  });
}
