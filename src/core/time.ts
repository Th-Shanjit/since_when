import { formatInTimeZone, toZonedTime } from "date-fns-tz";

// The entire system's wall-clock is IST. Storage stays UTC ISO 8601;
// rendering and "days since" math happen in Asia/Kolkata.

export const IST = "Asia/Kolkata";

export function nowUtcIso(): string {
  return new Date().toISOString();
}

export function parseIso(s: string): Date {
  return new Date(s);
}

export function toIstParts(iso: string) {
  const d = parseIso(iso);
  return {
    date: formatInTimeZone(d, IST, "yyyy-MM-dd"),
    dateTime: formatInTimeZone(d, IST, "yyyy-MM-dd HH:mm:ss"),
    hour: formatInTimeZone(d, IST, "yyyy-MM-dd-HH"),
    pretty: formatInTimeZone(d, IST, "d MMM yyyy, HH:mm 'IST'"),
  };
}

// Days since `iso` measured in IST calendar days.
// Two events on the same IST calendar date return 0.
export function daysSinceIst(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = toZonedTime(parseIso(iso), IST);
  const now = toZonedTime(new Date(), IST);
  const t = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  const n = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((n - t) / 86_400_000));
}

export function hoursBetween(aIso: string, bIso: string): number {
  return Math.abs(parseIso(aIso).getTime() - parseIso(bIso).getTime()) / 3_600_000;
}

export function formatIst(iso: string, fmt = "d MMM yyyy, HH:mm 'IST'") {
  return formatInTimeZone(parseIso(iso), IST, fmt);
}
