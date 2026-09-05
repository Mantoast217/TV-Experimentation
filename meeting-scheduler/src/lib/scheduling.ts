import { formatHm, type TimeZoneCatalogEntry } from "./timezones";

export interface ZoneTimeSlot {
  zone: TimeZoneCatalogEntry;
  startText: string;
  endText: string;
  /** Day offset relative to the host's selected date: -1, 0, or +1 (rarely more). */
  dayOffset: number;
}

/** Wraps a decimal hour into [0, 24). */
function wrapHour(h: number): number {
  return ((h % 24) + 24) % 24;
}

function hourMinuteText(decimalHour: number): string {
  const totalMinutes = Math.round(wrapHour(decimalHour) * 60);
  return formatHm(Math.floor(totalMinutes / 60) % 24, totalMinutes % 60);
}

/**
 * Computes each zone's local start/end time and day offset for a meeting that starts
 * at `startHour` (decimal, in the host zone's wall clock) and runs `durationHours`.
 * `zones[0]` is the host/reference zone; every other zone's local time is derived from
 * its fixed offset relative to the host's.
 */
export function computeZoneTimes(
  zones: TimeZoneCatalogEntry[],
  startHour: number,
  durationHours: number,
): ZoneTimeSlot[] {
  if (zones.length === 0) return [];
  const hostOffset = zones[0].offsetHours;

  return zones.map((zone) => {
    const localStart = startHour + (zone.offsetHours - hostOffset);
    const localEnd = localStart + durationHours;
    return {
      zone,
      startText: hourMinuteText(localStart),
      endText: hourMinuteText(localEnd),
      dayOffset: Math.floor(localStart / 24),
    };
  });
}

/**
 * Scans candidate start hours (in the host zone) and returns the one that keeps every
 * zone's meeting time as close as possible to typical working hours (9-18), with staying
 * within awake hours (6-24) weighted far more heavily so it always wins when the two
 * constraints conflict.
 */
export function findOptimalStartHour(zones: TimeZoneCatalogEntry[], durationHours: number): number {
  if (zones.length === 0) return 9;
  const hostOffset = zones[0].offsetHours;

  let bestHour = 9;
  let bestScore = Infinity;
  for (let h = 0; h < 24; h += 0.25) {
    const score = zones.reduce((sum, zone) => {
      const localHour = wrapHour(h + (zone.offsetHours - hostOffset));
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

/** Plain-text rendering of a set of zone slots, e.g. "London 16:00–17:00 / Tokyo 00:00–01:00 (+1)". */
export function formatZoneTimesText(slots: ZoneTimeSlot[]): string {
  if (slots.length === 0) return "";
  return slots
    .map((slot) => {
      const dayTag = slot.dayOffset !== 0 ? ` (${slot.dayOffset > 0 ? "+" : ""}${slot.dayOffset})` : "";
      return `${slot.zone.city} ${slot.startText}–${slot.endText}${dayTag}`;
    })
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
 * End-time options reordered to start right after `startValue` and wrap around back to
 * it — so the list reads as a continuous 24-hour span forward from the start time, with
 * the start time itself (a full 24-hour meeting) as the last entry.
 */
export function buildEndTimeOptions(startValue: string): TimeOption[] {
  const startIndex = TIME_OPTIONS.findIndex((option) => option.id === startValue);
  if (startIndex === -1) return TIME_OPTIONS;
  return [...TIME_OPTIONS.slice(startIndex + 1), ...TIME_OPTIONS.slice(0, startIndex + 1)];
}
