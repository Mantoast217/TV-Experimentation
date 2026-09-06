import { DateTime } from "luxon";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ianaTimezone, isoDateInRange, NUM_RUNS, scaledTimeout, startAndDuration } from "../test/arbitraries";
import { computeZoneTimes } from "./scheduling";
import { wallClockToUtcDate } from "./timezones";
import type { TimeZoneCatalogEntry } from "./timezones";

function zoneEntry(id: string, timezone: string): TimeZoneCatalogEntry {
  return { id, city: id, country: id, countryCode: "ZZ", timezone };
}

/** A pure calendar-date index (no time-of-day/zone component) — independent of scheduling.ts. */
function calendarDayIndex(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

describe("computeZoneTimes — day-offset badging (property-based)", () => {
  it("computes each attendee's day offset exactly as an independent Luxon-based date diff would", () => {
    fc.assert(
      fc.property(
        ianaTimezone(),
        ianaTimezone(),
        isoDateInRange(),
        startAndDuration(),
        (anchorZone, attendeeZone, dateStr, { startHour, startMinute, durationMinutes }) => {
          const zones = [zoneEntry("anchor", anchorZone), zoneEntry("attendee", attendeeZone)];
          const startHourDecimal = startHour + startMinute / 60;
          const [, attendeeSlot] = computeZoneTimes(zones, dateStr, startHourDecimal, durationMinutes / 60);

          // Independently (not via scheduling.ts) resolve the anchor's chosen wall-clock
          // start instant, re-express it in the attendee's zone, and diff calendar dates.
          const [y, m, d] = dateStr.split("-").map(Number);
          const anchorStart = DateTime.fromObject({ year: y, month: m, day: d, hour: startHour, minute: startMinute }, { zone: anchorZone });
          const attendeeLocal = anchorStart.setZone(attendeeZone);
          const expectedDayOffset =
            calendarDayIndex(attendeeLocal.year, attendeeLocal.month, attendeeLocal.day) - calendarDayIndex(y, m, d);

          expect(attendeeSlot.dayOffset).toBe(expectedDayOffset);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  }, scaledTimeout(5));

  it(
    "gives the anchor zone itself a day offset of exactly 0",
    () => {
      fc.assert(
        fc.property(ianaTimezone(), isoDateInRange(), startAndDuration(), (zone, dateStr, { startHour, startMinute, durationMinutes }) => {
          const [anchorSlot] = computeZoneTimes([zoneEntry("anchor", zone)], dateStr, startHour + startMinute / 60, durationMinutes / 60);
          expect(anchorSlot.dayOffset).toBe(0);
        }),
        { numRuns: NUM_RUNS },
      );
    },
    scaledTimeout(5),
  );
});

describe("wallClockToUtcDate — round-trip consistency (property-based)", () => {
  it("recovers the exact original UTC instant from the wall-clock time it renders, for any non-ambiguous instant", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date(Date.UTC(2020, 0, 1)), max: new Date(Date.UTC(2035, 11, 31)), noInvalidDate: true }),
        ianaTimezone(),
        (rawInstant, zone) => {
          // The app's wall-clock model is minute-granularity ("HH:MM" pickers) — snap to
          // the minute so the round-trip isn't judged against sub-minute precision the
          // tool was never designed to carry.
          const utcInstant = new Date(Math.round(rawInstant.getTime() / 60_000) * 60_000);
          const local = DateTime.fromJSDate(utcInstant, { zone });
          fc.pre(local.isValid);

          // Skip the second occurrence of a repeated fall-back hour: two distinct UTC
          // instants legitimately share that exact wall-clock reading, so recovering
          // *this specific* one from wall-clock text alone is impossible by definition —
          // not a bug. The "fall-back consistency" property covers that case instead.
          //
          // Compared on all five wall-clock fields, not just .offset: for at least one
          // real historical transition (America/Godthab/Nuuk, 2023-03-26), Luxon's
          // fromJSDate (instant -> local) and fromObject (local -> instant) disagree on
          // which wall-clock readings exist, while reporting the *same* offset — an
          // offset-only comparison let that case slip through as "unambiguous" when it
          // wasn't reconstructible at all.
          const reconstructedFromWallClock = DateTime.fromObject(
            { year: local.year, month: local.month, day: local.day, hour: local.hour, minute: local.minute },
            { zone },
          );
          fc.pre(
            reconstructedFromWallClock.offset === local.offset &&
              reconstructedFromWallClock.year === local.year &&
              reconstructedFromWallClock.month === local.month &&
              reconstructedFromWallClock.day === local.day &&
              reconstructedFromWallClock.hour === local.hour &&
              reconstructedFromWallClock.minute === local.minute,
          );

          const dateStr = local.toISODate()!;
          const hourDecimal = local.hour + local.minute / 60;
          const roundTripped = wallClockToUtcDate(dateStr, hourDecimal, zone);

          expect(roundTripped.getTime()).toBe(utcInstant.getTime());
        },
      ),
      { numRuns: NUM_RUNS },
    );
  }, scaledTimeout(5));
});
