// Centralised numbers so reviewers can tune them in one file.

export const THRESHOLDS = {
  aqi: {
    trigger: 300,
  },
  outage: {
    multiplier: 3,
    absoluteMinReports: 100,
    baselineWindowHours: 24,
  },
  fetch: {
    timeoutMs: Number(process.env.FETCH_TIMEOUT_MS ?? 15000),
    retryBackoffMs: 1500,
    failuresBeforeFreeze: 3,
  },
} as const;
