import { redirect, notFound } from "next/navigation";
import { COUNTERS_BY_ID, isAllowedScope } from "@/config/counters";

export const dynamic = "force-dynamic";

// The standalone event page was retired in favour of the in-board modal.
// This route now redirects to the board with the modal open via the
// ?open=defId&scope=... deep link - so every old /events/:id URL still
// lands somewhere sensible and shareable.
export default async function EventsRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ counterId: string }>;
  searchParams: Promise<{ scope?: string }>;
}) {
  const { counterId } = await params;
  const { scope } = await searchParams;
  const def = COUNTERS_BY_ID[counterId];
  if (!def || def.kind === "special") notFound();

  const scopeValue = scope ?? def.defaultScope;
  const target = new URLSearchParams();
  target.set("open", counterId);
  if (scopeValue && isAllowedScope(def, scopeValue)) {
    target.set("scope", scopeValue);
  }
  redirect(`/?${target.toString()}#board`);
}
