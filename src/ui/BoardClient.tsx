"use client";

import { useCallback, useEffect, useState } from "react";
import { SafetySign } from "./SafetySign";
import { YearlyTile } from "./YearlyTile";
import { JobParadoxTile } from "./JobParadoxTile";
import { CounterModal } from "./CounterModal";
import type { BoardTile } from "./types";

// Client wrapper around the board grid. Owns "which modal is open" state
// so tiles stay stateless about the dialog. Also honours ?open=defId&
// scope=... in the URL - used for deep-linked share URLs and email CTAs.

type OpenState = { defId: string; scope: string | null } | null;

export function BoardClient({ counters }: { counters: BoardTile[] }) {
  const [open, setOpen] = useState<OpenState>(null);

  const onOpen = useCallback((defId: string, scope: string | null) => {
    setOpen({ defId, scope });
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      u.searchParams.set("open", defId);
      if (scope) u.searchParams.set("scope", scope);
      else u.searchParams.delete("scope");
      window.history.replaceState({}, "", u.toString());
    }
  }, []);

  const onClose = useCallback(() => {
    setOpen(null);
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      u.searchParams.delete("open");
      u.searchParams.delete("scope");
      window.history.replaceState({}, "", u.toString());
    }
  }, []);

  // Honour ?open=... on mount (covers share links + email click-throughs).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const defId = u.searchParams.get("open");
    if (!defId) return;
    const scope = u.searchParams.get("scope");
    setOpen({ defId, scope });
  }, []);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {counters.map((c) =>
          c.kind === "yearly" ? (
            <YearlyTile key={c.id} {...c} onOpen={onOpen} />
          ) : (
            <SafetySign key={c.id} {...c} onOpen={onOpen} />
          ),
        )}
        <JobParadoxTile />
      </div>

      {open && (
        <CounterModal defId={open.defId} scope={open.scope} onClose={onClose} />
      )}
    </>
  );
}
