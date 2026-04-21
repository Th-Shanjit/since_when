import crypto from "node:crypto";

// Deterministic, stable fingerprint for dedupe. Any number of string parts
// are normalised (trim + lowercase) and joined with a separator unlikely to
// appear in inputs. We hash for length safety and ambiguity resistance;
// readability isn't needed since it's an internal key.

export function fingerprint(...parts: Array<string | number | null | undefined>): string {
  const safe = parts
    .map((p) => (p == null ? "" : String(p)))
    .map((p) => p.trim().toLowerCase())
    .join("||");
  return crypto.createHash("sha1").update(safe).digest("hex");
}

// Specific helpers so counter modules read intention-first.
export const fp = {
  cityDate: (city: string, dateIst: string) => fingerprint("aqi", city, dateIst),
  date: (counterId: string, dateIst: string) => fingerprint(counterId, dateIst),
  serviceHour: (service: string, hourIst: string) =>
    fingerprint("outage", service, hourIst),
  regionDate: (counterId: string, region: string, dateIst: string) =>
    fingerprint(counterId, region, dateIst),
  regionStartDate: (region: string, startDateIst: string) =>
    fingerprint("shutdown", region, startDateIst),
  serviceDate: (service: string, dateIst: string) =>
    fingerprint("price", service, dateIst),
  locationDate: (counterId: string, location: string, dateIst: string) =>
    fingerprint(counterId, location, dateIst),
  examDate: (exam: string, dateIst: string) => fingerprint("exam", exam, dateIst),
};
