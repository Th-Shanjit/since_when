import { log } from "./logger";

// Thin wrapper over Resend's REST API. We avoid the official SDK to keep
// runtime deps lean (undici is already available and good enough for one
// transactional POST). If RESEND_API_KEY is unset, send() returns a
// structured error so callers can log and carry on - alerts are best-
// effort and must never block the engine.

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;
  if (!apiKey || !from) {
    log.warn("resend_not_configured", {});
    return { ok: false, error: "resend_not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `resend_${res.status}:${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id ?? "unknown" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
