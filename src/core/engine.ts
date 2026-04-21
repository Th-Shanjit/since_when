import {
  countEventsSince,
  eventFingerprintExists,
  getCounter,
  insertEvent,
  setCounterPrevValueWithClient,
  tx,
  updateCounterOnResetWithClient,
  type Sql,
} from "@/db/queries";
import { COUNTERS_BY_ID, scopedId } from "@/config/counters";
import { hoursBetween, parseIso } from "./time";
import { log } from "./logger";
import { emitCounterChange } from "./events";
import type { EventData } from "./validate";

export type ProcessResult =
  | { action: "reset"; counter_id: string; scope: string | null }
  | { action: "increment"; counter_id: string; scope: string | null; count: number }
  | {
      action: "skip";
      counter_id: string;
      scope: string | null;
      reason:
        | "invalid"
        | "dup"
        | "unknown_counter"
        | "frozen"
        | "older"
        | "cooldown"
        | "not_resettable";
    };

export const COOLDOWN_HOURS = 24;

// The year that yearly-kind counters tally from. Anything earlier doesn't
// count. All yearly subtitles reference this year explicitly.
export const YEAR_START_ISO = "2026-01-01T00:00:00Z";

export type ProcessCounterOptions = {
  /** When set (e.g. admin approval txn), all writes use this client — no nested txn. */
  db?: Sql;
  /**
   * When `db` is set and the engine schedules log/emit side effects, they are
   * passed here instead of running immediately so the outer transaction can
   * commit first. Required whenever `db` is used and a mutation succeeds.
   */
  onAfterCommit?: (fn: () => void) => void;
};

type RunOutcome = {
  result: ProcessResult;
  afterCommit: (() => void) | null;
};

// Unified entry point. Every reset/increment in the system funnels through
// here - cron, POST /api/manual-event, admin approve. The 5 rules below are
// the spec's safety fence; yearly counters swap rules 3/4 for "event is not
// older than YEAR_START and not already logged" and never cool down.
export async function processCounter(
  counterDefId: string,
  e: EventData,
  scope: string | null = null,
  opts?: ProcessCounterOptions,
): Promise<ProcessResult> {
  const id = scopedId(counterDefId, scope);
  const def = COUNTERS_BY_ID[counterDefId];

  if (!e.isValidEvent) {
    return { action: "skip", counter_id: id, scope, reason: "invalid" };
  }

  const runAll = async (db: Sql): Promise<RunOutcome> => {
    if (await eventFingerprintExists(e.fingerprint, db)) {
      return {
        result: { action: "skip", counter_id: id, scope, reason: "dup" },
        afterCommit: null,
      };
    }

    const c = await getCounter(id, db);
    if (!c || !def) {
      return {
        result: { action: "skip", counter_id: id, scope, reason: "unknown_counter" },
        afterCommit: null,
      };
    }
    if (def.kind === "special") {
      return {
        result: { action: "skip", counter_id: id, scope, reason: "not_resettable" },
        afterCommit: null,
      };
    }
    if (c.status === "frozen") {
      return {
        result: { action: "skip", counter_id: id, scope, reason: "frozen" },
        afterCommit: null,
      };
    }

    // -------------------- yearly-kind: increment path --------------------
    if (def.kind === "yearly") {
      if (parseIso(e.eventTime).getTime() < parseIso(YEAR_START_ISO).getTime()) {
        return {
          result: { action: "skip", counter_id: id, scope, reason: "older" },
          afterCommit: null,
        };
      }
      const primary = e.sources[0] ?? "";

      await insertEvent(
        {
          counter_id: id,
          scope,
          event_time: e.eventTime,
          label: e.label,
          sources: e.sources,
          fingerprint: e.fingerprint,
        },
        db,
      );
      const newCount = await countEventsSince(id, YEAR_START_ISO, db);
      await setCounterPrevValueWithClient(
        db,
        id,
        JSON.stringify({ count: newCount }),
      );
      await updateCounterOnResetWithClient(db, {
        id,
        event_time: e.eventTime,
        label: e.label,
        source: primary,
      });

      const afterCommit = () => {
        log.info("yearly_increment", {
          counter_id: id,
          count: newCount,
          label: e.label,
        });
        emitCounterChange({
          counterId: id,
          counterDefId,
          scope,
          kind: "yearly-increment",
          eventTime: e.eventTime,
          label: e.label,
          source: primary,
          value: newCount,
        });
      };
      return {
        result: { action: "increment", counter_id: id, scope, count: newCount },
        afterCommit,
      };
    }

    // -------------------- auto/queue: reset path --------------------
    if (c.last_event_at) {
      if (parseIso(e.eventTime).getTime() <= parseIso(c.last_event_at).getTime()) {
        return {
          result: { action: "skip", counter_id: id, scope, reason: "older" },
          afterCommit: null,
        };
      }
      if (hoursBetween(e.eventTime, c.last_event_at) < COOLDOWN_HOURS) {
        return {
          result: { action: "skip", counter_id: id, scope, reason: "cooldown" },
          afterCommit: null,
        };
      }
    }

    const primarySource = e.sources[0] ?? "";
    await insertEvent(
      {
        counter_id: id,
        scope,
        event_time: e.eventTime,
        label: e.label,
        sources: e.sources,
        fingerprint: e.fingerprint,
      },
      db,
    );
    await updateCounterOnResetWithClient(db, {
      id,
      event_time: e.eventTime,
      label: e.label,
      source: primarySource,
    });

    const afterCommit = () => {
      log.info("reset", { counter_id: id, label: e.label });
      emitCounterChange({
        counterId: id,
        counterDefId,
        scope,
        kind: "reset",
        eventTime: e.eventTime,
        label: e.label,
        source: primarySource,
      });
    };
    return {
      result: { action: "reset", counter_id: id, scope },
      afterCommit,
    };
  };

  const { result, afterCommit } = opts?.db
    ? await runAll(opts.db)
    : await tx(runAll);

  if (afterCommit) {
    if (!opts?.db) {
      afterCommit();
    } else if (opts.onAfterCommit) {
      opts.onAfterCommit(afterCommit);
    } else {
      throw new Error(
        "processCounter: opts.db requires opts.onAfterCommit when the event mutates state",
      );
    }
  }

  return result;
}
