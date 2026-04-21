"use client";

import { useEffect, useRef, useState } from "react";

// Pure-CSS Solari split-flap. Renders digits individually so each
// position flips only when its own value changes. On mount it animates
// once from a placeholder ("0" or " ") to the real value - so first-paint
// users get the satisfying mechanical flip.
//
// Variants:
//   size: 'hero'  -> hero counter (giant)
//         'tile'  -> board tile
//         'mini'  -> job paradox / inline
//
// Pad the number to at least `minDigits` positions with leading zeroes.

type Size = "hero" | "tile" | "mini";

function sizeClasses(size: Size) {
  switch (size) {
    case "hero":
      return "text-[clamp(5rem,18vw,14rem)] leading-none";
    case "tile":
      return "text-[clamp(2.5rem,8vw,4rem)] leading-none";
    case "mini":
    default:
      return "text-[2.25rem] leading-none";
  }
}

function Digit({
  value,
  animateOnMount,
  delay,
}: {
  value: string;
  animateOnMount: boolean;
  delay: number;
}) {
  const [current, setCurrent] = useState<string>(
    animateOnMount ? placeholderFor(value) : value,
  );
  const [flipTo, setFlipTo] = useState<string | null>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current && animateOnMount) {
      firstRender.current = false;
      const t = setTimeout(() => setFlipTo(value), delay);
      return () => clearTimeout(t);
    }
    if (value !== current) setFlipTo(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (flipTo == null) return;
    // Animation duration is 0.9s total (top 0.45 + bottom 0.45).
    const t = setTimeout(() => {
      setCurrent(flipTo);
      setFlipTo(null);
    }, 900);
    return () => clearTimeout(t);
  }, [flipTo]);

  return (
    <div
      className="flap inline-block align-middle mx-[0.08em]"
      style={{ fontFamily: "var(--font-stencil)" }}
    >
      <div className="flap-card px-[0.35em]">
        <div className="flap-half top">
          <span>{flipTo ?? current}</span>
        </div>
        <div className="flap-half bottom">
          <span>{current}</span>
        </div>
        {flipTo !== null && (
          <>
            <div className="flap-flip-top">
              <span>{current}</span>
            </div>
            <div className="flap-flip-bottom">
              <span>{flipTo}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function placeholderFor(v: string): string {
  // If the target is a digit, flip from the digit below it for a more
  // authentic mechanical feel. 0 flips from 9 (wraparound).
  if (/^\d$/.test(v)) {
    const n = Number(v);
    return String((n - 1 + 10) % 10);
  }
  return " ";
}

export function SplitFlap({
  value,
  minDigits = 3,
  size = "tile",
  animateOnMount = false,
}: {
  value: number | null;
  minDigits?: number;
  size?: Size;
  animateOnMount?: boolean;
}) {
  const shown =
    value == null ? "---".padStart(minDigits, "-") : String(value);
  const padded = shown.padStart(minDigits, shown.includes("-") ? "-" : "0");
  const chars = padded.split("");
  return (
    <div className={`inline-flex items-center ${sizeClasses(size)}`}>
      {chars.map((c, i) => (
        <Digit
          key={i}
          value={c}
          animateOnMount={animateOnMount}
          delay={200 + i * 180}
        />
      ))}
    </div>
  );
}
