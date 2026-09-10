import { DateTime } from "luxon";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isoDateInRange, NUM_RUNS, scaledTimeout } from "../test/arbitraries";
import { isColleagueOutOfOffice, isDateBlockedForAnyone, isOutsideDeclaredHours, nextAvailableDate } from "./availability";
import { colleagueTimeZone, type Colleague } from "./colleagues";
import { TIMEZONE_CATALOG } from "./timezoneData";

/** A real TimeZoneCatalogEntry.id — colleagueTimeZone() throws on anything else, so every
 * fuzzed Colleague needs one of these, not an arbitrary IANA string. Sourced from the
 * actual curated catalog (real cities), which already spans virtually every populated
 * offset, not a hand-picked subset. */
function catalogTimezoneId(): fc.Arbitrary<string> {
  return fc.constantFrom(...TIMEZONE_CATALOG.map((z) => z.id));
}

function hostZoneOf(timezoneId: string): string {
  return TIMEZONE_CATALOG.find((z) => z.id === timezoneId)!.timezone;
}

/** Zero-padded 24h "HH:MM" — the exact shape every real caller produces (see
 * scheduling.ts's hourMinuteText), including ones a picker would never offer (00:00,
 * 23:59) since fuzzing shouldn't quietly assume the "nice" subset. */
