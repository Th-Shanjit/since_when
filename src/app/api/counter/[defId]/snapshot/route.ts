import { COUNTERS_BY_ID, isAllowedScope } from "@/config/counters";
import { loadCounter } from "@/app/boardData";
import { bad } from "@/app/api/_shared";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// GET /api/counter/:defId/snapshot?scope=Delhi
// Returns a standalone SVG "card" snapshot that users can share or save.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ defId: string }> },
) {
  const { defId } = await ctx.params;
  const def = COUNTERS_BY_ID[defId];
  if (!def) return bad("unknown_counter", 404);

  const url = new URL(req.url);
  const scopeParam = url.searchParams.get("scope");
  const scope = scopeParam && scopeParam.length ? scopeParam : def.defaultScope;
  if (!isAllowedScope(def, scope)) return bad("invalid_scope", 400);

  const c = loadCounter(defId, scope);
  if (!c) return bad("not_found", 404);

  const value = c.kind === "yearly" ? String(c.count ?? 0) : String(c.daysSince ?? 0);
  const kicker = c.kind === "yearly" ? "IN 2026" : "DAYS SINCE";
  const subtitle = `${c.subtitle}${c.scope ? ` · ${c.scope}` : ""}`;
  const updated = c.lastEventAt ? `Last event: ${c.lastEventAt}` : "Last event: no event";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${esc(subtitle)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#161616"/>
      <stop offset="100%" stop-color="#0d0d0d"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="56" y="56" width="1088" height="518" rx="8" fill="#1a1a1a" stroke="#f4c300" stroke-width="8"/>
  <text x="600" y="230" fill="#f1e9d2" text-anchor="middle" font-size="180" font-family="Arial, sans-serif" font-weight="800">${esc(value)}</text>
  <text x="600" y="290" fill="#f4c300" text-anchor="middle" font-size="42" letter-spacing="10" font-family="Arial, sans-serif" font-weight="700">${esc(kicker)}</text>
  <text x="600" y="355" fill="#f1e9d2" text-anchor="middle" font-size="46" font-family="Arial, sans-serif" font-weight="700">${esc(subtitle)}</text>
  <text x="600" y="510" fill="#bdb8a6" text-anchor="middle" font-size="24" font-family="monospace">${esc(updated)}</text>
  <text x="600" y="548" fill="#f4c300" text-anchor="middle" font-size="24" font-family="Arial, sans-serif" font-weight="700">sincewhen • share snapshot</text>
</svg>`;

  return new Response(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${encodeURIComponent(c.id)}-snapshot.svg"`,
    },
  });
}

