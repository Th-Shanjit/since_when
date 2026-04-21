import { request } from "undici";
import { log } from "./logger";
import { THRESHOLDS } from "@/config/thresholds";
import { logFetch, markFetchFailure, markFetchSuccess } from "@/db/queries";

// Minimal polite HTTP client: one retry with backoff, per-call timeout,
// identifying User-Agent. Every call writes a row to fetch_log so the
// /api/health endpoint and the UI "sensor offline" state stay honest.

const UA =
  "SinceWhenBot/0.1 (+civic counters; contact: sincewhen@example.invalid)";

export type FetchOk = { ok: true; status: number; body: string };
export type FetchFail = { ok: false; status: number; error: string };
export type FetchResult = FetchOk | FetchFail;

type FetchOptions = {
  counterId: string;                 // for fetch_log + freeze accounting
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  body?: string;
  timeoutMs?: number;
  // If true, do NOT alter counter freeze state on failure. Useful for
  // reference calls (e.g. baseline computation) where we don't want a
  // transient blip to freeze the whole counter.
  passiveFailure?: boolean;
};

export async function politeFetch(
  url: string,
  opts: FetchOptions,
): Promise<FetchResult> {
  const started = Date.now();
  const startedIso = new Date(started).toISOString();
  const timeoutMs = opts.timeoutMs ?? THRESHOLDS.fetch.timeoutMs;

  const attempt = async (): Promise<FetchResult> => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await request(url, {
        method: opts.method ?? "GET",
        headers: {
          "user-agent": UA,
          accept: "*/*",
          ...opts.headers,
        },
        body: opts.body,
        signal: controller.signal,
      });
      const body = await res.body.text();
      if (res.statusCode >= 200 && res.statusCode < 300) {
        return { ok: true, status: res.statusCode, body };
      }
      return {
        ok: false,
        status: res.statusCode,
        error: `HTTP ${res.statusCode}`,
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(t);
    }
  };

  let r = await attempt();
  if (!r.ok) {
    await new Promise((ok) => setTimeout(ok, THRESHOLDS.fetch.retryBackoffMs));
    r = await attempt();
  }

  const duration = Date.now() - started;
  try {
    logFetch({
      counter_id: opts.counterId,
      started_at: startedIso,
      ok: r.ok,
      error: r.ok ? null : r.error,
      duration_ms: duration,
    });
  } catch {
    // logFetch failing should never break a fetch.
  }

  if (!opts.passiveFailure) {
    if (r.ok) {
      markFetchSuccess(opts.counterId);
    } else {
      markFetchFailure(opts.counterId);
      log.warn("fetch_failed", {
        counter_id: opts.counterId,
        url,
        error: r.error,
        status: r.status,
      });
    }
  }
  return r;
}

export async function fetchJson<T = unknown>(
  url: string,
  opts: FetchOptions,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const r = await politeFetch(url, {
    ...opts,
    headers: { accept: "application/json", ...(opts.headers ?? {}) },
  });
  if (!r.ok) return { ok: false, error: r.error };
  try {
    return { ok: true, data: JSON.parse(r.body) as T };
  } catch (err) {
    return {
      ok: false,
      error: `json_parse: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
