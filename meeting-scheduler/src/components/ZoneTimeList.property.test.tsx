import { render, screen } from "@testing-library/react";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isoDateInRange, NUM_RUNS, startAndDuration, zoneList } from "../test/arbitraries";
import { computeZoneTimes } from "../lib/scheduling";
import { classifyTimeQuality } from "../lib/timeQuality";
import type { TimeZoneCatalogEntry } from "../lib/timezones";
import { ZoneTimeList } from "./ZoneTimeList";

// Full React mounts are far more expensive per iteration than the pure-logic property
// tests elsewhere in this suite, so these need a longer test timeout to run NUM_RUNS
// iterations without tripping vitest's default 5s limit. Scaled to NUM_RUNS (rather than
// a fixed constant) so the nightly high-iteration run (FC_NUM_RUNS=50000) doesn't time
// out just because it wasn't sized for the every-PR default of 1000.
const RENDER_TEST_TIMEOUT_MS = Math.max(60_000, NUM_RUNS * 50);

function toCatalogEntries(timezones: string[]): TimeZoneCatalogEntry[] {
  return timezones.map((timezone, index) => ({
    id: `zone-${index}`,
    city: `City ${index}`,
    country: `Country ${index}`,
    countryCode: "ZZ",
    timezone,
  }));
}

describe("ZoneTimeList — attendee rendering (property-based)", () => {
  it(
    "renders exactly one listitem per attendee, each with a classification label, for any 1-10 zone list",
    () => {
      fc.assert(
        fc.property(
          zoneList(),
          isoDateInRange(),
          startAndDuration(),
          (timezones, dateStr, { startHour, startMinute, durationMinutes }) => {
            const zones = toCatalogEntries(timezones);
            const slots = computeZoneTimes(zones, dateStr, startHour + startMinute / 60, durationMinutes / 60);

            const { unmount, container } = render(<ZoneTimeList slots={slots} />);
            try {
              // Exactly one line per attendee — never dropped, never duplicated.
              const items = screen.getAllByRole("listitem");
              expect(items).toHaveLength(zones.length);

              items.forEach((item, index) => {
                expect(item.textContent).toBeTruthy();
                expect(item.textContent).toContain(zones[index].city);
                // City, time range, and classification label are now separate lines (see
                // ZoneTimeList.tsx) — independently re-derived rather than hardcoded, so
                // this stays correct across every band/compound-label combination the
                // fuzzer can produce (e.g. "Afternoon - Evening", "Spans full day").
                const slot = slots[index];
                const expectedLabel = classifyTimeQuality(slot.startHourRaw, slot.endHourRaw).label;
                expect(item.textContent).toContain(expectedLabel);
              });

              // Regression guard (generalized across list length): attendees were
              // previously joined with a "/" separator, causing a wrapping/orphaned-
              // separator bug. No attendee line or separator should ever reintroduce one.
              expect(container.textContent).not.toContain("/");
            } finally {
              unmount();
            }
          },
        ),
        { numRuns: NUM_RUNS },
      );
    },
    RENDER_TEST_TIMEOUT_MS,
  );

  it(
    "never throws for any 1-10 zone list, including duplicated timezones",
    () => {
      fc.assert(
        fc.property(
          zoneList(),
          isoDateInRange(),
          startAndDuration(),
          (timezones, dateStr, { startHour, startMinute, durationMinutes }) => {
            const zones = toCatalogEntries(timezones);
            const slots = computeZoneTimes(zones, dateStr, startHour + startMinute / 60, durationMinutes / 60);
            expect(() => {
              const { unmount } = render(<ZoneTimeList slots={slots} />);
              unmount();
            }).not.toThrow();
          },
        ),
        { numRuns: NUM_RUNS },
      );
    },
    RENDER_TEST_TIMEOUT_MS,
  );
});
