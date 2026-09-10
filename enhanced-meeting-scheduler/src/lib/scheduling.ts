import { DateTime } from "luxon";
import { formatHm, type TimeZoneCatalogEntry } from "./timezones";

export interface ZoneTimeSlot {
  zone: TimeZoneCatalogEntry;
  startText: string;
  endText: string;
  /**
   * The start time's day offset relative to the host's selected date: -1, 0, or +1
   * (rarely more) — e.g. a zone far enough ahead that the host's evening start is
   * already tomorrow morning there.
   */
  dayOffset: number;
  /**
   * The end time's day offset relative to the host's selected date, in the same frame
   * as `dayOffset`. Independent of it: a long enough duration pushes the end into the
   * next calendar day even for the host's own zone (dayOffset 0), and a start that's
   * already offset by a zone difference can end on yet another day, or back on the
   * host's own date, depending on the duration — so this needs its own badge rather
   * than reusing `dayOffset`.
   */
  endDayOffset: number;
  /**
   * Unwrapped local start/end hour (not clamped to [0, 24)) — kept alongside the
   * formatted text so callers (e.g. time-of-day quality classification) can find the
   * true midpoint of a slot that crosses midnight without re-deriving it from text.
   * Relative to the host's own selected calendar day (day 0), same frame as `dayOffset`.
   */
  startHourRaw: number;
  endHourRaw: number;
  /** The meeting's local calendar date in this zone, "YYYY-MM-DD" — the day `startText`
   * actually falls on there, which can differ from the host's own `dateStr` by ±1 day.
   * Needed to check a colleague's out-of-office ranges against the day it's actually
   * happening for them, not the day it's happening for the host. */
  localDateStr: string;
}

/** Wraps a decimal hour into [0, 24). */
export function wrapHour(h: number): number {
  return ((h % 24) + 24) % 24;
}

function hourMinuteText(decimalHour: number): string {
  const totalMinutes = Math.round(wrapHour(decimalHour) * 60);
  return formatHm(Math.floor(totalMinutes / 60) % 24, totalMinutes % 60);
}

/** A pure calendar-date index (no time-of-day/zone component) — safe to subtract. */
function calendarDayIndex(dt: DateTime): number {
  return Date.UTC(dt.year, dt.month - 1, dt.day) / 86_400_000;
}

function calendarDayIndexOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/**
 * The real UTC instant for `hourDecimal` wall-clock hours into `dateStr` in `timezone`.
 *
 * Builds the target hour/minute directly via `DateTime.fromObject` rather than adding
 * `hourDecimal * 60` minutes to midnight: Luxon's `.plus({ minutes })` adds real elapsed
 * time, not wall-clock time, so on a DST transition day that would silently land on the
 * wrong clock reading (e.g. midnight + 9 real hours lands on 10:00 local, not 09:00, once
 * one of those hours was skipped by a spring-forward jump). Whole-day overflow (for an
 * `hourDecimal` outside [0, 24), e.g. a duration pushing past midnight) is applied via
 * `.plus({ days })` instead, which — unlike sub-day units — Luxon does treat as calendar
 * arithmetic, correctly preserving the requested wall-clock time across any DST shift.
 */
function instantAt(dateStr: string, hourDecimal: number, timezone: string): DateTime {
  const [y, m, d] = dateStr.split("-").map(Number);
  const totalMinutes = Math.round(hourDecimal * 60);
  const dayOverflow = Math.floor(totalMinutes / 1440);
  const minutesWithinDay = totalMinutes - dayOverflow * 1440;

  const base = DateTime.fromObject(
    { year: y, month: m, day: d, hour: Math.floor(minutesWithinDay / 60), minute: minutesWithinDay % 60 },
    { zone: timezone },
  );
  return dayOverflow !== 0 ? base.plus({ days: dayOverflow }) : base;
}

/**
 * Expresses a real instant as an unwrapped decimal hour relative to `hostDateStr` (the
 * host's selected calendar day, day 0) — e.g. 25.5 for 01:30 the day after, or -2 for
 * 22:00 the day before. Calendar-date arithmetic throughout, so this reflects the actual
 * wall-clock reading in `zoneInstant`'s zone regardless of DST transitions in between.
 */
