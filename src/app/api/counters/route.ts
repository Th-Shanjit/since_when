import { loadBoard } from "@/app/boardData";
import { json } from "../_shared";

export const dynamic = "force-dynamic";

// Returns the full board as the server-rendered page would render it.
// The client uses this mostly for cold-start hydration; per-tile scope
// swaps hit /api/counter/:id?scope= instead.
export async function GET() {
  const counters = await loadBoard();
  return json({ ok: true, counters });
}
