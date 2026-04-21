import { log } from "./logger";

// Thin wrapper around Resend's REST API. We call it directly via fetch
// instead of pulling the official SDK - the payload shape is stable and
// this keeps the install graph small.
//
// If RESEND_API_KEY is missing we enter a no-op "dry run" mode: the email
// body is logged instead of sent, so local dev can exercise the full
// subscribe/confirm/unsubscribe flow without needing a provider.

type SendArgs = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendEmail(args: SendArgs): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL ?? "since-when@example.com";

  if (!key) {
    log.info("mail_dryrun", { to: args.to, subject: args.subject });
    return { ok: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        text: args.text,
        html: args.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `resend_${res.status}:${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
