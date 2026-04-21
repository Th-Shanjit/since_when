// Tiny in-process event bus. The engine calls emitCounterChange() after a
// successful reset or yearly increment; the alerts worker (and any other
// side-channel consumer) subscribes via onCounterChange(). Kept dependency-
// free so both the Next.js web server and the node-cron worker can import
// it without pulling extra modules into the browser bundle.

export type CounterChangeEvent = {
  counterId: string;         // scoped id, e.g. "aqi#Delhi"
  counterDefId: string;      // "aqi"
  scope: string | null;
  kind: "reset" | "yearly-increment";
  eventTime: string;
  label: string;
  source: string;
  value?: number | null;     // days-since for reset, count for yearly
};

type Listener = (e: CounterChangeEvent) => void | Promise<void>;

const listeners = new Set<Listener>();

export function onCounterChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitCounterChange(e: CounterChangeEvent): void {
  // Fire-and-forget: listener errors must not affect the engine's return.
  for (const fn of listeners) {
    try {
      const maybe = fn(e);
      if (maybe && typeof (maybe as Promise<unknown>).catch === "function") {
        (maybe as Promise<unknown>).catch(() => {});
      }
    } catch {
      // swallow
    }
  }
}
