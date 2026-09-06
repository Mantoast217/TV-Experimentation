import { DateTime } from "luxon";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  dstFallBackTransition,
  dstSpringForwardTransition,
  dstTransitionWithMinuteInWindow,
  NUM_RUNS,
  scaledTimeout,
} from "../test/arbitraries";
import { computeZoneTimes } from "./scheduling";
import { wallClockToUtcDate } from "./timezones";
import type { TimeZoneCatalogEntry } from "./timezones";

function zoneEntry(timezone: string): TimeZoneCatalogEntry {
  return { id: "host", city: "Host", country: "Host", countryCode: "ZZ", timezone };
}

function parseHHMM(text: string): { hour: number; minute: number } {
  const [hour, minute] = text.split(":").map(Number);
  return { hour, minute };
}

describe("DST spring-forward — property-based", () => {
  it("never renders a nonexistent local time for a start time inside the skipped window", () => {
    fc.assert(
      fc.property(dstTransitionWithMinuteInWindow(dstSpringForwardTransition()), ({ transition, hour, minute }) => {
        const requestedHHMM = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        const hostZone = zoneEntry(transition.zone);
        const [slot] = computeZoneTimes([hostZone], transition.date, hour + minute / 60, 1);

        // The exact nonexistent reading we asked for must never be what's displayed.
        expect(slot.startText).not.toBe(requestedHHMM);

        // What *is* displayed must be a genuinely valid, self-consistent wall-clock
        // reading in that zone on that date — reconstructing it must not itself get
        // silently re-normalized to something else again.
        const { hour: shownHour, minute: shownMinute } = parseHHMM(slot.startText);
        const [y, m, d] = transition.date.split("-").map(Number);
        const reconstructed = DateTime.fromObject({ year: y, month: m, day: d, hour: shownHour, minute: shownMinute }, { zone: transition.zone });
        expect(reconstructed.hour).toBe(shownHour);
        expect(reconstructed.minute).toBe(shownMinute);

        // And it must fall outside the skipped window (before it, or from the
        // post-transition offset onward) — never inside the gap itself.
        const shownMinuteOfDay = shownHour * 60 + shownMinute;
        const inGap =
          shownMinuteOfDay >= transition.windowStartMinuteOfDay &&
          shownMinuteOfDay < transition.windowStartMinuteOfDay + transition.windowSizeMinutes;
        expect(inGap).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  }, scaledTimeout(5));
});

describe("DST fall-back — property-based", () => {
  it("resolves an ambiguous local time to the same instant every time, not a random flip between the two", () => {
    fc.assert(
      fc.property(dstTransitionWithMinuteInWindow(dstFallBackTransition()), ({ transition, hour, minute }) => {
        const hourDecimal = hour + minute / 60;

        const first = wallClockToUtcDate(transition.date, hourDecimal, transition.zone);
        const second = wallClockToUtcDate(transition.date, hourDecimal, transition.zone);
        const third = wallClockToUtcDate(transition.date, hourDecimal, transition.zone);

        // Deterministic: repeated calls with the same input never flip interpretation.
        expect(second.getTime()).toBe(first.getTime());
        expect(third.getTime()).toBe(first.getTime());

        // The resolved instant must be one of the two legitimate readings for this
        // ambiguous wall-clock time (i.e. our wrapper picked a real interpretation, not
        // some third, wrong instant) — and must match a fresh, independent Luxon
        // resolution of the same fields, so our wrapper isn't introducing its own
        // disambiguation on top of (or instead of) Luxon's own deterministic one.
        const resolvedLocal = DateTime.fromJSDate(first, { zone: transition.zone });
        expect([transition.offsetBeforeMinutes, transition.offsetAfterMinutes]).toContain(resolvedLocal.offset);

        const [y, m, d] = transition.date.split("-").map(Number);
        const independentResolution = DateTime.fromObject({ year: y, month: m, day: d, hour, minute }, { zone: transition.zone });
        expect(resolvedLocal.offset).toBe(independentResolution.offset);
      }),
      { numRuns: NUM_RUNS },
    );
  }, scaledTimeout(5));
});
