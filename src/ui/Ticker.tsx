import { listRecentEvents } from "@/db/queries";
import { formatIst } from "@/core/time";

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Dignified slow scroll. Two copies back-to-back so the keyframe can
// animate -50% translate seamlessly.
export function Ticker() {
  const rows = listRecentEvents(24);
  if (!rows.length) return null;
  const items = rows.map((r) => {
    const sources = (JSON.parse(r.sources) as string[])[0] ?? "";
    return `${formatIst(r.event_time, "d MMM")} - ${r.label} - ${hostnameOf(sources)}`;
  });
  const line = items.join("   //   ");
  return (
    <div
      className="w-full overflow-hidden border-t border-b border-hazard/40 py-2.5 bg-bone"
      style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
    >
      <div className="ticker-track text-paper/90 uppercase tracking-wider">
        <span className="px-8">{line}</span>
        <span className="px-8">{line}</span>
      </div>
    </div>
  );
}
