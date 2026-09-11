import { describe, expect, it } from "vitest";
import {
  buildEndTimeOptions,
  computeDurationHours,
  computeZoneTimes,
  findOptimalStartHour,
  formatZoneTimesText,
  nextIncrementAfter,
} from "./scheduling";
import type { TimeZoneCatalogEntry } from "./timezones";

const LONDON: TimeZoneCatalogEntry = {
  id: "gb-london",
  city: "London",
  country: "United Kingdom",
  countryCode: "GB",
  timezone: "Europe/London",
};

// Japan observes no DST, so Tokyo's local time only moves when London's UTC offset does —
// making it a clean witness for whether the host-zone DST transition was actually applied.
const TOKYO: TimeZoneCatalogEntry = {
  id: "jp-tokyo",
  city: "Tokyo",
  country: "Japan",
  countryCode: "JP",
  timezone: "Asia/Tokyo",
};

describe("findOptimalStartHour — declaredHoursByZoneId", () => {
  // January: London sits on plain GMT (UTC+0), so the host-zone local hour and the
  // candidate hour scanned are one and the same — no DST/offset arithmetic to account for.
  const JAN = "2026-01-15";

  it("falls back to the universal 9-18 band when no declaredHoursByZoneId is given at all", () => {
    // Untouched pre-existing behavior: with a 1h meeting, every start from 09:00 to 17:00
    // scores zero under the universal band, and the scan picks the first (lowest) of them.
    expect(findOptimalStartHour([LONDON], JAN, 1)).toBe(9);
  });

  it("falls back to the universal band for a zone with no entry in the map", () => {
    const declared = new Map<string, { start: string; end: string }[]>();
    expect(findOptimalStartHour([LONDON], JAN, 1, declared)).toBe(9);
  });

  it("scores against a participant's own declared hours instead of the universal band when given", () => {
    // Declared 11:00-15:00 is narrower than (and offset from) the universal 9-18 band —
    // the pre-existing default of 09:00 would incur a real penalty here (11-9=2), so this
    // only passes if the declared hours are actually driving the scan, not just annotating
    // whatever the universal band already picked.
    const declared = new Map([[LONDON.id, [{ start: "11:00", end: "15:00" }]]]);
    const hour = findOptimalStartHour([LONDON], JAN, 1, declared);
    expect(hour).toBeGreaterThanOrEqual(11);
    expect(hour).toBeLessThanOrEqual(14);
  });

  it("sums each shared-zone participant's own hours independently, not a merged representative range", () => {
    // Two people in the same zone with disjoint declared hours and a short (15min)
    // duration: no single instant is inside both windows, so the two candidates
    // straddling the 13:00 boundary (12:45-13:00 and 13:00-13:15) tie at the lowest
    // possible combined penalty (0.25) — the scan keeps the first (lower) of a tie.
    const declared = new Map([
      [
        LONDON.id,
        [
          { start: "09:00", end: "13:00" },
          { start: "13:00", end: "17:00" },
        ],
      ],
    ]);
    expect(findOptimalStartHour([LONDON], JAN, 0.25, declared)).toBe(12.75);
  });
});

describe("nextIncrementAfter", () => {
  it("rounds a non-aligned time up to the next step boundary", () => {
    expect(nextIncrementAfter("17:22", 15)).toBe("17:30");
    expect(nextIncrementAfter("09:01", 15)).toBe("09:15");
  });

  it("moves a step-aligned time forward by one full step, not zero", () => {
    expect(nextIncrementAfter("17:15", 15)).toBe("17:30");
    expect(nextIncrementAfter("00:00", 15)).toBe("00:15");
  });

  it("wraps past midnight", () => {
    expect(nextIncrementAfter("23:50", 15)).toBe("00:00");
    expect(nextIncrementAfter("23:45", 15)).toBe("00:00");
  });

  it("respects a custom step size", () => {
    expect(nextIncrementAfter("09:10", 30)).toBe("09:30");
  });
});

describe("computeZoneTimes — DST transitions", () => {
  // The UK's 2026 spring-forward: clocks move from 01:00 GMT to 02:00 BST on this date.
  const DAY_BEFORE = "2026-03-28";
  const TRANSITION_DAY = "2026-03-29";

  it("keeps London at GMT (+0) the day before the transition", () => {
    const [, tokyo] = computeZoneTimes([LONDON, TOKYO], DAY_BEFORE, 9, 1);
    // 09:00 GMT+0 = 09:00 UTC, +9h for Tokyo = 18:00.
    expect(tokyo.startText).toBe("18:00");
  });

  it("switches London to BST (+1) from the transition day, shifting every other zone's local time by exactly one hour for the same nominal input", () => {
    const [, tokyo] = computeZoneTimes([LONDON, TOKYO], TRANSITION_DAY, 9, 1);
    // 09:00 BST (+1) = 08:00 UTC, +9h for Tokyo = 17:00 — one hour earlier than the day
    // before, purely from London's DST transition, with the exact same "09:00" input.
    expect(tokyo.startText).toBe("17:00");
  });

  it("renders London's own local time correctly on both sides of its own transition", () => {
    const [before] = computeZoneTimes([LONDON, TOKYO], DAY_BEFORE, 9, 1);
    const [after] = computeZoneTimes([LONDON, TOKYO], TRANSITION_DAY, 9, 1);
    // The host zone's own wall-clock reading is unaffected by its own DST shift (it's
    // still displayed at the requested 09:00) — the transition only changes what that
    // 09:00 means in UTC, which is what every other zone's local time reflects.
    expect(before.startText).toBe("09:00");
    expect(after.startText).toBe("09:00");
  });
});

