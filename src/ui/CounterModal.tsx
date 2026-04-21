"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SplitFlap } from "./SplitFlap";
import { formatIst } from "@/core/time";
import type { BoardTile, EventItem } from "./types";

// Full-viewport, scroll-locked overlay. Renders the counter's current
// values + its last 5 events + three user actions:
//   - Subscribe by email (double opt-in)
//   - Watch in browser (localStorage watchlist, survives the tab closing)
//   - Share link   (copies a deep-linkable URL with ?open=defId&scope=...)

type Props = {
  defId: string;
  scope: string | null;
  onClose: () => void;
};

const WATCH_KEY = "sincewhen.watchlist";

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function readWatch(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeWatch(items: string[]) {
  try {
    localStorage.setItem(WATCH_KEY, JSON.stringify(items));
  } catch {
    /* quota exceeded, private browsing, etc. */
  }
}

export function CounterModal({ defId, scope, onClose }: Props) {
  const [counter, setCounter] = useState<BoardTile | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [subStatus, setSubStatus] = useState<
    "idle" | "sending" | "sent" | "already" | "error"
  >("idle");
  const [errMsg, setErrMsg] = useState("");
  const [watched, setWatched] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const [embedMsg, setEmbedMsg] = useState("");
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Lock body scroll; restore on unmount.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ESC to close; autofocus the close button.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Fetch counter + last 6 events together.
  useEffect(() => {
    const qs = scope ? `?scope=${encodeURIComponent(scope)}` : "";
    Promise.all([
      fetch(`/api/counter/${encodeURIComponent(defId)}${qs}`, { cache: "no-store" }).then(
        (r) => r.json() as Promise<{ ok: boolean; counter?: BoardTile }>,
      ),
      fetch(
        `/api/events/${encodeURIComponent(defId)}${scope ? `?scope=${encodeURIComponent(scope)}&limit=6` : "?limit=6"}`,
        { cache: "no-store" },
      ).then(
        (r) => r.json() as Promise<{ ok: boolean; events?: EventItem[] }>,
      ),
    ])
      .then(([c, e]) => {
        if (c.ok && c.counter) {
          setCounter(c.counter);
          setWatched(readWatch().includes(c.counter.id));
        }
        if (e.ok && e.events) setEvents(e.events);
      })
      .finally(() => setLoading(false));
  }, [defId, scope]);

  const [hero, ...rest] = events;
  const recent = rest.slice(0, 5);

  const subtitle = counter
    ? counter.subtitle + (counter.scope ? ` - ${counter.scope}` : "")
    : "";

  const shareHref = useMemo(() => {
    if (typeof window === "undefined") return "";
    const u = new URL(window.location.origin + "/");
    u.searchParams.set("open", defId);
    if (scope) u.searchParams.set("scope", scope);
    return u.toString();
  }, [defId, scope]);

  async function submitSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!counter) return;
    setSubStatus("sending");
    setErrMsg("");
    try {
      const res = await fetch("/api/alerts/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, counterId: defId, scope }),
      });
      const j = (await res.json()) as {
        ok: boolean;
        status?: "pending" | "already";
        error?: string;
      };
      if (!res.ok || !j.ok) {
        setSubStatus("error");
        setErrMsg(j.error ?? `HTTP ${res.status}`);
        return;
      }
      setSubStatus(j.status === "already" ? "already" : "sent");
    } catch (err) {
      setSubStatus("error");
      setErrMsg(err instanceof Error ? err.message : String(err));
    }
  }

  function toggleWatch() {
    if (!counter) return;
    const list = readWatch();
    const next = list.includes(counter.id)
      ? list.filter((i) => i !== counter.id)
      : [...list, counter.id];
    writeWatch(next);
    setWatched(next.includes(counter.id));
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(shareHref);
      setShareMsg("link copied");
      setTimeout(() => setShareMsg(""), 1800);
    } catch {
      setShareMsg("copy failed");
    }
  }

  async function downloadSnapshot() {
    const qs = scope ? `?scope=${encodeURIComponent(scope)}` : "";
    const href = `/api/counter/${encodeURIComponent(defId)}/snapshot${qs}`;
    const a = document.createElement("a");
    a.href = href;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function downloadEmbedFile() {
    const qs = scope ? `?scope=${encodeURIComponent(scope)}` : "";
    const href = `/api/counter/${encodeURIComponent(defId)}/embed${qs}`;
    const a = document.createElement("a");
    a.href = href;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function copyEmbedCode() {
    if (typeof window === "undefined") return;
    const qs = scope ? `?scope=${encodeURIComponent(scope)}` : "";
    const src = `${window.location.origin}/api/counter/${encodeURIComponent(defId)}/embed${qs}`;
    const iframe = `<iframe src="${src}" title="sincewhen counter: ${defId}${scope ? ` (${scope})` : ""}" width="560" height="260" style="border:0;max-width:100%;" loading="lazy"></iframe>`;
    try {
      await navigator.clipboard.writeText(iframe);
      setEmbedMsg("embed code copied");
      setTimeout(() => setEmbedMsg(""), 1800);
    } catch {
      setEmbedMsg("copy failed");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-start justify-center p-4 md:p-10 bg-black/85 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-3xl bg-bone border-[6px] border-hazard"
        style={{ borderRadius: 4 }}
      >
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center bg-bone border-[3px] border-hazard text-hazard hover:bg-hazard hover:text-bone"
          style={{ fontFamily: "var(--font-stencil)", fontSize: 16, borderRadius: 999 }}
        >
          x
        </button>

        {/* ------------ Hero strip (tag only) ------------ */}
        <div
          className="px-6 py-2 text-bone flex items-center justify-between"
          style={{ background: "var(--color-hazard)" }}
        >
          <span
            className="tile-kicker"
            style={{ color: "rgba(0,0,0,0.75)" }}
          >
            {counter?.kind === "yearly" ? "Running tally" : "Sensor"}
          </span>
          {counter?.scope ? (
            <span
              className="tile-kicker"
              style={{ color: "rgba(0,0,0,0.6)" }}
            >
              {counter.scope}
            </span>
          ) : null}
        </div>

        <div className="px-6 py-8 md:py-10 flex flex-col items-center">
          {loading && (
            <div
              className="text-paper/50"
              style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
            >
              loading…
            </div>
          )}
          {counter && counter.kind === "yearly" ? (
            <SplitFlap
              value={counter.count}
              minDigits={Math.max(3, String(counter.count ?? 0).length)}
              size="hero"
              animateOnMount
            />
          ) : counter ? (
            <SplitFlap
              value={counter.daysSince}
              minDigits={3}
              size="hero"
              animateOnMount
            />
          ) : null}

          {counter && (
            <>
              <div
                className="mt-4 tile-kicker text-hazard"
                style={{ fontSize: 14 }}
              >
                {counter.kind === "yearly" ? "In 2026" : "Days since"}
              </div>
              <p
                className="mt-2 text-center text-paper font-semibold"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "clamp(1.15rem, 2.2vw, 1.5rem)",
                  lineHeight: 1.3,
                  letterSpacing: "-0.005em",
                }}
              >
                {subtitle}.
              </p>
            </>
          )}

          {hero && (
            <p className="mt-3 text-center text-paper/80 counter-meta">
              &ldquo;{hero.label}&rdquo; ·{" "}
              {formatIst(hero.eventTime, "d MMM yyyy, HH:mm 'IST'")}
            </p>
          )}

          {hero?.sources?.length ? (
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {hero.sources.map((s) => (
                <a
                  key={s}
                  href={s}
                  target="_blank"
                  rel="noreferrer"
                  className="text-hazard hover:underline"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
                >
                  [{hostnameOf(s)}]
                </a>
              ))}
            </div>
          ) : null}
        </div>

        {/* ------------ Last 5 events ------------ */}
        <section className="px-6 pb-6">
          <h3
            className="tile-kicker text-hazard mb-3"
            style={{ fontSize: 13 }}
          >
            Previous 5 entries
          </h3>
          {recent.length === 0 ? (
            <p
              className="text-paper/70 italic"
              style={{ fontFamily: "var(--font-sans)", fontSize: 15 }}
            >
              No earlier entries in the log.
            </p>
          ) : (
            <ol className="space-y-4">
              {recent.map((e) => (
                <li
                  key={e.id}
                  className="border-l-2 border-hazard/60 pl-4"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  <div className="text-paper/70 counter-meta uppercase tracking-wider">
                    {formatIst(e.eventTime, "d MMM yyyy, HH:mm 'IST'")}
                  </div>
                  <div
                    className="text-paper"
                    style={{ fontSize: 16, lineHeight: 1.4, fontWeight: 500 }}
                  >
                    {e.label}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                    {e.sources.map((s) => (
                      <a
                        key={s}
                        href={s}
                        target="_blank"
                        rel="noreferrer"
                        className="text-hazard hover:text-paper counter-meta"
                      >
                        {hostnameOf(s)}
                      </a>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* ------------ Actions ------------ */}
        <section
          className="px-6 py-5 bg-panel border-t border-hazard/30 flex flex-col gap-4"
          style={{ borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }}
        >
          <form onSubmit={submitSubscribe} className="flex flex-wrap items-center gap-2">
            <label
              className="tile-kicker text-hazard"
              style={{ fontSize: 13 }}
            >
              Email me when this resets
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="flex-1 min-w-[220px] bg-bone border border-hazard/60 px-3 py-2 text-paper focus:outline-none focus:border-hazard"
              style={{ fontFamily: "var(--font-sans)", fontSize: 15 }}
              disabled={subStatus === "sending" || subStatus === "sent"}
            />
            <button
              type="submit"
              disabled={subStatus === "sending" || subStatus === "sent"}
              className="bg-hazard text-bone px-4 py-2 uppercase tracking-widest disabled:opacity-40"
              style={{ fontFamily: "var(--font-stencil)", fontSize: 13 }}
            >
              {subStatus === "sending" ? "…" : subStatus === "sent" ? "check email" : "subscribe"}
            </button>
          </form>
          {subStatus === "sent" && (
            <div className="text-paper/80 counter-meta">
              Confirmation link sent. Click it to activate this alert.
            </div>
          )}
          {subStatus === "already" && (
            <div className="text-paper/80 counter-meta">
              You&rsquo;re already subscribed to this counter.
            </div>
          )}
          {subStatus === "error" && (
            <div className="text-caution counter-meta">{errMsg}</div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={toggleWatch}
              className={[
                "px-4 py-2 uppercase tracking-widest border",
                watched
                  ? "bg-hazard text-bone border-hazard"
                  : "bg-transparent text-hazard border-hazard/60 hover:bg-hazard/10",
              ].join(" ")}
              style={{ fontFamily: "var(--font-stencil)", fontSize: 13 }}
            >
              {watched ? "watching" : "watch in browser"}
            </button>
            <button
              type="button"
              onClick={share}
              className="px-4 py-2 uppercase tracking-widest border border-hazard/60 text-hazard hover:bg-hazard/10"
              style={{ fontFamily: "var(--font-stencil)", fontSize: 13 }}
            >
              share link
            </button>
            <button
              type="button"
              onClick={downloadSnapshot}
              className="px-4 py-2 uppercase tracking-widest border border-hazard/60 text-hazard hover:bg-hazard/10"
              style={{ fontFamily: "var(--font-stencil)", fontSize: 13 }}
            >
              download snapshot
            </button>
            <button
              type="button"
              onClick={downloadEmbedFile}
              className="px-4 py-2 uppercase tracking-widest border border-hazard/60 text-hazard hover:bg-hazard/10"
              style={{ fontFamily: "var(--font-stencil)", fontSize: 13 }}
            >
              download embed file
            </button>
            <button
              type="button"
              onClick={copyEmbedCode}
              className="px-4 py-2 uppercase tracking-widest border border-hazard/60 text-hazard hover:bg-hazard/10"
              style={{ fontFamily: "var(--font-stencil)", fontSize: 13 }}
            >
              copy embed code
            </button>
            {shareMsg && (
              <span className="self-center text-paper/80 counter-meta">
                {shareMsg}
              </span>
            )}
            {embedMsg && (
              <span className="self-center text-paper/80 counter-meta">
                {embedMsg}
              </span>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
