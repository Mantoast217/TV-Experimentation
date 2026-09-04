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
  return `${zone.country} — ${zone.city} (${gmtOffsetLabel(zone.offsetHours)})`;
}

export function formatHm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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
