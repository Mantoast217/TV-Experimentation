import type { Person } from "./types";
import { statusAt, workingWindowsBetween } from "./status";
import { inZone, wallTimeToInstant } from "./zone";

export const DAY_MINUTES = 1440;

export interface ViewerDay {
  isoDate: string;
  start: Date;
  end: Date;
}

/** The viewer's calendar day containing `now`. It lasts 23 or 25 hours on clock-change days. */
export function viewerDay(now: Date, viewerZone: string): ViewerDay {
  const start = inZone(now, viewerZone).startOf("day");
  return { isoDate: start.toISODate()!, start: start.toJSDate(), end: start.plus({ days: 1 }).toJSDate() };
}

/**
 * Where an instant falls on a 24-hour scale (0 to 1440) for the viewer's day. Uses elapsed real
 * time, so on a 23 or 25-hour day the scale stretches slightly rather than skipping or repeating.
 */
export function positionInDay(instant: Date, day: ViewerDay): number {
  const length = day.end.getTime() - day.start.getTime();
  const elapsed = instant.getTime() - day.start.getTime();
  return Math.min(DAY_MINUTES, Math.max(0, (elapsed / length) * DAY_MINUTES));
}

export interface Segment {
  startMinute: number;
  endMinute: number;
}

/** The person's working time within the viewer's day, split at the viewer's midnights. */
export function timelineSegments(person: Person, day: ViewerDay): Segment[] {
  return workingWindowsBetween(person, day.start, day.end)
    .map((window) => ({
      startMinute: positionInDay(window.start < day.start ? day.start : window.start, day),
      endMinute: positionInDay(window.end > day.end ? day.end : window.end, day),
    }))
    .filter((segment) => segment.endMinute > segment.startMinute);
}

export interface HourOverlap {
  /** 0 to 23, the viewer's wall-clock hour. */
  hour: number;
  /** People working for the whole hour. */
  count: number;
}

export interface Overlap {
  hours: HourOverlap[];
  /** People not on holiday today, which is the most that can ever be working in an hour. */
  available: number;
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** For each hour of the viewer's day, how many people are working for all of it. People on holiday today are left out. */
export function hourlyOverlap(people: readonly Person[], now: Date, viewerZone: string): Overlap {
  const day = viewerDay(now, viewerZone);
  const available = people.filter((person) => statusAt(person, now) !== "holiday");
  const windowsByPerson = available.map((person) => workingWindowsBetween(person, day.start, day.end));

  const hours = Array.from({ length: 24 }, (_, hour) => {
    const from = wallTimeToInstant(day.isoDate, hourLabel(hour), viewerZone);
    const to = hour === 23 ? day.end : wallTimeToInstant(day.isoDate, hourLabel(hour + 1), viewerZone);
    // An hour skipped by the clocks going forward has no length, so nobody works through it.
    if (to <= from) return { hour, count: 0 };
    const count = windowsByPerson.filter((windows) => windows.some((w) => w.start <= from && w.end >= to)).length;
    return { hour, count };
  });

  return { hours, available: available.length };
}

/** The hours with the most people working, or none if nobody is working in any full hour. */
export function bestHours(overlap: Overlap): { hours: number[]; count: number } {
  const count = Math.max(0, ...overlap.hours.map((h) => h.count));
  if (count === 0) return { hours: [], count: 0 };
  return { hours: overlap.hours.filter((h) => h.count === count).map((h) => h.hour), count };
}
