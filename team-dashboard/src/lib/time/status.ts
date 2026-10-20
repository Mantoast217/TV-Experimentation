import { DateTime } from "luxon";
import type { DateRange, Person, Status, TimeWindow } from "./types";
import { addDays, daysBetween, formatTime, inZone, wallTimeToInstant } from "./zone";

const SATURDAY = 6;

function isHolidayOn(person: Person, isoDate: string): boolean {
  // ISO dates compare correctly as strings.
  return person.outOfOffice.some((range) => range.start <= isoDate && isoDate <= range.end);
}

/** The person's working window on one of their own calendar dates, or null on weekends and holidays. */
export function workingWindowOn(person: Person, isoDate: string): TimeWindow | null {
  const weekday = DateTime.fromISO(isoDate, { zone: "utc" }).weekday;
  if (weekday >= SATURDAY || isHolidayOn(person, isoDate)) return null;
  return {
    start: wallTimeToInstant(isoDate, person.workingHours.start, person.ianaTimeZone),
    end: wallTimeToInstant(isoDate, person.workingHours.end, person.ianaTimeZone),
  };
}

/** Every working window that overlaps the given span of real time, in order. */
export function workingWindowsBetween(person: Person, from: Date, to: Date): TimeWindow[] {
  const firstDate = addDays(inZone(from, person.ianaTimeZone).toISODate()!, -1);
  const lastDate = addDays(inZone(to, person.ianaTimeZone).toISODate()!, 1);
  const windows: TimeWindow[] = [];
  for (let i = 0; i <= daysBetween(firstDate, lastDate); i++) {
    const window = workingWindowOn(person, addDays(firstDate, i));
    if (window && window.start < to && window.end > from) windows.push(window);
  }
  return windows;
}

export function isOnHoliday(person: Person, now: Date): boolean {
  return isHolidayOn(person, inZone(now, person.ianaTimeZone).toISODate()!);
}

export function isWorkingAt(person: Person, instant: Date): boolean {
  const window = workingWindowOn(person, inZone(instant, person.ianaTimeZone).toISODate()!);
  return window !== null && window.start <= instant && instant < window.end;
}

export function statusAt(person: Person, now: Date): Status {
  if (isOnHoliday(person, now)) return "holiday";
  return isWorkingAt(person, now) ? "working" : "outside";
}

export function localTime(person: Person, now: Date): { time: string; weekday: string; isoDate: string } {
  const local = inZone(now, person.ianaTimeZone).setLocale("en-GB");
  return { time: formatTime(local), weekday: local.toFormat("cccc"), isoDate: local.toISODate()! };
}

/** Calendar days between the viewer's date and the person's date: +1 means the person is a day ahead. */
export function dayOffset(person: Person, now: Date, viewerZone: string): number {
  return daysBetween(inZone(now, viewerZone).toISODate()!, inZone(now, person.ianaTimeZone).toISODate()!);
}

export interface StatusCounts {
  working: number;
  outside: number;
  holiday: number;
}

export function countByStatus(people: readonly Person[], now: Date): StatusCounts {
  const counts: StatusCounts = { working: 0, outside: 0, holiday: 0 };
  for (const person of people) counts[statusAt(person, now)]++;
  return counts;
}

/** Out-of-office ranges that haven't ended yet in the person's own zone, earliest first. */
export function upcomingOutOfOffice(person: Person, now: Date): DateRange[] {
  const today = inZone(now, person.ianaTimeZone).toISODate()!;
  return person.outOfOffice.filter((range) => range.end >= today).sort((a, b) => a.start.localeCompare(b.start));
}
