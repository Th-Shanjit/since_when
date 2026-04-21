import { fp } from "@/core/fingerprint";
import { toIstParts } from "@/core/time";
import { MAJOR_CITIES } from "@/config/cities";
import { insertPendingEvent, pendingFingerprintExists } from "@/db/queries";
import { coalesceByBucket, gdeltQuery } from "./_gdelt";
import type { CounterModule, CounterRunResult } from "./types";

// Candidate articles mentioning urban flooding disruption in a MAJOR_CITY.
// Queued for human approval - the one-click pipeline is the classifier.

const QUERY =
  '(flooding OR waterlogging OR "flash flood" OR inundation) AND (traffic OR evacuation OR disrupt OR shut) sourcecountry:IN';

const CITY_RE = new RegExp(`\\b(${MAJOR_CITIES.join("|")})\\b`, "i");

export const flooding: CounterModule = {
  id: "flooding",
  async run(): Promise<CounterRunResult> {
    const cands = await gdeltQuery("flooding", QUERY);
    if (!cands.length) return { kind: "none", reason: "no_candidates" };

    const groups = coalesceByBucket(cands, (c) => {
      const m = c.title.match(CITY_RE);
      if (!m) return null;
      const city = m[1];
      const { date } = toIstParts(c.publishedAt);
      return `${city}||${date}`;
    });

    let added = 0;
    for (const g of groups) {
      const [city, date] = g.bucketKey.split("||");
      const fingerprint = fp.regionDate("flooding", city, date);
      if (pendingFingerprintExists(fingerprint)) continue;
      insertPendingEvent({
        counter_id: "flooding",
        scope: city,
        candidate_event_time: g.publishedAt,
        label: `${city}: ${g.title.slice(0, 180)}`,
        sources: g.sources,
        fingerprint,
      });
      added += 1;
    }
    return added
      ? { kind: "queued", count: added }
      : { kind: "none", reason: "already_queued" };
  },
};
