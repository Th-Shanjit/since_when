"use client";

import { Rivets } from "./HazardBorder";
import { SplitFlap } from "./SplitFlap";
import { formatIst } from "@/core/time";
import type { BoardTile } from "./types";

// YTD variant of SafetySign. Same silhouette - yellow frame, stencil
// header, split-flap digits - but the header reads "IN 2026" and the
// digits are a climbing tally instead of a shrinking streak.

export type YearlyTileProps = BoardTile & {
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

export function YearlyTile(props: YearlyTileProps) {
  const frozen = props.status === "frozen";
  const digits = props.count == null ? null : Math.max(0, props.count);
  const minDigits = digits == null ? 3 : Math.max(3, String(digits).length);

  return (
    <div
      className={[
        "relative block",
        "border-[6px]",
        frozen ? "grayscale contrast-75" : "",
      ].join(" ")}
      style={{
        borderRadius: 4,
        background: "var(--color-panel)",
        borderColor: "var(--color-tally)",
        boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.6)",
      }}
    >
      <Rivets />

      {/* Orange header strip just tags the kind. The full reading order -
          "17 / IN 2026 / Internet shutdown orders issued" - lives under the
          digits below so yearly tiles parse the same way as days-since. */}
      <div
        className="px-4 py-2 text-bone flex items-center justify-between gap-3 min-h-[40px]"
        style={{ background: "var(--color-tally)" }}
      >
        <span
          className="tile-kicker inline-flex items-center gap-1"
          style={{ color: "rgba(0,0,0,0.8)" }}
        >
          <span aria-hidden>▲</span>
          Running tally
        </span>
        <span
          className="tile-kicker"
          style={{ color: "rgba(0,0,0,0.55)" }}
        >
          ytd
        </span>
      </div>

      {/* Thin striped belt so the eye registers "this is a different kind
          of counter" before reading any text. */}
      <div className="tally-stripes h-[6px] opacity-90" aria-hidden />

      <button
        type="button"
        onClick={() => props.onOpen?.(props.defId, props.scope)}
        className="block w-full text-left px-6 pt-6 pb-5 flex flex-col items-center transition-transform hover:-translate-y-[1px]"
        style={{ cursor: props.onOpen ? "pointer" : "default" }}
      >
        <div style={{ color: "var(--color-tally)" }}>
          <SplitFlap value={digits} minDigits={minDigits} size="tile" />
        </div>

        <div
          className="mt-3 tile-kicker"
          style={{ color: "var(--color-tally)", fontSize: 13 }}
        >
          In 2026
        </div>

        <h3
          className="mt-2 tile-title text-center text-paper"
          title={props.subtitle}
        >
          {props.subtitle}
        </h3>

        <div className="mt-4 w-full text-center text-paper/75 counter-meta">
          {props.lastEventLabel && (
            <div className="truncate">
              <span className="text-paper/50">last: </span>
              &ldquo;{props.lastEventLabel}&rdquo;
            </div>
          )}
          <div className="mt-1 text-paper/60">
            {props.lastEventAt
              ? `updated ${formatIst(props.lastEventAt, "d MMM yyyy, HH:mm 'IST'")}`
              : "no update"}
            {props.lastEventSource ? " · " + hostnameOf(props.lastEventSource) : ""}
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
