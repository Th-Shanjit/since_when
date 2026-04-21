import { recentFetchHealth } from "@/db/queries";
import { json } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await recentFetchHealth(1);
  const now = new Date().toISOString();
  return json({
    ok: true,
    now,
    window_hours: 1,
    counters: rows,
  });
}
