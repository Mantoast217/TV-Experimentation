export interface TimeZoneCatalogEntry {
  id: string;
  /** IANA timezone identifier, e.g. "Europe/London". */
  iana: string;
  country: string;
  /** City shown next to the country when the country isn't specific enough. */
  city?: string;
  /** Short name used to label times in option cards, e.g. "London". */
  name: string;
}

export const TIMEZONE_CATALOG: TimeZoneCatalogEntry[] = [
  { id: "gb", iana: "Europe/London", country: "United Kingdom", name: "London" },
  { id: "us-ny", iana: "America/New_York", country: "United States", city: "New York", name: "New York" },
  { id: "us-la", iana: "America/Los_Angeles", country: "United States", city: "Los Angeles", name: "Los Angeles" },
  { id: "de", iana: "Europe/Berlin", country: "Germany", name: "Berlin" },
  { id: "jp", iana: "Asia/Tokyo", country: "Japan", name: "Tokyo" },
  { id: "in", iana: "Asia/Kolkata", country: "India", name: "Delhi" },
  { id: "au", iana: "Australia/Sydney", country: "Australia", city: "Sydney", name: "Sydney" },
  { id: "br", iana: "America/Sao_Paulo", country: "Brazil", city: "São Paulo", name: "São Paulo" },
];

export const DEFAULT_TIMEZONE_ID = "gb";

/** Offset in minutes such that `localTime = utcTime + offset`. */
function offsetMinutesAt(iana: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: iana,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return (asUtc - at.getTime()) / 60000;
}

export function gmtOffsetLabel(iana: string, dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const refUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const minutes = offsetMinutesAt(iana, refUtc);
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m2 = abs % 60;
  return `GMT${sign}${h}${m2 ? ":" + String(m2).padStart(2, "0") : ""}`;
}

export function zoneDisplayLabel(zone: TimeZoneCatalogEntry, dateStr: string): string {
  const place = zone.city ? `${zone.country} — ${zone.city}` : zone.country;
  return `${place} (${gmtOffsetLabel(zone.iana, dateStr)})`;
}

/** Converts a host-zone wall clock (date + decimal hour) to a UTC instant, in ms. */
export function wallTimeToUtc(iana: string, dateStr: string, hourDecimal: number): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const totalMinutes = Math.round(hourDecimal * 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  const naiveLocalMs = Date.UTC(y, m - 1, d, hh, mm, 0);
  let guess = naiveLocalMs;
  for (let i = 0; i < 3; i++) {
    const offset = offsetMinutesAt(iana, new Date(guess));
    const next = naiveLocalMs - offset * 60000;
    if (next === guess) break;
    guess = next;
  }
  return guess;
}

export interface ZoneWallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** Reads the wall-clock date/time in `iana` at a given UTC instant. */
export function utcToWallTime(iana: string, utcMs: number): ZoneWallTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: iana,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(utcMs));
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

export function formatHm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Whole-day difference between two Y-M-D dates (positive = `b` is later). */
export function daysBetween(dateStr: string, wall: ZoneWallTime): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const a = Date.UTC(y, m - 1, d);
  const b = Date.UTC(wall.year, wall.month - 1, wall.day);
  return Math.round((b - a) / 86400000);
}

export function longDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}
