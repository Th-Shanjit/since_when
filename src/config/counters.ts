// Registry of every counter known to the system.
// The seed, UI, and engine all read from this single source of truth.

import { MAJOR_CITIES } from "./cities";
import { TRACKED_SERVICES } from "./services";
import { EXAMS } from "./exams";

export type CounterKind = "auto" | "queue" | "special" | "yearly";
export type ScopeKind = "city" | "service" | "exam" | null;

export type CounterSeed = {
  event_time: string;
  label: string;
  source: string;
  // For yearly counters, seed a starting count so the board is interesting
  // on day one. Unused for non-yearly kinds.
  count?: number;
};

export type CounterDef = {
  id: string;              // stable def id, e.g. "aqi"
  title: string;           // stencil top-line e.g. "Days since" or "In 2026"
  subtitle: string;        // the damning noun e.g. "City AQI crossed 300"
  kind: CounterKind;
  frequency: "15m" | "1h" | "3h" | "6h" | "never";
  scopeKind: ScopeKind;
  defaultScope: string | null;
  // Scope-specific seed override. Falls back to `seed` when missing.
  scopeSeeds?: Record<string, CounterSeed>;
  seed: CounterSeed;
};

const iso = (daysAgo: number, hourIst = 9) => {
  const d = new Date();
  d.setUTCHours(hourIst - 5, 30, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
};

// Helper for the scoped id stored in `counters.id` and `events_log.counter_id`.
// Callers that don't care about scope pass scope=null and get just the def id.
export function scopedId(defId: string, scope: string | null): string {
  if (scope == null || scope === "") return defId;
  return `${defId}#${scope}`;
}
export function parseScopedId(id: string): { defId: string; scope: string | null } {
  const hash = id.indexOf("#");
  if (hash < 0) return { defId: id, scope: null };
  return { defId: id.slice(0, hash), scope: id.slice(hash + 1) };
}

// ---------------------------------------------------------------------------
// Helpers for picking the allowed-scopes list the UI renders in its <select>.
// ---------------------------------------------------------------------------

const SERVICE_OPTIONS = TRACKED_SERVICES.map((s) => s.label);

export function allowedScopes(def: CounterDef): readonly string[] {
  switch (def.scopeKind) {
    case "city":
      return MAJOR_CITIES;
    case "service":
      return SERVICE_OPTIONS;
    case "exam":
      return EXAMS;
    default:
      return [];
  }
}

export function isAllowedScope(def: CounterDef, scope: string | null): boolean {
  if (def.scopeKind == null) return scope == null || scope === "";
  if (scope == null || scope === "") return false;
  return allowedScopes(def).some((s) => s.toLowerCase() === scope.toLowerCase());
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const COUNTERS: readonly CounterDef[] = [
  {
    id: "aqi",
    title: "Days since",
    subtitle: "AQI crossed 300",
    kind: "auto",
    frequency: "15m",
    scopeKind: "city",
    defaultScope: "Delhi",
    scopeSeeds: {
      Delhi: {
        event_time: iso(0, 8),
        label: "Delhi AQI 412 (Anand Vihar - DPCC)",
        source: "https://airquality.cpcb.gov.in/",
      },
      Mumbai: {
        event_time: iso(7, 9),
        label: "Mumbai AQI 308 (Bandra Kurla Complex - MPCB)",
        source: "https://airquality.cpcb.gov.in/",
      },
      Bengaluru: {
        event_time: iso(22, 10),
        label: "Bengaluru AQI 304 (Silk Board - KSPCB)",
        source: "https://airquality.cpcb.gov.in/",
      },
    },
    seed: {
      event_time: iso(0, 8),
      label: "Delhi AQI 412 (CPCB station avg)",
      source: "https://airquality.cpcb.gov.in/",
    },
  },
  {
    id: "fuel",
    title: "Days since",
    subtitle: "Retail petrol or diesel price changed",
    kind: "auto",
    frequency: "1h",
    scopeKind: null,
    defaultScope: null,
    seed: {
      event_time: iso(2, 6),
      label: "Delhi petrol revised INR 96.72 -> INR 96.89",
      source: "https://iocl.com/petrol-diesel-price",
    },
  },
  {
    id: "heatwave",
    title: "Days since",
    subtitle: "IMD declared a heatwave over this region",
    kind: "auto",
    frequency: "1h",
    scopeKind: "city",
    defaultScope: "Delhi",
    scopeSeeds: {
      Delhi: {
        event_time: iso(5, 12),
        label: "IMD: Heat wave - Delhi NCR",
        source: "https://mausam.imd.gov.in/",
      },
      Nagpur: {
        event_time: iso(3, 14),
        label: "IMD: Severe heat wave - Vidarbha",
        source: "https://mausam.imd.gov.in/",
      },
    },
    seed: {
      event_time: iso(5, 12),
      label: "IMD: Severe heat wave - Vidarbha, Odisha",
      source: "https://mausam.imd.gov.in/",
    },
  },
  {
    id: "internetOutage",
    title: "Days since",
    subtitle: "This online service spiked with outage reports",
    kind: "auto",
    frequency: "15m",
    scopeKind: "service",
    defaultScope: "Jio",
    scopeSeeds: {
      Jio: {
        event_time: iso(3, 19),
        label: "Jio: 5.1x baseline for 23:00-00:00 IST",
        source: "https://downdetector.in/",
      },
      Netflix: {
        event_time: iso(9, 21),
        label: "Netflix: 4.2x baseline for 21:00-22:00 IST",
        source: "https://downdetector.in/",
      },
    },
    seed: {
      event_time: iso(3, 19),
      label: "Jio: 5.1x baseline for 23:00-00:00 IST",
      source: "https://downdetector.in/",
    },
  },
  {
    id: "priceHike",
    title: "Days since",
    subtitle: "This online service raised its price",
    kind: "auto",
    frequency: "6h",
    scopeKind: "service",
    defaultScope: "Netflix",
    scopeSeeds: {
      Netflix: {
        event_time: iso(17, 10),
        label: "Netflix Basic INR 199 -> INR 249",
        source: "https://help.netflix.com/en/node/24926",
      },
      Hotstar: {
        event_time: iso(62, 10),
        label: "Hotstar Mobile INR 149 -> INR 159",
        source: "https://www.hotstar.com/in/subscribe",
      },
    },
    seed: {
      event_time: iso(17, 10),
      label: "Hotstar Mobile INR 149 -> INR 159",
      source: "https://www.hotstar.com/in/subscribe",
    },
  },
  {
    id: "trainAccident",
    title: "Days since",
    subtitle: "A passenger train accident with casualties",
    kind: "queue",
    frequency: "3h",
    scopeKind: null,
    defaultScope: null,
    seed: {
      event_time: iso(34, 7),
      label: "Goods-passenger collision, Andhra Pradesh",
      source: "https://indianrailways.gov.in/",
    },
  },
  {
    id: "flooding",
    title: "Days since",
    subtitle: "Urban flooding disrupted this city",
    kind: "queue",
    frequency: "6h",
    scopeKind: "city",
    defaultScope: "Guwahati",
    scopeSeeds: {
      Guwahati: {
        event_time: iso(0, 2),
        label: "Guwahati: overnight inundation, commutes halted",
        source: "https://www.thehindu.com/",
      },
      Bengaluru: {
        event_time: iso(23, 15),
        label: "Bengaluru waterlogging halts Outer Ring Road",
        source: "https://www.thehindu.com/",
      },
      Mumbai: {
        event_time: iso(48, 11),
        label: "Mumbai: Andheri subway shut after heavy rain",
        source: "https://www.thehindu.com/",
      },
    },
    seed: {
      event_time: iso(23, 15),
      label: "Bengaluru waterlogging halts Outer Ring Road",
      source: "https://www.thehindu.com/",
    },
  },
  {
    id: "examLeak",
    title: "Days since",
    subtitle: "A paper for this exam was compromised",
    kind: "queue",
    frequency: "6h",
    scopeKind: "exam",
    defaultScope: "State PSC",
    scopeSeeds: {
      "State PSC": {
        event_time: iso(46, 9),
        label: "State PSC recruitment paper leak, arrests filed",
        source: "https://www.indianexpress.com/",
      },
      NEET: {
        event_time: iso(120, 11),
        label: "NEET UG: irregularities at multiple centres",
        source: "https://www.thehindu.com/",
      },
    },
    seed: {
      event_time: iso(46, 9),
      label: "State PSC recruitment paper leak, arrests filed",
      source: "https://www.indianexpress.com/",
    },
  },

  // ---------------------- Yearly (since 2026) ----------------------
  {
    id: "cybercrimeCases",
    title: "In 2026",
    subtitle: "Cybercrime cases registered (NCRB / I4C)",
    kind: "yearly",
    frequency: "never",
    scopeKind: null,
    defaultScope: null,
    seed: {
      event_time: "2026-01-02T00:00:00Z",
      label: "Annual tally starts at last published estimate",
      source: "https://ncrb.gov.in/",
      count: 412873,
    },
  },
  {
    id: "financialFraudCases",
    title: "In 2026",
    subtitle: "Financial-fraud cases reported (I4C helpline 1930)",
    kind: "yearly",
    frequency: "never",
    scopeKind: null,
    defaultScope: null,
    seed: {
      event_time: "2026-01-02T00:00:00Z",
      label: "Running tally from I4C dashboards",
      source: "https://cybercrime.gov.in/",
      count: 186540,
    },
  },
  {
    id: "internetShutdownOrders",
    title: "In 2026",
    subtitle: "Internet shutdown orders issued",
    kind: "yearly",
    frequency: "3h",
    scopeKind: null,
    defaultScope: null,
    seed: {
      event_time: "2026-01-05T00:00:00Z",
      label: "Year-to-date from SFLC tracker",
      source: "https://internetshutdowns.in/",
      count: 17,
    },
  },
  {
    id: "parliamentarySittingDays",
    title: "In 2026",
    subtitle: "Days Parliament actually sat",
    kind: "yearly",
    frequency: "never",
    scopeKind: null,
    defaultScope: null,
    seed: {
      event_time: "2026-01-31T00:00:00Z",
      label: "Year-to-date sitting days (PRS Legislative Research)",
      source: "https://prsindia.org/",
      count: 23,
    },
  },

  // ---------------------- Special (not a real counter) ----------------------
  {
    id: "jobParadox",
    title: "Years required",
    subtitle: "for the entry-level role that demands five",
    kind: "special",
    frequency: "never",
    scopeKind: null,
    defaultScope: null,
    seed: {
      event_time: new Date().toISOString(),
      label: "",
      source: "",
    },
  },
] as const;

export const COUNTERS_BY_ID: Record<string, CounterDef> = Object.fromEntries(
  COUNTERS.map((c) => [c.id, c]),
);

// Pick the right seed for a given scope (falls back to def.seed).
export function seedForScope(def: CounterDef, scope: string | null): CounterSeed {
  if (scope && def.scopeSeeds?.[scope]) return def.scopeSeeds[scope];
  return def.seed;
}

// Scope lists that seed.ts iterates over. A def with scopeKind=null yields [null].
export function scopesToSeed(def: CounterDef): Array<string | null> {
  if (def.scopeKind == null) return [null];
  // Seed explicit scopeSeeds only (not every MAJOR_CITIES entry); the rest
  // get lazy-created on first reset. Always include defaultScope too.
  const keys = new Set<string>();
  if (def.defaultScope) keys.add(def.defaultScope);
  if (def.scopeSeeds) for (const k of Object.keys(def.scopeSeeds)) keys.add(k);
  return [...keys];
}
