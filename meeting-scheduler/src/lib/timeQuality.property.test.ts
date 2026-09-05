import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ianaTimezone, isoDateInRange, NUM_RUNS, startAndDuration } from "../test/arbitraries";
import { computeZoneTimes, wrapHour } from "./scheduling";
import { classifyTimeQuality, type TimeQualityBand } from "./timeQuality";

/**
 * Property-based coverage for time-of-day classification, supplementing (not replacing)
 * timeQuality.test.ts's example-based cases.
 *
 * NOTE on scope: the task that requested this suite described a 4-label scheme (Daytime /
 * Early morning / Early evening / Overnight, boundaries at 07:00/09:00/17:00/19:00) where
 * a slot "must resolve to exactly one of the four labels — never a compound string." That
 * describes an earlier version of this feature. The shipped implementation (see
 * timeQuality.ts) uses a 6-band scheme (Night/Early morning/Morning/Afternoon/Evening/Late
 * evening, boundaries at 06:00/09:00/12:00/17:00/21:00) and *intentionally* produces a
 * compound "X - Y" label with a split dot for a slot spanning two (or more, collapsed to
 * first/last) bands — that was a deliberate, explicit request earlier in this project.
 * These properties test the real, current behavior rather than the stale spec, since
 * asserting the literal old spec would just fail against correct, intended code.
 */

/** Independently mirrors the documented 6-band boundaries — not imported from timeQuality.ts. */
function expectedBandForHour(hourOfDay: number): TimeQualityBand {
  if (hourOfDay >= 6 && hourOfDay < 9) return "early-morning";
  if (hourOfDay >= 9 && hourOfDay < 12) return "morning";
  if (hourOfDay >= 12 && hourOfDay < 17) return "afternoon";
  if (hourOfDay >= 17 && hourOfDay < 21) return "evening";
  if (hourOfDay >= 21) return "late-evening";
  return "night";
}

const EXPECTED_LABEL: Record<TimeQualityBand, string> = {
  night: "Night",
  "early-morning": "Early morning",
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  "late-evening": "Late evening",
};

const EXPECTED_DOT_COLOR: Record<TimeQualityBand, string> = {
  night: "var(--color-muted)",
  "early-morning": "var(--color-warning)",
  morning: "var(--color-success)",
  afternoon: "var(--color-success)",
  evening: "var(--color-warning)",
  "late-evening": "var(--color-muted)",
};

const ALL_BANDS: readonly TimeQualityBand[] = ["night", "early-morning", "morning", "afternoon", "evening", "late-evening"];

describe("classifyTimeQuality — property-based", () => {
  it("always resolves to 1 or 2 known bands, matching an independently-computed boundary classification", () => {
    fc.assert(
      fc.property(
        ianaTimezone(),
        isoDateInRange(),
        startAndDuration(),
        (zone, dateStr, { startHour, startMinute, durationMinutes }) => {
          const startHourDecimal = startHour + startMinute / 60;
          const durationHours = durationMinutes / 60;
          const [slot] = computeZoneTimes(
            [{ id: "z", city: "Z", country: "Z", countryCode: "ZZ", timezone: zone }],
            dateStr,
            startHourDecimal,
            durationHours,
          );

          const quality = classifyTimeQuality(slot.startHourRaw, slot.endHourRaw);

          // Never undefined/null, never 0 or 3+ bands.
          expect(quality).toBeDefined();
          expect(quality.bands.length === 1 || quality.bands.length === 2).toBe(true);
          expect(quality.dotColors).toHaveLength(quality.bands.length);
          quality.bands.forEach((band) => expect(ALL_BANDS).toContain(band));

          // The first band must match an independent classification of the start hour,
          // and the last band an independent classification of the end hour — this holds
          // for both a solid (1-band) and split (2-band) result, since collapsing 3+
          // touched bands to first/last (or to a single solid band on a full wraparound)
          // never changes what band the start/end instants themselves fall into.
          const expectedFirst = expectedBandForHour(wrapHour(slot.startHourRaw));
          const expectedLast = expectedBandForHour(wrapHour(slot.endHourRaw));
          expect(quality.bands[0]).toBe(expectedFirst);
          expect(quality.bands[quality.bands.length - 1]).toBe(expectedLast);

          // Label and dot colors must match the bands exactly, independently reconstructed.
          expect(quality.label).toBe(quality.bands.map((b) => EXPECTED_LABEL[b]).join(" - "));
          expect(quality.dotColors).toEqual(quality.bands.map((b) => EXPECTED_DOT_COLOR[b]));
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("never returns a compound label when the slot stays within a single band", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 23.98, noNaN: true }), fc.double({ min: 0, max: 3, noNaN: true }), (start, span) => {
        const end = start + span;
        // Only keep cases that provably don't cross a band boundary between start and end.
        const boundaries = [6, 9, 12, 17, 21, 24];
        const crossesBoundary = boundaries.some((b) => b > start && b <= end);
        fc.pre(!crossesBoundary);

        const quality = classifyTimeQuality(start, end);
        expect(quality.bands).toHaveLength(1);
        expect(quality.label).not.toContain(" - ");
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
