export type { TimeZoneCatalogEntry } from "./timezoneData";
export { TIMEZONE_CATALOG, DEFAULT_TIMEZONE_ID } from "./timezoneData";

import type { TimeZoneCatalogEntry } from "./timezoneData";

export function gmtOffsetLabel(offsetHours: number): string {
  const sign = offsetHours >= 0 ? "+" : "-";
  const abs = Math.abs(offsetHours);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `GMT${sign}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`;
}

export function zoneDisplayLabel(zone: TimeZoneCatalogEntry): string {
  return `${zone.city} — ${zone.country} (${gmtOffsetLabel(zone.offsetHours)})`;
}

export function formatHm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Converts a wall-clock date + decimal hour in a zone with the given fixed UTC offset
 * into a real UTC instant, e.g. for handing off to calendar APIs/links.
 */
export function wallClockToUtcDate(dateStr: string, hourDecimal: number, offsetHours: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const totalMinutes = Math.round(hourDecimal * 60);
  const naiveUtcMs = Date.UTC(y, m - 1, d, Math.floor(totalMinutes / 60), totalMinutes % 60, 0);
  return new Date(naiveUtcMs - offsetHours * 3600000);
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
