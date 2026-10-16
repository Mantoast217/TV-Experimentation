import { DateTime } from "luxon";

export function inZone(instant: Date, zone: string): DateTime {
  return DateTime.fromJSDate(instant, { zone });
}

/** The instant a wall-clock time happens in a zone. A time skipped by a clock change moves forward. */
export function wallTimeToInstant(isoDate: string, hhmm: string, zone: string): Date {
  return DateTime.fromISO(`${isoDate}T${hhmm}`, { zone }).toJSDate();
}

export function formatTime(dateTime: DateTime): string {
  return dateTime.toFormat("HH:mm");
}

/** Whole calendar days from one "YYYY-MM-DD" date to another. */
export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  const from = DateTime.fromISO(fromIsoDate, { zone: "utc" });
  const to = DateTime.fromISO(toIsoDate, { zone: "utc" });
  return Math.round(to.diff(from, "days").days);
}

export function addDays(isoDate: string, days: number): string {
  return DateTime.fromISO(isoDate, { zone: "utc" }).plus({ days }).toISODate()!;
}

export function isValidTimeZone(zone: string): boolean {
  return DateTime.now().setZone(zone).isValid;
}

/** The viewer's own zone. Kept out of the pure functions, which always take the zone as an argument. */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
