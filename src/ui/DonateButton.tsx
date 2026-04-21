// Floating bottom-right pill. Pure CSS pizza slice - a triangle crust with
// three dot toppings - no third-party embed, no image asset. Href comes
// from NEXT_PUBLIC_DONATE_URL so it can point to BMC / Ko-fi / UPI.
// Renders nothing if the env var is missing so the bottom-right stays
// clean in dev and on forks that don't have a donate target.

export function DonateButton() {
  const href = process.env.NEXT_PUBLIC_DONATE_URL;
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-5 right-5 z-[120] group"
      aria-label="Support this project"
      style={{ textDecoration: "none" }}
    >
      <div
        className="flex items-center gap-2 pl-2 pr-4 py-2 bg-hazard text-bone shadow-lg transition-transform group-hover:-translate-y-[1px]"
        style={{
          fontFamily: "var(--font-stencil)",
          fontSize: 13,
          letterSpacing: "0.2em",
          borderRadius: 999,
          boxShadow: "0 6px 16px rgba(0,0,0,0.45)",
        }}
      >
        <span
          aria-hidden
          className="relative inline-block"
          style={{
            width: 22,
            height: 22,
          }}
        >
          <span
            style={{
              position: "absolute",
              inset: 0,
              background: "#f6c04a",
              clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
              borderRadius: 2,
            }}
          />
          <span
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              background: "#8a3d1a",
              clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
            }}
          />
          <span
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              width: 3,
              height: 3,
              background: "#c8102e",
              borderRadius: 999,
            }}
          />
          <span
            style={{
              position: "absolute",
              top: 12,
              left: 13,
              width: 3,
              height: 3,
              background: "#c8102e",
              borderRadius: 999,
            }}
          />
          <span
            style={{
              position: "absolute",
              top: 14,
              left: 6,
              width: 3,
              height: 3,
              background: "#c8102e",
              borderRadius: 999,
            }}
          />
        </span>
        buy me a pizza slice
      </div>
    </a>
  );
}