function unwrappedLocalHour(zoneInstant: DateTime, hostDateStr: string): number {
  const dayDelta = calendarDayIndex(zoneInstant) - calendarDayIndexOf(hostDateStr);
  return dayDelta * 24 + zoneInstant.hour + zoneInstant.minute / 60 + zoneInstant.second / 3600;
}

/**
 * Computes each zone's local start/end time and day offset for a meeting on `dateStr`
 * that starts at `startHour` (decimal, in the host zone's wall clock) and runs
 * `durationHours`. `zones[0]` is the host/reference zone; every other zone's local time
 * is derived by converting the same real UTC instant into that zone's calendar via its
 * IANA identifier, so DST transitions (in the host zone, another zone, or both) are
 * handled automatically and correctly.
 */
export function computeZoneTimes(
  zones: TimeZoneCatalogEntry[],
  dateStr: string,
  startHour: number,
  durationHours: number,
): ZoneTimeSlot[] {
  if (zones.length === 0) return [];
  const hostZone = zones[0].timezone;
  const startInstant = instantAt(dateStr, startHour, hostZone);
  const endInstant = startInstant.plus({ minutes: Math.round(durationHours * 60) });

  return zones.map((zone) => {
    const localStart = startInstant.setZone(zone.timezone);
    const localEnd = endInstant.setZone(zone.timezone);
    const startHourRaw = unwrappedLocalHour(localStart, dateStr);
    const endHourRaw = unwrappedLocalHour(localEnd, dateStr);
    return {
      zone,
      startText: hourMinuteText(startHourRaw),
      endText: hourMinuteText(endHourRaw),
      dayOffset: calendarDayIndex(localStart) - calendarDayIndexOf(dateStr),
      endDayOffset: calendarDayIndex(localEnd) - calendarDayIndexOf(dateStr),
      startHourRaw,
      endHourRaw,
      localDateStr: localStart.toISODate()!,
    };
  });
}

/**
 * Scans candidate start hours (in the host zone, on `dateStr`) and returns the one that
 * keeps every zone's meeting time as close as possible to typical working hours (9-18),
 * with staying within awake hours (6-24) weighted far more heavily so it always wins when
 * the two constraints conflict. Each candidate's per-zone local hour is resolved via a
 * real DST-aware instant conversion, same as computeZoneTimes.
 */
export function findOptimalStartHour(zones: TimeZoneCatalogEntry[], dateStr: string, durationHours: number): number {
  if (zones.length === 0) return 9;
  const hostZone = zones[0].timezone;

  let bestHour = 9;
  let bestScore = Infinity;
  for (let h = 0; h < 24; h += 0.25) {
    const startInstant = instantAt(dateStr, h, hostZone);
    const score = zones.reduce((sum, zone) => {
      const localHour = wrapHour(unwrappedLocalHour(startInstant.setZone(zone.timezone), dateStr));
      const workingPenalty = Math.max(0, 9 - localHour) + Math.max(0, localHour + durationHours - 18);
      const awakePenalty = (Math.max(0, 6 - localHour) + Math.max(0, localHour + durationHours - 24)) * 10;
      return sum + workingPenalty + awakePenalty;
    }, 0);
    if (score < bestScore) {
      bestScore = score;
      bestHour = h;
    }
  }
  return bestHour;
}

/** e.g. " (+1)" or " (-1)" for a nonzero offset, "" for 0. */
function dayTag(offset: number): string {
  return offset !== 0 ? ` (${offset > 0 ? "+" : ""}${offset})` : "";
}

/**
 * Plain-text rendering of a set of zone slots, e.g.
 * "London 16:00–17:00 / Tokyo 00:00 (+1)–01:00 (+1)". Start and end are tagged
 * independently, since a long duration can push the end a day beyond the start (or, for
 * a zone already offset from the host's date, back onto it) regardless of where the
 * start lands.
 */
