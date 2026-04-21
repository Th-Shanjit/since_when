import {
  deleteSubscription,
  getSubscriptionByUnsub,
} from "@/db/queries";

export const dynamic = "force-dynamic";

// GET /api/alerts/unsubscribe?token=...
// Single click, no login required. The token is one-per-subscription so
// hitting it removes just that row.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const sub = token ? getSubscriptionByUnsub(token) : undefined;
  if (sub) deleteSubscription(sub.id);

  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Since When</title>` +
      `<style>body{font-family:Georgia,serif;max-width:520px;margin:10vh auto;padding:0 24px;color:#141414}</style>` +
      `</head><body><h1>Unsubscribed</h1>` +
      `<p>You will no longer receive alerts for this counter.</p></body></html>`,
    {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    },
  );
}
