import { describe, expect, it } from "vitest";
import { isColleagueOutOfOffice, isDateBlockedForAnyone, isOutsideDeclaredHours, nextAvailableDate } from "./availability";
import type { Colleague } from "./colleagues";

function colleague(overrides: Partial<Colleague> = {}): Colleague {
  return {
    id: "test-colleague",
    firstName: "Test",
    lastName: "Colleague",
    role: "Test Role",
    email: "test.colleague@kestrelglobal.example",
    timezoneId: "gb-london-2643743",
    workingHours: { start: "09:00", end: "17:00" },
    ...overrides,
  };
}

describe("isColleagueOutOfOffice", () => {
  it("is false when there's no outOfOffice at all", () => {
    expect(isColleagueOutOfOffice(colleague(), "2026-09-10")).toBe(false);
  });

  it("is true for a date inside a declared range, inclusive of both ends", () => {
    const p = colleague({ outOfOffice: [{ start: "2026-09-08", end: "2026-09-19" }] });
    expect(isColleagueOutOfOffice(p, "2026-09-08")).toBe(true);
    expect(isColleagueOutOfOffice(p, "2026-09-13")).toBe(true);
    expect(isColleagueOutOfOffice(p, "2026-09-19")).toBe(true);
  });

  it("is false just outside a declared range on either side", () => {
    const p = colleague({ outOfOffice: [{ start: "2026-09-08", end: "2026-09-19" }] });
    expect(isColleagueOutOfOffice(p, "2026-09-07")).toBe(false);
    expect(isColleagueOutOfOffice(p, "2026-09-20")).toBe(false);
  });
});

describe("isOutsideDeclaredHours", () => {
  const p = colleague({ workingHours: { start: "08:30", end: "17:00" } });

  it("is false for a slot entirely within declared hours", () => {
    expect(isOutsideDeclaredHours(p, "09:00", "10:00")).toBe(false);
  });

  it("is false for a slot exactly at the declared boundary", () => {
    expect(isOutsideDeclaredHours(p, "08:30", "17:00")).toBe(false);
  });

  it("is true when the start is before the declared start", () => {
    expect(isOutsideDeclaredHours(p, "08:00", "09:00")).toBe(true);
  });

  it("is true when the end is after the declared end", () => {
    expect(isOutsideDeclaredHours(p, "17:30", "18:30")).toBe(true);
  });
});

describe("isDateBlockedForAnyone", () => {
  it("is false when nobody has an OOO range at all", () => {
    const people = [colleague({ id: "a" }), colleague({ id: "b" })];
    expect(isDateBlockedForAnyone(people, "Europe/London", "2026-09-10")).toBe(false);
  });

  it("is true when at least one participant is OOO on the host's date, even if others aren't", () => {
    const people = [
      colleague({ id: "a" }),
      colleague({ id: "b", outOfOffice: [{ start: "2026-09-08", end: "2026-09-19" }] }),
    ];
    expect(isDateBlockedForAnyone(people, "Europe/London", "2026-09-10")).toBe(true);
  });

  it("resolves the OOO check against the participant's own local date, not the host's raw date string", () => {
    // Sydney is far enough ahead of Los Angeles that noon-LA on Sep 10 is already Sep 11
    // in Sydney — an OOO range that only covers Sep 11 shouldn't block a meeting the host
    // (LA) thinks of as Sep 10 unless that's genuinely the day it lands on for Sydney too.
    const sydney = colleague({
      id: "sydney-person",
      timezoneId: "au-sydney-2147714",
      outOfOffice: [{ start: "2026-09-11", end: "2026-09-11" }],
    });
    expect(isDateBlockedForAnyone([sydney], "America/Los_Angeles", "2026-09-10")).toBe(true);
    expect(isDateBlockedForAnyone([sydney], "America/Los_Angeles", "2026-09-09")).toBe(false);
  });
});

describe("nextAvailableDate", () => {
  it("returns the original date unchanged when nobody's blocked, weekend or not", () => {
    // 2026-09-12 is a Saturday — deliberately not blocking it, since nothing here forces
    // a date the organizer actually picked to move.
    const people = [colleague()];
    expect(nextAvailableDate(people, "Europe/London", "2026-09-12")).toBe("2026-09-12");
  });

  it("finds the first weekday after everyone's OOO range clears", () => {
    // Sofia's real fixture range: blocked 2026-09-08 through 2026-09-19 inclusive.
    // 2026-09-19 is a Saturday and 2026-09-20 a Sunday, so the first clear weekday is
    // Monday 2026-09-21, not the first clear calendar day.
    const people = [colleague({ outOfOffice: [{ start: "2026-09-08", end: "2026-09-19" }] })];
    expect(nextAvailableDate(people, "Europe/London", "2026-09-10")).toBe("2026-09-21");
  });

  it("waits for every participant's own OOO range to clear, not just the first one checked", () => {
    const people = [
      colleague({ id: "a", outOfOffice: [{ start: "2026-09-08", end: "2026-09-14" }] }),
      colleague({ id: "b", outOfOffice: [{ start: "2026-09-15", end: "2026-09-16" }] }),
    ];
    // 2026-09-15 is clear of "a" but still blocked by "b"; 2026-09-17 (Thursday) is the
    // first date clear of both.
    expect(nextAvailableDate(people, "Europe/London", "2026-09-10")).toBe("2026-09-17");
  });

  it("falls back to the original date if nothing opens up within the search window", () => {
    const people = [colleague({ outOfOffice: [{ start: "2026-01-01", end: "2027-12-31" }] })];
    expect(nextAvailableDate(people, "Europe/London", "2026-09-10", 10)).toBe("2026-09-10");
  });
});
