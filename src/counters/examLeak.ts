import { fp } from "@/core/fingerprint";
import { toIstParts } from "@/core/time";
import { EXAMS } from "@/config/exams";
import { insertPendingEvent, pendingFingerprintExists } from "@/db/queries";
import { coalesceByBucket, gdeltQuery } from "./_gdelt";
import type { CounterModule, CounterRunResult } from "./types";

// Candidate articles mentioning a confirmed exam paper leak.
// Match only the fixed EXAMS list - per the spec, that list never grows
// dynamically. Queued for human approval.

const QUERY =
  '("paper leak" OR "question paper leaked" OR "paper leaked") AND (UPSC OR SSC OR NEET OR JEE OR "State PSC" OR RRB OR CBSE OR CUET OR CAT) sourcecountry:IN';

const EXAM_RE = new RegExp(`\\b(${EXAMS.join("|")})\\b`, "i");

export const examLeak: CounterModule = {
  id: "examLeak",
  async run(): Promise<CounterRunResult> {
    const cands = await gdeltQuery("examLeak", QUERY);
    if (!cands.length) return { kind: "none", reason: "no_candidates" };

    const groups = coalesceByBucket(cands, (c) => {
      const m = c.title.match(EXAM_RE);
      if (!m) return null;
      const exam = m[1].toUpperCase();
      const { date } = toIstParts(c.publishedAt);
      return `${exam}||${date}`;
    });

    let added = 0;
    for (const g of groups) {
      const [exam, date] = g.bucketKey.split("||");
      const fingerprint = fp.examDate(exam, date);
      if (pendingFingerprintExists(fingerprint)) continue;
      insertPendingEvent({
        counter_id: "examLeak",
        scope: exam,
        candidate_event_time: g.publishedAt,
        label: `${exam}: ${g.title.slice(0, 180)}`,
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
