import crypto from "node:crypto";
import { z } from "zod";
import {
  COUNTERS_BY_ID,
  isAllowedScope,
  scopedId,
} from "@/config/counters";
import { insertAlertSubscription } from "@/db/queries";
import { sendEmail, siteUrl } from "@/core/mailer";
import { bad, json } from "../../_shared";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  email: z.string().email(),
  counterId: z.string().min(1),   // def id ("aqi")
  scope: z.string().min(1).max(80).nullable().optional(),
});

function token(): string {
  return crypto.randomBytes(24).toString("base64url");
}

// POST /api/alerts/subscribe { email, counterId, scope? }
// Creates a pending subscription and emails a confirmation link.
// Idempotent: re-subscribing with the same email+scoped counter returns
// { ok:true, status:"already" } without re-sending.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("invalid_json");
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return bad("invalid_input");
  const { email, counterId, scope } = parsed.data;

  const def = COUNTERS_BY_ID[counterId];
  if (!def) return bad("unknown_counter", 404);
  const scopeValue = scope ?? null;
  if (!isAllowedScope(def, scopeValue)) return bad("invalid_scope");

  const id = scopedId(counterId, scopeValue);
  const result = await insertAlertSubscription({
    email: email.toLowerCase(),
    counter_id: id,
    confirm_token: token(),
    unsub_token: token(),
  });

  if (!result.inserted) {
    return json({ ok: true, status: "already", confirmed: !!result.row?.confirmed_at });
  }

  const sub = result.row!;
  const base = siteUrl();
  const confirmUrl = `${base}/api/alerts/confirm?token=${sub.confirm_token}`;
  const unsubUrl = `${base}/api/alerts/unsubscribe?token=${sub.unsub_token}`;
  const label = `${def.title} - ${def.subtitle}${scopeValue ? ` (${scopeValue})` : ""}`;

  await sendEmail({
    to: sub.email,
    subject: "Confirm your Since When alert",
    text:
      `You asked us to ping you when this counter resets:\n\n${label}\n\n` +
      `Confirm: ${confirmUrl}\n\nNot you? Ignore this email. Unsubscribe: ${unsubUrl}\n`,
    html:
      `<p>You asked us to ping you when this counter resets:</p>` +
      `<p><strong>${label}</strong></p>` +
      `<p><a href="${confirmUrl}">Confirm subscription</a></p>` +
      `<p style="color:#666;font-size:12px">Not you? Ignore this email. ` +
      `<a href="${unsubUrl}">Unsubscribe</a>.</p>`,
  });

  return json({ ok: true, status: "pending" });
}
