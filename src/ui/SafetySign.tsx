"use client";

import { useCallback, useState } from "react";
import { Rivets } from "./HazardBorder";
import { SplitFlap } from "./SplitFlap";
import { formatIst } from "@/core/time";
import type { BoardTile } from "./types";

// Board tile: yellow-and-black plaque with corner rivets, stencil header,
// split-flap digits, deadpan description, an offline stamp when the sensor
// is frozen, and - for scoped counters - a small stencil dropdown that
// hot-swaps values in place against /api/counter/:defId?scope=....

export type SafetySignProps = BoardTile & {
  onOpen?: (defId: string, scope: string | null) => void;
};

function hostnameOf(url: string | null) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function SafetySign(props: SafetySignProps) {
  const [tile, setTile] = useState<BoardTile>(props);
  const [loading, setLoading] = useState(false);

  const onOpenCb = props.onOpen;

  const swapScope = useCallback(
    async (scope: string) => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/counter/${encodeURIComponent(tile.defId)}?scope=${encodeURIComponent(scope)}`,
          { cache: "no-store" },
        );
        if (!r.ok) return;
        const j = (await r.json()) as { ok: boolean; counter?: BoardTile };
        if (j.ok && j.counter) setTile(j.counter);
      } finally {
        setLoading(false);
      }
    },
    [tile.defId],
  );

  const frozen = tile.status === "frozen";
  const hasScope = tile.scopeKind != null;

  return (
    <div
      className={[
        "relative block",
        "border-[6px] border-hazard",
        "bg-panel",
        frozen ? "grayscale contrast-75" : "",
      ].join(" ")}
      style={{ borderRadius: 4 }}
    >
      <Rivets />

      {/* Thin yellow header just carries the scope selector (and a tiny
          marker on unscoped tiles). The full reading order -
          "N DAYS SINCE <subtitle>" - lives under the digits below. */}
      <div
        className="text-bone px-4 py-2 flex items-center justify-between gap-3 min-h-[40px]"
        style={{ background: "var(--color-hazard)" }}
      >
        <span
          className="tile-kicker"
          style={{ color: "rgba(0,0,0,0.7)" }}
        >
          Sensor
        </span>
        {hasScope && (
          <label className="flex items-center gap-2">
            <span
              className="tile-kicker"
              style={{ color: "rgba(0,0,0,0.55)" }}
            >
              {tile.scopeKind}
            </span>
            <select
              aria-label={`${tile.scopeKind} scope`}
              value={tile.scope ?? ""}
              disabled={loading}
              onChange={(e) => swapScope(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="bg-bone text-hazard px-2 py-1 focus:outline-none focus:ring-2 focus:ring-bone/40"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.02em",
                border: "1px solid rgba(0,0,0,0.55)",
                borderRadius: 2,
              }}
            >
              {tile.scopeOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <button
        type="button"
        onClick={() => onOpenCb?.(tile.defId, tile.scope)}
        className="block w-full text-left px-6 pt-6 pb-5 flex flex-col items-center transition-transform hover:-translate-y-[1px]"
        style={{ cursor: onOpenCb ? "pointer" : "default" }}
      >
        {/* Reads top-to-bottom as "25 / DAYS SINCE / A passenger train
            accident with casualties". Number is dominant, label is a thin
            stencil connector, subtitle is the bold damning noun. */}
        <div className={`text-paper ${loading ? "opacity-50" : ""}`}>
          <SplitFlap value={tile.daysSince} minDigits={3} size="tile" />
        </div>

        <div
          className="mt-3 tile-kicker text-hazard"
          style={{ fontSize: 13 }}
        >
          Days since
        </div>

        <h3
          className="mt-2 tile-title text-center text-paper"
          title={tile.subtitle}
        >
          {tile.subtitle}
          {tile.scope ? (
            <span className="ml-1 font-semibold text-paper/70">
              · {tile.scope}
            </span>
          ) : null}
        </h3>

        <div className="mt-4 w-full text-center text-paper/75 counter-meta">
          {tile.lastEventLabel && (
            <div className="truncate">
              <span className="text-paper/50">last: </span>
              &ldquo;{tile.lastEventLabel}&rdquo;
            </div>
          )}
          <div className="mt-1 text-paper/60">
            {tile.lastEventAt
              ? formatIst(tile.lastEventAt, "d MMM yyyy, HH:mm 'IST'")
              : "no event"}
            {tile.lastEventSource ? " · " + hostnameOf(tile.lastEventSource) : ""}
          </div>
        </div>
      </button>

      {frozen && (
        <div className="stamp-offline">
          <span>SENSOR OFFLINE</span>
        </div>
      )}
    </div>
  );
}
