import {
  confirmSubscription,
  getSubscriptionByConfirm,
} from "@/db/queries";

export const dynamic = "force-dynamic";

// GET /api/alerts/confirm?token=...
// Double opt-in landing: clicking the link in the confirm email flips
// confirmed_at on the pending row. Renders a minimal HTML receipt so a
// real user hitting it in a browser sees something, not raw JSON.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const sub = token ? await getSubscriptionByConfirm(token) : undefined;

  if (!sub) return html(404, "Invalid or expired link.");
  if (!sub.confirmed_at) await confirmSubscription(sub.id);

  return html(
    200,
    `<h1>Alert confirmed</h1>` +
      `<p>We will email you the next time this counter resets.</p>`,
  );
}

function html(status: number, body: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>Since When</title>` +
      `<style>body{font-family:Georgia,serif;max-width:520px;margin:10vh auto;padding:0 24px;color:#141414}</style>` +
      `</head><body>${body}</body></html>`,
    {
      status,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    },
  );
}
