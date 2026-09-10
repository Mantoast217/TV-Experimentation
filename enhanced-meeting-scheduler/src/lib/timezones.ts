export type { TimeZoneCatalogEntry } from "./timezoneData";
export { TIMEZONE_CATALOG, DEFAULT_TIMEZONE_ID } from "./timezoneData";

import { DateTime } from "luxon";
import type { TimeZoneCatalogEntry } from "./timezoneData";

/**
 * The UTC offset (in decimal hours) for `timezone` on the given calendar date. Computed
 * live via Luxon/Intl for that specific date rather than stored, since a zone's offset
 * changes across DST transitions — e.g. Europe/London is +0 in January and +1 in July.
 */
export function offsetHoursOn(timezone: string, dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = DateTime.fromObject({ year: y, month: m, day: d }, { zone: timezone });
  return dt.offset / 60;
}

export function gmtOffsetLabel(timezone: string, dateStr: string): string {
  const offsetHours = offsetHoursOn(timezone, dateStr);
  const sign = offsetHours >= 0 ? "+" : "-";
  const abs = Math.abs(offsetHours);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `GMT${sign}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`;
}

/**
 * Picks `zone`'s real IANA/tzdb abbreviation (e.g. "BST", "IST", "CST") for `dateStr` —
 * its daylight-saving abbreviation if that date falls in DST for the zone, otherwise its
 * standard one — or null if tzdb has no traditional letter abbreviation for it at all
 * (some zones only ever get a numeric-offset form; see scripts/tzPosixFooter.mjs).
 *
 * Deliberately NOT deduplicated against other zones showing the same abbreviation: IST is
 * India, Ireland, *and* Israel; CST is China, Cuba, *and* US Central — all real, all kept,
 * since the city/country the abbreviation sits next to is what disambiguates it, not the
 * abbreviation itself. This also means it's not compared against gmtOffsetLabel's output
 * the way the earlier Intl-based version was — a tzdb-assigned abbreviation is never
 * shaped like "GMT+9", so there's nothing redundant to filter out.
 */
export function zoneAbbreviation(zone: TimeZoneCatalogEntry, dateStr: string): string | null {
  if (!zone.stdAbbreviation && !zone.dstAbbreviation) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = DateTime.fromObject({ year: y, month: m, day: d }, { zone: zone.timezone });
  if (dt.isInDST && zone.dstAbbreviation) return zone.dstAbbreviation;
  return zone.stdAbbreviation ?? null;
}

/**
 * Just the abbreviation/offset portion of zoneDisplayLabel, e.g. "IST / GMT+5:30" or
 * "GMT+9" when the zone has no traditional abbreviation — for anything that needs a
 * zone's current time label without repeating the city/country part, such as a
 * colleague's search result or participant chip, which already show their name and city.
 */
export function zoneTimeLabel(zone: TimeZoneCatalogEntry, dateStr: string): string {
  const offset = gmtOffsetLabel(zone.timezone, dateStr);
  const abbrev = zoneAbbreviation(zone, dateStr);
  return abbrev ? `${abbrev} / ${offset}` : offset;
}

export function zoneDisplayLabel(zone: TimeZoneCatalogEntry, dateStr: string): string {
  return `${zone.city} — ${zone.country} (${zoneTimeLabel(zone, dateStr)})`;
}

export function formatHm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Converts a wall-clock date + decimal hour (may fall outside [0, 24), e.g. a start hour
 * plus a duration that crosses midnight) in the given IANA zone into a real UTC instant,
 * e.g. for handing off to calendar APIs/links. DST-aware: the same wall-clock time
 * resolves to a different UTC instant depending on which side of a DST transition
 * `dateStr` falls on.
 *
 * Builds the target hour/minute directly via `DateTime.fromObject` rather than adding
 * minutes to midnight: Luxon's `.plus({ minutes })` adds real elapsed time, not
 * wall-clock time, so on a DST transition day that would silently land on the wrong
 * clock reading. Whole-day overflow is applied via `.plus({ days })` instead, which —
 * unlike sub-day units — Luxon treats as calendar arithmetic, correctly preserving the
 * requested wall-clock time across any DST shift.
 */
export function wallClockToUtcDate(dateStr: string, hourDecimal: number, timezone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const totalMinutes = Math.round(hourDecimal * 60);
  const dayOverflow = Math.floor(totalMinutes / 1440);
  const minutesWithinDay = totalMinutes - dayOverflow * 1440;

  const base = DateTime.fromObject(
    { year: y, month: m, day: d, hour: Math.floor(minutesWithinDay / 60), minute: minutesWithinDay % 60 },
    { zone: timezone },
  );
  const dt = dayOverflow !== 0 ? base.plus({ days: dayOverflow }) : base;
  return dt.toJSDate();
}

export function longDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
