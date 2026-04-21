// Whitelist of acceptable sources, tiered per the spec.
// Tier 1 (government / official): one source is sufficient.
// Tier 2 (major media): two independent registrable domains are required.
// Unknown domains are explicitly rejected so the golden rule holds.

export type SourceTier = 1 | 2;

const TIER_1: string[] = [
  // central government / regulators
  "pib.gov.in",
  "imd.gov.in",
  "mausam.imd.gov.in",
  "cpcb.gov.in",
  "airquality.cpcb.gov.in",
  "indianrailways.gov.in",
  "rrb.gov.in",
  "mha.gov.in",
  "upsc.gov.in",
  "ssc.gov.in",
  "nta.ac.in",
  "iocl.com",
  "hindustanpetroleum.com",
  "bharatpetroleum.in",
  // authoritative civic data
  "internetshutdowns.in",
  "sflc.in",
];

const TIER_2: string[] = [
  "thehindu.com",
  "indianexpress.com",
  "ndtv.com",
  "timesofindia.indiatimes.com",
  "hindustantimes.com",
  "livemint.com",
  "reuters.com",
  "bbc.com",
  "aljazeera.com",
  "scroll.in",
  "thewire.in",
  "theprint.in",
  "thequint.com",
  "news18.com",
  "deccanherald.com",
  "telegraphindia.com",
  "business-standard.com",
  "moneycontrol.com",
];

export function registrableDomain(urlOrHost: string): string | null {
  try {
    const host = urlOrHost.includes("://")
      ? new URL(urlOrHost).hostname
      : urlOrHost;
    const h = host.toLowerCase().replace(/^www\./, "");
    // Quick two-level registrable domain heuristic; good enough for the
    // whitelisted set (we don't need public-suffix-list sophistication).
    const parts = h.split(".");
    if (parts.length <= 2) return h;
    // handle .co.in / .gov.in / .ac.in / .indiatimes.com-style
    const last = parts[parts.length - 1];
    const second = parts[parts.length - 2];
    const SLD = new Set(["co", "gov", "ac", "nic", "org"]);
    if (SLD.has(second) && last === "in") {
      return parts.slice(-3).join(".");
    }
    return parts.slice(-2).join(".");
  } catch {
    return null;
  }
}

export function tierOf(url: string): SourceTier | null {
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return url.toLowerCase();
    }
  })();
  const match = (list: string[]) =>
    list.some((d) => host === d || host.endsWith(`.${d}`));
  if (match(TIER_1)) return 1;
  if (match(TIER_2)) return 2;
  return null;
}

// Validates a set of source URLs against the tiering rules.
// Returns true if the set is sufficient to justify a reset.
export function sourcesSatisfyTiering(urls: string[]): boolean {
  if (!urls.length) return false;
  const tiers = urls.map(tierOf);
  if (tiers.some((t) => t === 1)) return true;

  // Tier-2 count: two distinct registrable domains, both tier 2.
  const tier2Domains = new Set<string>();
  urls.forEach((u, i) => {
    if (tiers[i] === 2) {
      const d = registrableDomain(u);
      if (d) tier2Domains.add(d);
    }
  });
  return tier2Domains.size >= 2;
}