function hhmm(): fc.Arbitrary<string> {
  return fc
    .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
    .map(([h, m]) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
}

function minutesOfDay(hhmmStr: string): number {
  const [h, m] = hhmmStr.split(":").map(Number);
  return h * 60 + m;
}

/** A start/end pair with start <= end (lexicographically, which is also chronologically
 * correct for zero-padded ISO dates) — an inverted OOO range isn't something the app ever
 * constructs, so it's out of scope here rather than a case to assert behavior for. */
function orderedDateRange(): fc.Arbitrary<{ start: string; end: string }> {
  return fc.tuple(isoDateInRange(), isoDateInRange()).map(([a, b]) => (a <= b ? { start: a, end: b } : { start: b, end: a }));
}

function colleagueArb(): fc.Arbitrary<Colleague> {
  return fc.record({
    id: fc.uuid(),
    firstName: fc.constant("Test"),
    lastName: fc.constant("Colleague"),
    role: fc.constant("Test Role"),
    email: fc.constant("test.colleague@kestrelglobal.example"),
    timezoneId: catalogTimezoneId(),
    workingHours: fc.record({ start: hhmm(), end: hhmm() }),
    outOfOffice: fc.option(fc.array(orderedDateRange(), { minLength: 1, maxLength: 3 }), { nil: undefined }),
  });
}

describe("isOutsideDeclaredHours (property-based)", () => {
  it(
    "matches an independent minute-of-day comparison, for any zero-padded HH:MM combination",
    () => {
      fc.assert(
        fc.property(hhmm(), hhmm(), hhmm(), hhmm(), (slotStart, slotEnd, declaredStart, declaredEnd) => {
          const colleague: Colleague = {
            id: "c",
            firstName: "Test",
            lastName: "Colleague",
            role: "Test Role",
            email: "test.colleague@kestrelglobal.example",
            timezoneId: TIMEZONE_CATALOG[0].id,
            workingHours: { start: declaredStart, end: declaredEnd },
          };
          const expected = minutesOfDay(slotStart) < minutesOfDay(declaredStart) || minutesOfDay(slotEnd) > minutesOfDay(declaredEnd);
          expect(isOutsideDeclaredHours(colleague, slotStart, slotEnd)).toBe(expected);
        }),
        { numRuns: NUM_RUNS },
      );
    },
    scaledTimeout(2),
  );
});

describe("isColleagueOutOfOffice (property-based)", () => {
  it(
    "matches an independent Date-object range comparison, not just the string comparison the implementation uses",
    () => {
      fc.assert(
        fc.property(isoDateInRange(), orderedDateRange(), (dateStr, range) => {
          const colleague: Colleague = {
            id: "c",
            firstName: "Test",
            lastName: "Colleague",
            role: "Test Role",
            email: "test.colleague@kestrelglobal.example",
            timezoneId: TIMEZONE_CATALOG[0].id,
            workingHours: { start: "09:00", end: "17:00" },
            outOfOffice: [range],
          };
          const d = Date.parse(`${dateStr}T00:00:00Z`);
          const s = Date.parse(`${range.start}T00:00:00Z`);
          const e = Date.parse(`${range.end}T00:00:00Z`);
          expect(isColleagueOutOfOffice(colleague, dateStr)).toBe(d >= s && d <= e);
        }),
        { numRuns: NUM_RUNS },
      );
    },
    scaledTimeout(2),
  );
});

describe("isDateBlockedForAnyone (property-based)", () => {
  it(
    "resolves a participant's OOO status against their own local calendar date, independently re-derived",
    () => {
      fc.assert(
        fc.property(colleagueArb(), catalogTimezoneId(), isoDateInRange(), (person, hostZoneId, dateStr) => {
          const hostZone = hostZoneOf(hostZoneId);
          const participantZone = colleagueTimeZone(person).timezone;
          const [y, m, d] = dateStr.split("-").map(Number);
          const hostNoon = DateTime.fromObject({ year: y, month: m, day: d, hour: 12 }, { zone: hostZone });
          const expectedLocalDate = hostNoon.setZone(participantZone).toISODate()!;
          const expectedBlocked = isColleagueOutOfOffice(person, expectedLocalDate);

          expect(isDateBlockedForAnyone([person], hostZone, dateStr)).toBe(expectedBlocked);
        }),
        { numRuns: NUM_RUNS },
      );
    },
    scaledTimeout(5),
  );

  it(
    "is true whenever at least one participant is blocked, regardless of how many others aren't",
    () => {
      fc.assert(
        fc.property(
          fc.array(colleagueArb(), { minLength: 2, maxLength: 6 }),
          catalogTimezoneId(),
          isoDateInRange(),
          (people, hostZoneId, dateStr) => {
            const hostZone = hostZoneOf(hostZoneId);
            const individually = people.map((p) => isDateBlockedForAnyone([p], hostZone, dateStr));
            expect(isDateBlockedForAnyone(people, hostZone, dateStr)).toBe(individually.some(Boolean));
          },
        ),
        { numRuns: NUM_RUNS },
      );
    },
    scaledTimeout(8),
  );
});

describe("nextAvailableDate (property-based)", () => {
  it(
    "never returns a date earlier than the one it started searching from",
    () => {
      fc.assert(
        fc.property(
          fc.array(colleagueArb(), { minLength: 1, maxLength: 5 }),
          catalogTimezoneId(),
          isoDateInRange(),
          (people, hostZoneId, fromDateStr) => {
            const hostZone = hostZoneOf(hostZoneId);
            const result = nextAvailableDate(people, hostZone, fromDateStr, 60);
            expect(result >= fromDateStr).toBe(true);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    },
    scaledTimeout(10),
  );

  it(
    "only ever moves off the original date onto one that's genuinely clear",
    () => {
      fc.assert(
        fc.property(
          fc.array(colleagueArb(), { minLength: 1, maxLength: 5 }),
          catalogTimezoneId(),
          isoDateInRange(),
          (people, hostZoneId, fromDateStr) => {
            const hostZone = hostZoneOf(hostZoneId);
            const result = nextAvailableDate(people, hostZone, fromDateStr, 60);
            if (result !== fromDateStr) {
              expect(isDateBlockedForAnyone(people, hostZone, result)).toBe(false);
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    },
    scaledTimeout(10),
  );

  it(
    "never suggests a weekend when it has to move off the original date",
    () => {
      fc.assert(
        fc.property(
          fc.array(colleagueArb(), { minLength: 1, maxLength: 5 }),
          catalogTimezoneId(),
          isoDateInRange(),
          (people, hostZoneId, fromDateStr) => {
            const hostZone = hostZoneOf(hostZoneId);
            const result = nextAvailableDate(people, hostZone, fromDateStr, 60);
            if (result !== fromDateStr) {
              const [y, m, d] = result.split("-").map(Number);
              const weekday = DateTime.fromObject({ year: y, month: m, day: d }, { zone: hostZone }).weekday;
              expect(weekday).not.toBe(6);
              expect(weekday).not.toBe(7);
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    },
    scaledTimeout(10),
  );

  it(
    "returns the original date unchanged whenever it already works, regardless of weekday",
    () => {
      fc.assert(
        fc.property(
          fc.array(colleagueArb(), { minLength: 0, maxLength: 5 }),
          catalogTimezoneId(),
          isoDateInRange(),
          (people, hostZoneId, fromDateStr) => {
            const hostZone = hostZoneOf(hostZoneId);
            fc.pre(!isDateBlockedForAnyone(people, hostZone, fromDateStr));
            expect(nextAvailableDate(people, hostZone, fromDateStr, 60)).toBe(fromDateStr);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    },
    scaledTimeout(10),
  );
});
