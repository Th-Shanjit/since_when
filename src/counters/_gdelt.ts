import { fetchJson } from "@/core/fetch";
import { tierOf } from "@/core/sources";
import { log } from "@/core/logger";

// Lightweight GDELT 2.0 DOC 2.0 API wrapper. Free, no key, India-filtered.
// We use the "artlist" mode which returns recent article URLs matching a
// keyword/theme query. We then filter to Tier-2-whitelisted domains so
// our source set stays defensible.

type GdeltArticle = {
  url: string;
  url_mobile?: string;
  title: string;
  seendate: string; // YYYYMMDDTHHMMSSZ
  socialimage?: string;
  domain: string;
  language?: string;
  sourcecountry?: string;
};

type GdeltResponse = { articles?: GdeltArticle[] };

export type Candidate = {
  title: string;
  url: string;
  domain: string;
  publishedAt: string; // ISO UTC
};

function parseGdeltDate(s: string): string {
  // "20240320T142500Z" -> "2024-03-20T14:25:00Z"
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return new Date().toISOString();
  const [, y, mo, d, h, mi, se] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${se}.000Z`;
}

export async function gdeltQuery(
  counterId: string,
  query: string,
  maxRecords = 40,
): Promise<Candidate[]> {
  if (process.env.GDELT_ENABLED === "false") {
    return [];
  }
  const url =
    `https://api.gdeltproject.org/api/v2/doc/doc` +
    `?query=${encodeURIComponent(query)}` +
    `&mode=artlist&maxrecords=${maxRecords}&format=json` +
    `&sort=datedesc&timespan=7d`;

  const r = await fetchJson<GdeltResponse>(url, {
    counterId,
    passiveFailure: true,
  });
  if (!r.ok) {
    log.warn("gdelt_failed", { counterId, error: r.error });
    return [];
  }
  const articles = r.data.articles ?? [];
  return articles.map((a) => ({
    title: a.title,
    url: a.url,
    domain: a.domain,
    publishedAt: parseGdeltDate(a.seendate),
  }));
}

// Group candidates by a bucket key (e.g. "city/date" or "exam/date").
// Returns groups where at least two distinct registrable tier-2 domains
// are represented OR at least one tier-1 source - honouring the same
// tiering used by the engine.
export function coalesceByBucket(
  cands: Candidate[],
  bucket: (c: Candidate) => string | null,
): Array<{ bucketKey: string; sources: string[]; title: string; publishedAt: string }> {
  const groups = new Map<
    string,
    { bucketKey: string; sources: Map<string, string>; title: string; publishedAt: string }
  >();
  for (const c of cands) {
    const key = bucket(c);
    if (!key) continue;
    const tier = tierOf(c.url);
    if (tier == null) continue; // reject unknown domains
    const g = groups.get(key) ?? {
      bucketKey: key,
      sources: new Map<string, string>(),
      title: c.title,
      publishedAt: c.publishedAt,
    };
    // First URL per domain wins.
    if (!g.sources.has(c.domain)) g.sources.set(c.domain, c.url);
    // Prefer earlier publishedAt (first-report time, per spec)
    if (c.publishedAt < g.publishedAt) {
      g.publishedAt = c.publishedAt;
      g.title = c.title;
    }
    groups.set(key, g);
  }

  const out: Array<{
    bucketKey: string;
    sources: string[];
    title: string;
    publishedAt: string;
  }> = [];
  for (const g of groups.values()) {
    const sources = [...g.sources.values()];
    const anyTier1 = sources.some((u) => tierOf(u) === 1);
    if (anyTier1 || sources.length >= 2) {
      out.push({
        bucketKey: g.bucketKey,
        sources,
        title: g.title,
        publishedAt: g.publishedAt,
      });
    }
  }
  // Newest first
  out.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  return out;
}
