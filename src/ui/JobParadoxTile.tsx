import { SplitFlap } from "./SplitFlap";
import { Rivets } from "./HazardBorder";

// Not a real counter. Permanently shows 0 - the joke is that the
// "entry-level" role asks for five years of experience and the honest
// answer for most applicants is none. Server-rendered, no effects.
// Rendered in the "circus" colourway so it reads as a deliberate gag and
// never gets mistaken for a real days-since or yearly tile.

export function JobParadoxTile() {
  return (
    <div
      className="relative block border-[6px] bg-panel"
      style={{
        borderRadius: 4,
        borderColor: "var(--color-circus)",
        boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.6)",
      }}
      title="Not a real counter. Purely decorative."
    >
      <Rivets />
      <div
        className="px-4 py-2 text-paper flex items-center justify-between gap-3 min-h-[40px]"
        style={{ background: "var(--color-circus)" }}
      >
        <span
          className="tile-kicker inline-flex items-center gap-1"
          style={{ color: "rgba(255,255,255,0.9)" }}
        >
          <span aria-hidden style={{ fontSize: 14, letterSpacing: 0 }}>
            🤡
          </span>
          Not a real counter
        </span>
        <span
          className="tile-kicker"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          specimen
        </span>
      </div>

      <div className="circus-stripes h-[6px]" aria-hidden />

      <div className="px-6 pt-6 pb-5 flex flex-col items-center">
        {/* Same reading order as real counters:
            "00 / DAYS SINCE / a company did not ask..." */}
        <div style={{ color: "var(--color-circus)" }}>
          <SplitFlap value={0} minDigits={2} size="tile" animateOnMount={false} />
        </div>
        <div
          className="mt-3 tile-kicker"
          style={{ color: "var(--color-circus)", fontSize: 13 }}
        >
          Days since
        </div>
        <h3 className="mt-2 tile-title text-center text-paper">
          a company did not ask for five years&rsquo; experience in an
          &ldquo;entry-level&rdquo; role
        </h3>
        <div className="mt-4 text-center text-paper/70 counter-meta">
          purely decorative · always zero · not a real counter
        </div>
      </div>
    </div>
  );
}