export function formatZoneTimesText(slots: ZoneTimeSlot[]): string {
  if (slots.length === 0) return "";
  return slots
    .map((slot) => `${slot.zone.city} ${slot.startText}${dayTag(slot.dayOffset)}–${slot.endText}${dayTag(slot.endDayOffset)}`)
    .join(" / ");
}

export function parseHourValue(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h + (m || 0) / 60;
}

/**
 * Duration from a start to an end time-of-day, wrapping past midnight when the end is
 * not after the start (e.g. 23:00 -> 01:00 is 2 hours; 16:00 -> 16:00 is a full 24 hours).
 */
export function computeDurationHours(startHour: number, endHour: number): number {
  const diff = endHour - startHour;
  return diff > 0 ? diff : diff + 24;
}

/**
 * Shifts a "HH:MM" time-of-day value forward by `durationHours`, wrapping past midnight —
 * used to keep a fixed duration when the start time moves.
 */
export function shiftTimeValue(value: string, durationHours: number): string {
  const totalMinutes = Math.round(wrapHour(parseHourValue(value) + durationHours) * 60);
  return formatHm(Math.floor(totalMinutes / 60), totalMinutes % 60);
}

export interface TimeOption {
  id: string;
  label: string;
}

/** Generates a full 24-hour list of "HH:MM" options at a fixed minute increment. */
export function buildTimeOptions(stepMinutes: number): TimeOption[] {
  const options: TimeOption[] = [];
  for (let totalMinutes = 0; totalMinutes < 24 * 60; totalMinutes += stepMinutes) {
    const label = formatHm(Math.floor(totalMinutes / 60), totalMinutes % 60);
    options.push({ id: label, label });
  }
  return options;
}

export const TIME_OPTIONS: TimeOption[] = buildTimeOptions(15);

/**
 * Parses free-typed text into a canonical "HH:MM" 24-hour value, or null if it isn't a
 * recognizable time. Accepts an optional ":" or "." separator, 1-2 digit hours, and
 * tolerates no separator at all (e.g. "1722", "722"), but always requires two minute
 * digits so "17:2" isn't misread as "17:02" or "17:20".
 */
export function parseTimeInput(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})[:.]?(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return formatHm(hour, minute);
}

/**
 * The next "HH:MM" value strictly after `value` on the `stepMinutes` grid, wrapping past
 * midnight — e.g. nextIncrementAfter("17:22", 15) is "17:30", and nextIncrementAfter
 * "17:15" (already aligned) is "17:30" too, not "17:15" itself.
 */
export function nextIncrementAfter(value: string, stepMinutes: number): string {
  const totalMinutes = Math.round(parseHourValue(value) * 60);
  const next = (Math.floor(totalMinutes / stepMinutes) + 1) * stepMinutes;
  const wrapped = wrapHour(next / 60) * 60;
  return formatHm(Math.floor(wrapped / 60), Math.round(wrapped % 60));
}

/**
 * End-time options reordered to start right after `startValue` and wrap around back to
 * it — so the list reads as a continuous 24-hour span forward from the start time, with
 * the start time itself (a full 24-hour meeting) as the last entry.
 *
 * `startValue` doesn't have to be grid-aligned: a custom typed Start (e.g. "17:22")
 * rotates the list to begin at the next 15-minute increment after it ("17:30"), the same
 * "next increment ahead" starting point a grid-aligned Start would produce.
 */
export function buildEndTimeOptions(startValue: string): TimeOption[] {
  const startIndex = TIME_OPTIONS.findIndex((option) => option.id === startValue);
  if (startIndex !== -1) {
    return [...TIME_OPTIONS.slice(startIndex + 1), ...TIME_OPTIONS.slice(0, startIndex + 1)];
  }

  const nextIndex = TIME_OPTIONS.findIndex((option) => option.id === nextIncrementAfter(startValue, 15));
  if (nextIndex === -1) return TIME_OPTIONS;
  return [...TIME_OPTIONS.slice(nextIndex), ...TIME_OPTIONS.slice(0, nextIndex)];
}
