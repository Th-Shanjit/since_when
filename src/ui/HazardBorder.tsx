// Purely decorative top/bottom hazard-stripe rails. Server component.

export function HazardBorder({
  position = "top",
  height = 10,
}: {
  position?: "top" | "bottom";
  height?: number;
}) {
  return (
    <div
      aria-hidden
      className="hazard-stripes w-full"
      style={{
        height,
        boxShadow:
          position === "top"
            ? "inset 0 -1px 0 rgba(0,0,0,0.6)"
            : "inset 0 1px 0 rgba(0,0,0,0.6)",
      }}
    />
  );
}

export function Rivets() {
  return (
    <>
      <span className="rivet" style={{ top: 6, left: 6 }} />
      <span className="rivet" style={{ top: 6, right: 6 }} />
      <span className="rivet" style={{ bottom: 6, left: 6 }} />
      <span className="rivet" style={{ bottom: 6, right: 6 }} />
    </>
  );
}
