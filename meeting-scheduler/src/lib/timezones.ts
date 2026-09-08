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
 * Two locales tried in order rather than one: each locale's Intl/CLDR data only defines a
 * real letter abbreviation (BST, EDT, CEST, ...) for zones "familiar" to that locale/
 * region — en-GB covers Europe/Middle East well, en-US covers the Americas well, and each
 * falls back to a bare "GMT+X" string (identical to gmtOffsetLabel's own output) for zones
 * outside its own coverage. Measured live against this app's actual ~800-entry catalog:
 * en-GB alone gets a real abbreviation for 14% of zones, en-US alone 23%, the union of
 * both 37% (of unique zones) / 26% (of catalog entries, weighted toward the US/UK/Europe-
 * heavy zones several cities each share). The remaining ~74% of entries have no
 * internationally standardized short form in Intl's data at all — not a gap in this list,
 * a gap in the data those two locales expose.
 */
const ABBREVIATION_LOCALES = ["en-GB", "en-US"];

/**
 * A real timezone abbreviation (BST, EDT, CEST, ...) for `timezone` on `dateStr`, or null
 * if Intl has no distinct abbreviation for it (in which case gmtOffsetLabel's plain
 * "GMT+X" is all there is — showing "GMT+9 / GMT+9" would just be a redundant duplicate).
 */
export function zoneAbbreviation(timezone: string, dateStr: string): string | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const offset = gmtOffsetLabel(timezone, dateStr);

  for (const locale of ABBREVIATION_LOCALES) {
    let abbrev: string | undefined;
    try {
      const parts = new Intl.DateTimeFormat(locale, { timeZone: timezone, timeZoneName: "short" }).formatToParts(date);
      abbrev = parts.find((p) => p.type === "timeZoneName")?.value;
    } catch {
      return null; // Not a resolvable IANA zone — nothing to abbreviate.
    }
    // Redundant with the GMT offset already shown (either literally equal, or itself just
    // another "GMT+X"/"GMT"/"UTC" string) — not a real abbreviation, try the next locale.
    if (abbrev && abbrev !== offset && !/^GMT([+-]|$)/.test(abbrev) && abbrev !== "UTC") {
      return abbrev;
    }
  }
  return null;
}

export function zoneDisplayLabel(zone: TimeZoneCatalogEntry, dateStr: string): string {
  const offset = gmtOffsetLabel(zone.timezone, dateStr);
  const abbrev = zoneAbbreviation(zone.timezone, dateStr);
  const timeLabel = abbrev ? `${abbrev} / ${offset}` : offset;
  return `${zone.city} — ${zone.country} (${timeLabel})`;
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
