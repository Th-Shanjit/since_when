import { loadBoard, pickHero } from "./boardData";
import { SplitFlap } from "@/ui/SplitFlap";
import { HazardBorder } from "@/ui/HazardBorder";
import { Ticker } from "@/ui/Ticker";
import { BoardClient } from "@/ui/BoardClient";
import { formatIst } from "@/core/time";

export const dynamic = "force-dynamic";

function hostnameOf(url: string | null) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function HomePage() {
  const counters = loadBoard();
  const hero = pickHero(counters);
  const heroIsYearly = hero.kind === "yearly";

  return (
    <main className="min-h-screen bg-bone text-paper">
      <HazardBorder position="top" />

      {/* ---------- HERO ---------- */}
      <section className="max-w-[1200px] mx-auto px-6 pt-12 pb-16 md:pt-20 md:pb-24 text-center">
        <div
          className="uppercase tracking-[0.35em] text-hazard/80"
          style={{ fontFamily: "var(--font-stencil)", fontSize: 14 }}
        >
          Since When
        </div>

        <h1
          className="mt-6 text-paper"
          style={{
            fontFamily: "var(--font-stencil)",
            letterSpacing: "0.12em",
            fontSize: "clamp(1.4rem, 3vw, 2rem)",
          }}
        >
          {heroIsYearly ? "IN 2026" : "IT HAS BEEN"}
        </h1>

        <div className="mt-4 md:mt-6 flex justify-center">
          <SplitFlap
            value={heroIsYearly ? hero.count : hero.daysSince}
            minDigits={
              heroIsYearly ? Math.max(3, String(hero.count ?? 0).length) : 3
            }
            size="hero"
            animateOnMount
          />
        </div>

        {!heroIsYearly && (
          <h2
            className="mt-4"
            style={{
              fontFamily: "var(--font-stencil)",
              letterSpacing: "0.12em",
              fontSize: "clamp(1rem, 2.2vw, 1.6rem)",
            }}
          >
            DAYS SINCE
          </h2>
        )}

        <p
          className="mt-4 max-w-3xl mx-auto text-paper font-semibold"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(1.25rem, 2.6vw, 1.9rem)",
            lineHeight: 1.25,
            letterSpacing: "-0.01em",
          }}
        >
          {hero.subtitle}
          {hero.scope ? ` · ${hero.scope}` : ""}.
        </p>

        <p
          className="mt-4 text-paper/75 counter-meta"
        >
          {hero.lastEventLabel && <>&ldquo;{hero.lastEventLabel}&rdquo; · </>}
          {hero.lastEventAt ? formatIst(hero.lastEventAt) : "no event"}
          {hero.lastEventSource ? " · " + hostnameOf(hero.lastEventSource) : ""}
        </p>

        <p
          className="mt-10 text-paper/80"
          style={{ fontFamily: "var(--font-sans)", fontSize: 16, lineHeight: 1.5 }}
        >
          Keeping India&rsquo;s streaks honest. Updated every 15 minutes.
        </p>

        <a
          href="#board"
          className="mt-6 inline-block text-hazard hover:text-paper tile-kicker"
        >
          view the full board ↓
        </a>
      </section>

      <Ticker />

      {/* ---------- BOARD ---------- */}
      <section id="board" className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="flex items-baseline justify-between mb-8">
          <h3
            className="uppercase tracking-[0.35em]"
            style={{
              fontFamily: "var(--font-stencil)",
              fontSize: 16,
              color: "var(--color-hazard)",
            }}
          >
            The Board
          </h3>
          <div className="text-paper/75 counter-meta">
            IST · {formatIst(new Date().toISOString(), "d MMM yyyy, HH:mm")}
          </div>
        </div>

        <BoardClient counters={counters} />
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="border-t border-hazard/30 mt-10">
        <HazardBorder position="bottom" height={6} />
        <div
          className="max-w-[1200px] mx-auto px-6 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-paper/80 counter-meta"
        >
          <div>
            Since When - every reset is logged, fingerprinted and defensible.
            If we are unsure, we do not reset.
          </div>
          <div className="flex gap-4">
            <a
              href="/api/health"
              className="hover:text-hazard"
              target="_blank"
              rel="noreferrer"
            >
              sensor health
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
