import type { CounterModule } from "./types";
import { aqi } from "./aqi";
import { fuel } from "./fuel";
import { heatwave } from "./heatwave";
import { internetOutage } from "./internetOutage";
import { priceHike } from "./priceHike";
import { trainAccident } from "./trainAccident";
import { flooding } from "./flooding";
import { examLeak } from "./examLeak";
import { internetShutdownOrders } from "./internetShutdownOrders";

export const ALL_COUNTERS: readonly CounterModule[] = [
  aqi,
  fuel,
  heatwave,
  internetOutage,
  priceHike,
  trainAccident,
  flooding,
  examLeak,
  internetShutdownOrders,
] as const;

export const COUNTER_MAP: Record<string, CounterModule> = Object.fromEntries(
  ALL_COUNTERS.map((c) => [c.id, c]),
);
