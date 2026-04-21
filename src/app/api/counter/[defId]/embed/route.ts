import { COUNTERS_BY_ID, isAllowedScope } from "@/config/counters";
import { loadCounter } from "@/app/boardData";
import { bad } from "@/app/api/_shared";

export const dynamic = "force-dynamic";

function escHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// GET /api/counter/:defId/embed?scope=Delhi
// Returns a downloadable standalone HTML widget file.
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

  const c = await loadCounter(defId, scope);
  if (!c) return bad("not_found", 404);

  const value = c.kind === "yearly" ? String(c.count ?? 0) : String(c.daysSince ?? 0);
  const kicker = c.kind === "yearly" ? "IN 2026" : "DAYS SINCE";
  const subtitle = `${c.subtitle}${c.scope ? ` · ${c.scope}` : ""}`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>sincewhen embed - ${escHtml(c.id)}</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #0d0d0d; color: #f1e9d2; }
    .card { width: min(100%, 560px); margin: 16px auto; border: 4px solid #f4c300; border-radius: 8px; background: #1a1a1a; }
    .body { padding: 20px; text-align: center; }
    .value { font-size: clamp(48px, 12vw, 88px); line-height: 1; font-weight: 800; letter-spacing: -0.03em; }
    .kicker { margin-top: 6px; font-size: 12px; letter-spacing: 0.26em; text-transform: uppercase; color: #f4c300; font-weight: 700; }
    .title { margin-top: 10px; font-size: clamp(18px, 3.5vw, 26px); line-height: 1.2; font-weight: 700; }
    .meta { margin-top: 12px; font-size: 12px; color: #bdb8a6; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .brand { margin-top: 8px; font-size: 11px; letter-spacing: .12em; color: #f4c300; text-transform: uppercase; }
  </style>
</head>
<body>
  <article class="card">
    <div class="body">
      <div class="value">${escHtml(value)}</div>
      <div class="kicker">${escHtml(kicker)}</div>
      <div class="title">${escHtml(subtitle)}</div>
      <div class="meta">${escHtml(c.lastEventAt ?? "no event")}</div>
      <div class="brand">sincewhen</div>
    </div>
  </article>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="${encodeURIComponent(c.id)}-embed.html"`,
    },
  });
}

