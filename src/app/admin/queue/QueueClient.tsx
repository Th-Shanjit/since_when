"use client";

import { useMemo, useState } from "react";

type Row = {
  id: number;
  counterId: string;
  scope: string | null;
  counterTitle: string;
  candidateEventTime: string;
  candidateEventTimePretty: string;
  label: string;
  sources: string[];
  fingerprint: string;
  createdAt: string;
};

function hostname(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

export function QueueClient({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [tokenInput, setTokenInput] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canAct = useMemo(() => !!token, [token]);

  async function decide(row: Row, action: "approve" | "reject") {
    if (!token) return;
    setBusy(row.id);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/queue/${row.id}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-8">
      {!token && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setToken(tokenInput.trim() || null);
          }}
          className="mb-8 border border-ink/20 bg-white/40 p-4 flex flex-wrap items-center gap-3"
        >
          <label
            className="uppercase tracking-widest text-ink/70"
            style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
          >
            admin token
          </label>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="flex-1 min-w-[200px] bg-white border border-ink/30 px-3 py-2 text-ink"
            style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
            autoComplete="off"
          />
          <button
            type="submit"
            className="bg-hazard text-ink px-4 py-2 uppercase tracking-widest"
            style={{ fontFamily: "var(--font-stencil)", fontSize: 13 }}
          >
            unlock
          </button>
        </form>
      )}

      {err && (
        <div
          className="mb-4 p-3 border border-caution text-caution"
          style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
        >
          {err}
        </div>
      )}

      {rows.length === 0 && (
        <p
          className="italic text-ink/60"
          style={{ fontFamily: "var(--font-sans)", fontSize: 17 }}
        >
          Nothing in the queue. Automation behaved itself.
        </p>
      )}

      <ul className="space-y-6">
        {rows.map((r) => (
          <li
            key={r.id}
            className="border border-ink/25 bg-white/60 p-5 flex flex-col gap-3"
          >
            <div
              className="flex items-baseline justify-between gap-4 uppercase tracking-wider text-ink/60"
              style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
            >
              <span>
                {r.counterId}
                {r.scope ? ` / ${r.scope}` : ""}
              </span>
              <span>{r.candidateEventTimePretty}</span>
            </div>
            <div
              className="text-ink"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 18,
                lineHeight: 1.25,
              }}
            >
              {r.label}
            </div>
            <ul
              className="flex flex-wrap gap-x-4 gap-y-1 text-ink/80"
              style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
            >
              {r.sources.map((u) => (
                <li key={u}>
                  <a
                    href={u}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-ink"
                  >
                    {hostname(u)}
                  </a>
                </li>
              ))}
            </ul>
            <div className="flex gap-3 pt-1">
              <button
                disabled={!canAct || busy === r.id}
                onClick={() => decide(r, "approve")}
                className="bg-hazard text-ink px-5 py-2 uppercase tracking-widest disabled:opacity-40"
                style={{ fontFamily: "var(--font-stencil)", fontSize: 13 }}
              >
                {busy === r.id ? "working…" : "approve"}
              </button>
              <button
                disabled={!canAct || busy === r.id}
                onClick={() => decide(r, "reject")}
                className="border border-ink/60 text-ink px-5 py-2 uppercase tracking-widest disabled:opacity-40"
                style={{ fontFamily: "var(--font-stencil)", fontSize: 13 }}
              >
                reject
              </button>
              <span
                className="ml-auto text-ink/50"
                style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
              >
                fp {r.fingerprint.slice(0, 12)}…
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
