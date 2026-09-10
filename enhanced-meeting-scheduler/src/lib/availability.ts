import { DateTime } from "luxon";
import { colleagueTimeZone, type Colleague } from "./colleagues";

/** True if `localDateStr` ("YYYY-MM-DD", the colleague's own local calendar date) falls
 * within any of their declared out-of-office ranges (inclusive on both ends). */
export function isColleagueOutOfOffice(colleague: Colleague, localDateStr: string): boolean {
  return (colleague.outOfOffice ?? []).some((range) => localDateStr >= range.start && localDateStr <= range.end);
}

/** True if a slot's local start/end ("HH:MM", zero-padded 24h — safe to compare as
 * plain strings) falls outside the colleague's own declared working hours, regardless of
 * how the slot reads against the universal time-of-day quality band. */
export function isOutsideDeclaredHours(colleague: Colleague, startText: string, endText: string): boolean {
  return startText < colleague.workingHours.start || endText > colleague.workingHours.end;
}

/**
 * The calendar date `dateStr` (a wall-clock day in `hostZone`) resolves to in
 * `participantZone` — anchored at noon host time, not midnight, so a meeting that could
 * land on either side of a date boundary depending on which hour is eventually picked
 * still resolves to one unambiguous "which day is this" answer for an OOO check.
 */
function localDateIn(dateStr: string, hostZone: string, participantZone: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const hostNoon = DateTime.fromObject({ year: y, month: m, day: d, hour: 12 }, { zone: hostZone });
  return hostNoon.setZone(participantZone).toISODate()!;
}

/**
 * True if any of `participants` is out of office on `dateStr` (interpreted as a day in
 * `hostZone`) — meaning no hour that day could work for them, not just the currently
 * selected one. An out-of-office range blocks the whole local day it covers, not
 * particular hours within it.
 */
export function isDateBlockedForAnyone(participants: Colleague[], hostZone: string, dateStr: string): boolean {
  return participants.some((p) => isColleagueOutOfOffice(p, localDateIn(dateStr, hostZone, colleagueTimeZone(p).timezone)));
}

/** True for a Saturday or Sunday in `hostZone`'s own calendar. */
function isWeekend(dateStr: string, hostZone: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = DateTime.fromObject({ year: y, month: m, day: d }, { zone: hostZone }).weekday;
  return weekday === 6 || weekday === 7;
}

/**
 * The first date at or after `fromDateStr` where nobody in `participants` is out of
 * office — used to move the "Best time for everyone" suggestion off a date that's a dead
 * end for someone, onto one that could actually work. Falls back to `fromDateStr` itself
 * if nothing opens up within `maxDaysAhead`, rather than searching indefinitely.
 *
 * `fromDateStr` itself is returned as-is whenever it already works, weekend or not — this
 * only ever moves a date that's genuinely blocked, never one the organizer deliberately
 * picked. Once it does have to search forward, though, it skips weekends along the way:
 * nothing in `Colleague` declares which days someone works, but suggesting a Saturday
 * meeting nobody asked for isn't a fix, it's a different problem.
 */
export function nextAvailableDate(
  participants: Colleague[],
  hostZone: string,
  fromDateStr: string,
  maxDaysAhead = 60,
): string {
  if (!isDateBlockedForAnyone(participants, hostZone, fromDateStr)) return fromDateStr;
  let candidate = fromDateStr;
  for (let i = 0; i < maxDaysAhead; i++) {
    candidate = DateTime.fromISO(candidate).plus({ days: 1 }).toISODate()!;
    if (!isDateBlockedForAnyone(participants, hostZone, candidate) && !isWeekend(candidate, hostZone)) return candidate;
  }
  return fromDateStr;
}