describe("computeZoneTimes — end-day-offset regression (moving End before Start)", () => {
  it("flags the host's own end time as next-day when duration wraps past midnight, even though its start doesn't move", () => {
    // Reported bug: clicking End's left chevron past Start (e.g. 09:00 -> 08:45) wraps
    // to a ~24h duration (computeDurationHours(9, 8.75) === 23.75h) instead of erroring,
    // so the end lands on the next calendar day for every zone, including the host's own
    // — but the host's *start* stays on the selected date. dayOffset (start-based) alone
    // can't express this; endDayOffset must be nonzero here even though dayOffset is 0.
    const durationHours = computeDurationHours(9, 8.75);
    expect(durationHours).toBeCloseTo(23.75);

    const [london] = computeZoneTimes([LONDON], "2026-06-15", 9, durationHours);
    expect(london.startText).toBe("09:00");
    expect(london.endText).toBe("08:45");
    expect(london.dayOffset).toBe(0);
    expect(london.endDayOffset).toBe(1);
  });

  it("gives a full 24h meeting (Start === End) the same next-day end for every zone", () => {
    const [london, tokyo] = computeZoneTimes([LONDON, TOKYO], "2026-06-15", 9, 24);
    expect(london.dayOffset).toBe(0);
    expect(london.endDayOffset).toBe(1);
    // Tokyo's start is already offset by the zone difference; a full 24h duration should
    // still land its end exactly one day past wherever its start landed.
    expect(tokyo.endDayOffset).toBe(tokyo.dayOffset + 1);
  });

  it("can put the end back on the host's date while the start stays offset from it", () => {
    // A zone whose local start is the day before the host's date, with a duration long
    // enough to bring the end back onto the host's own date: dayOffset -1, endDayOffset 0
    // — not "-1" for the end, since it didn't move relative to the displayed date.
    const HONOLULU: TimeZoneCatalogEntry = {
      id: "us-honolulu",
      city: "Honolulu",
      country: "United States",
      countryCode: "US",
      timezone: "Pacific/Honolulu",
    };
    // London 09:00 on 2026-06-15 is UTC 08:00 (BST); Honolulu (UTC-10) local start is
    // 2026-06-14 22:00 — the day before the host's selected date.
    const [, honolulu] = computeZoneTimes([LONDON, HONOLULU], "2026-06-15", 9, 22);
    expect(honolulu.dayOffset).toBe(-1);
    expect(honolulu.endDayOffset).toBe(0);
  });
});

describe("formatZoneTimesText", () => {
  it("tags the end time independently of the start when only the end lands on a different day", () => {
    const durationHours = computeDurationHours(9, 8.75);
    const slots = computeZoneTimes([LONDON], "2026-06-15", 9, durationHours);
    expect(formatZoneTimesText(slots)).toBe("London 09:00–08:45 (+1)");
  });

  it("tags both start and end the same way when a zone's whole day is shifted, not just its end", () => {
    const slots = computeZoneTimes([LONDON, TOKYO], "2026-06-15", 17, 1);
    // London 17:00 BST is already 01:00 the next day in Tokyo — both Tokyo's start and
    // its 1h-later end fall on that same +1 day, distinct from the "end-only" case above.
    expect(formatZoneTimesText(slots)).toBe("London 17:00–18:00 / Tokyo 01:00 (+1)–02:00 (+1)");
  });
});

describe("buildEndTimeOptions", () => {
  it("rotates to start right after a grid-aligned Start, wrapping Start itself to the end", () => {
    const options = buildEndTimeOptions("17:15");
    expect(options[0].id).toBe("17:30");
    expect(options.at(-1)?.id).toBe("17:15");
    expect(options).toHaveLength(96);
  });

  it("rotates to start at the next 15-minute increment after a custom, off-grid Start", () => {
    // A typed Start of 17:22 isn't itself on the grid, so the list can't wrap back to
    // it exactly — it should still begin at the same next-increment point (17:30) that
    // a grid-aligned Start would produce.
    const options = buildEndTimeOptions("17:22");
    expect(options[0].id).toBe("17:30");
    expect(options).toHaveLength(96);
  });

  it("wraps past midnight for an off-grid Start near the end of the day", () => {
    const options = buildEndTimeOptions("23:58");
    expect(options[0].id).toBe("00:00");
  });
});
