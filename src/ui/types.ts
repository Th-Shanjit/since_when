// Shared prop contracts between the server-rendered page, the client
// board, the tiles and the modal. Mirrors BoardCounter from boardData.ts
// but stays UI-focused so components can be consumed elsewhere (e.g. the
// standalone /events page) without importing server code.

export type BoardTile = {
  id: string;
  defId: string;
  scope: string | null;
  title: string;
  subtitle: string;
  kind: "auto" | "queue" | "yearly";
  scopeKind: "city" | "service" | "exam" | null;
  scopeOptions: readonly string[];
  daysSince: number | null;
  count: number | null;
  status: "live" | "frozen";
  lastEventAt: string | null;
  lastEventLabel: string | null;
  lastEventSource: string | null;
};

export type EventItem = {
  id: number;
  counterId: string;
  scope: string | null;
  eventTime: string;
  label: string;
  sources: string[];
  fingerprint: string;
  createdAt: string;
};
