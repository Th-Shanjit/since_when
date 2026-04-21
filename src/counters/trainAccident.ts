import { fp } from "@/core/fingerprint";
import { toIstParts } from "@/core/time";
import { insertPendingEvent, pendingFingerprintExists } from "@/db/queries";
import { coalesceByBucket, gdeltQuery } from "./_gdelt";
import type { CounterModule, CounterRunResult } from "./types";

// Pulls candidate articles mentioning passenger train incidents with
// casualties. We DO NOT reset automatically - candidates go to
// pending_events for human approval via /admin/queue.

const QUERY =
  '(train AND (derail OR accident OR collision)) AND (injured OR killed OR death OR casualty) sourcecountry:IN';

const PLACE_RE =
  /\b(in|near|at)\s+([A-Z][A-Za-z-]+(?:\s+[A-Z][A-Za-z-]+){0,2})/;

export const trainAccident: CounterModule = {
  id: "trainAccident",
  async run(): Promise<CounterRunResult> {
    const cands = await gdeltQuery("trainAccident", QUERY);
    if (!cands.length) return { kind: "none", reason: "no_candidates" };

    const groups = coalesceByBucket(cands, (c) => {
      // bucket by first extracted place + IST calendar date
      const m = c.title.match(PLACE_RE);
      const place = m?.[2]?.toLowerCase() ?? c.domain;
      const { date } = toIstParts(c.publishedAt);
      return `${place}||${date}`;
    });

    let added = 0;
    for (const g of groups) {
      const fingerprint = fp.locationDate(
        "trainAccident",
        g.bucketKey.split("||")[0],
        g.bucketKey.split("||")[1],
      );
      if (await pendingFingerprintExists(fingerprint)) continue;
      await insertPendingEvent({
        counter_id: "trainAccident",
        scope: null,
        candidate_event_time: g.publishedAt,
        label: g.title.slice(0, 200),
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
