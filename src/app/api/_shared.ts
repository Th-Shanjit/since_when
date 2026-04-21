import { NextResponse } from "next/server";

// Shared helpers for API route handlers. Keep this tiny.

export const DYNAMIC_ALWAYS = { dynamic: "force-dynamic" as const };

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

export function unauthorized(message = "unauthorized") {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function requireAdmin(req: Request): true | Response {
  const configured = process.env.ADMIN_TOKEN;
  if (!configured) return unauthorized("admin_token_not_configured");
  const h = req.headers.get("authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (token !== configured) return unauthorized();
  return true;
}
