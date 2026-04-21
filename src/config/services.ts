// Fixed set of services we track for outages and price hikes.
// Keep this list small and stable. Per the spec: "NEVER dynamically change".

export type ServiceDef = {
  id: string;             // lowercase key used everywhere
  label: string;          // human-readable
  downdetectorSlug: string; // path on downdetector.in (no leading slash)
  pricingUrl?: string;    // pricing page for the price-hike scraper
  // How to find a plan's current price on the pricing page. We keep this
  // as a regex applied to the page's visible text - trivial, readable, and
  // easy to maintain without touching HTML selectors constantly.
  priceRegexes?: Array<{ plan: string; regex: string }>;
};

export const TRACKED_SERVICES: readonly ServiceDef[] = [
  {
    id: "jio",
    label: "Jio",
    downdetectorSlug: "jio",
    pricingUrl: "https://www.jio.com/selfcare/plans/mobility/prepaid-plans-list/",
    priceRegexes: [
      { plan: "unlimited-84d", regex: "\\bRs\\.?\\s?(\\d{3,4})[^\\d]{1,30}?84 days" },
    ],
  },
  {
    id: "airtel",
    label: "Airtel",
    downdetectorSlug: "airtel",
    pricingUrl: "https://www.airtel.in/prepaid-plans",
    priceRegexes: [
      { plan: "unlimited-84d", regex: "Rs\\.?\\s?(\\d{3,4})[^\\d]{1,30}?84 Days" },
    ],
  },
  {
    id: "vi",
    label: "Vi (Vodafone Idea)",
    downdetectorSlug: "vi-vodafone-idea",
  },
  {
    id: "netflix",
    label: "Netflix",
    downdetectorSlug: "netflix",
    pricingUrl: "https://help.netflix.com/en/node/24926",
    priceRegexes: [
      { plan: "mobile", regex: "Mobile[^\\d]{1,40}Rs\\.?\\s?(\\d{3,4})" },
      { plan: "basic", regex: "Basic[^\\d]{1,40}Rs\\.?\\s?(\\d{3,4})" },
    ],
  },
  {
    id: "prime",
    label: "Prime Video",
    downdetectorSlug: "amazon-prime-video",
  },
  {
    id: "hotstar",
    label: "Hotstar",
    downdetectorSlug: "hotstar",
    pricingUrl: "https://www.hotstar.com/in/subscribe",
    priceRegexes: [
      { plan: "mobile", regex: "Mobile[^\\d]{1,80}Rs\\.?\\s?(\\d{2,4})" },
      { plan: "super", regex: "Super[^\\d]{1,80}Rs\\.?\\s?(\\d{3,4})" },
    ],
  },
  {
    id: "spotify",
    label: "Spotify",
    downdetectorSlug: "spotify",
    pricingUrl: "https://www.spotify.com/in-en/premium/",
    priceRegexes: [
      { plan: "individual", regex: "Individual[^\\d]{1,60}Rs\\.?\\s?(\\d{2,4})" },
    ],
  },
  {
    id: "youtube-premium",
    label: "YouTube Premium",
    downdetectorSlug: "youtube",
    pricingUrl: "https://www.youtube.com/premium",
  },
] as const;

export const SERVICES_BY_ID = Object.fromEntries(
  TRACKED_SERVICES.map((s) => [s.id, s]),
);
