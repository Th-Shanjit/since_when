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
  const outer = opts?.db;
  const def = COUNTERS_BY_ID[counterDefId];
  const id = scopedId(counterDefId, scope);

  if (!e.isValidEvent) {
    return { action: "skip", counter_id: id, scope, reason: "invalid" };
  }
  if (await eventFingerprintExists(e.fingerprint, outer)) {
    return { action: "skip", counter_id: id, scope, reason: "dup" };
  }

  const c = await getCounter(id, outer);
  if (!c) {
    return { action: "skip", counter_id: id, scope, reason: "unknown_counter" };
  }
  if (!def) {
    return { action: "skip", counter_id: id, scope, reason: "unknown_counter" };
  }
  if (def.kind === "special") {
    return { action: "skip", counter_id: id, scope, reason: "not_resettable" };
  }
  if (c.status === "frozen") {
    return { action: "skip", counter_id: id, scope, reason: "frozen" };
  }

  // -------------------- yearly-kind: increment path --------------------
  if (def.kind === "yearly") {
    if (parseIso(e.eventTime).getTime() < parseIso(YEAR_START_ISO).getTime()) {
      return { action: "skip", counter_id: id, scope, reason: "older" };
    }
    const primary = e.sources[0] ?? "";
    let newCount = 0;

    const runYearly = async (db: Sql) => {
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
      newCount = await countEventsSince(id, YEAR_START_ISO, db);
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
    };

    if (outer) {
      await runYearly(outer);
    } else {
      await tx(runYearly);
    }

    log.info("yearly_increment", { counter_id: id, count: newCount, label: e.label });
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
    return { action: "increment", counter_id: id, scope, count: newCount };
  }

  // -------------------- auto/queue: reset path --------------------
  if (c.last_event_at) {
    if (parseIso(e.eventTime).getTime() <= parseIso(c.last_event_at).getTime()) {
      return { action: "skip", counter_id: id, scope, reason: "older" };
    }
    if (hoursBetween(e.eventTime, c.last_event_at) < COOLDOWN_HOURS) {
      return { action: "skip", counter_id: id, scope, reason: "cooldown" };
    }
  }

  const primarySource = e.sources[0] ?? "";

  const runReset = async (db: Sql) => {
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
  };

  if (outer) {
    await runReset(outer);
  } else {
    await tx(runReset);
  }

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
  return { action: "reset", counter_id: id, scope };
}
