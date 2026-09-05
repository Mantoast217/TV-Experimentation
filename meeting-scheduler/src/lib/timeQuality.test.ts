import { describe, expect, it } from "vitest";
import { classifyTimeQuality } from "./timeQuality";

/** A zero-length slot at `hour` — never crosses a boundary, so always a solid dot. */
function at(hour: number) {
  return classifyTimeQuality(hour, hour);
}

describe("classifyTimeQuality — single-band slots", () => {
  it("labels the green band as Daytime", () => {
    expect(at(9).label).toBe("Daytime");
    expect(at(13).label).toBe("Daytime");
    expect(at(16.99).label).toBe("Daytime");
  });

  it("splits the amber band into Early morning and Early evening", () => {
    expect(at(7).label).toBe("Early morning");
    expect(at(8).label).toBe("Early morning");
    expect(at(17).label).toBe("Early evening");
    expect(at(18.5).label).toBe("Early evening");
  });

  it("labels the grey band as Overnight", () => {
    expect(at(0).label).toBe("Overnight");
    expect(at(3.5).label).toBe("Overnight");
    expect(at(19).label).toBe("Overnight");
    expect(at(23.75).label).toBe("Overnight");
  });

  it("resolves each of the four sub-range boundaries to the band that starts there", () => {
    expect(at(7).label).toBe("Early morning");
    expect(at(9).label).toBe("Daytime");
    expect(at(17).label).toBe("Early evening");
    expect(at(19).label).toBe("Overnight");
  });

  it("assigns green/amber/amber/grey dot colors matching the four bands", () => {
    expect(at(12).dotColors).toEqual(["var(--color-success)"]);
    expect(at(8).dotColors).toEqual(["var(--color-warning)"]);
    expect(at(18).dotColors).toEqual(["var(--color-warning)"]);
    expect(at(2).dotColors).toEqual(["var(--color-muted)"]);
  });

  it("a real (non-zero) slot that stays within one band doesn't split", () => {
    expect(classifyTimeQuality(9, 10).bands).toEqual(["daytime"]);
    expect(classifyTimeQuality(9, 10).label).toBe("Daytime");
  });

  it("finds the correct band for a slot that crosses midnight without crossing a color boundary", () => {
    // 23:00 -> 01:00 next day (raw 23 -> 25) stays entirely in Overnight.
    const quality = classifyTimeQuality(23, 25);
    expect(quality.bands).toEqual(["overnight"]);
    expect(quality.label).toBe("Overnight");
  });
});

describe("classifyTimeQuality — slots spanning exactly two bands (split dot)", () => {
  it("splits Overnight/Early morning for a slot ending exactly on the 07:00 boundary", () => {
    // The example from the request: 05:30-07:00.
    const quality = classifyTimeQuality(5.5, 7);
    expect(quality.bands).toEqual(["overnight", "early-morning"]);
    expect(quality.label).toBe("Overnight–Early morning");
    expect(quality.dotColors).toEqual(["var(--color-muted)", "var(--color-warning)"]);
  });

  it("splits Early morning/Daytime for a slot crossing the 09:00 boundary", () => {
    const quality = classifyTimeQuality(8, 10);
    expect(quality.bands).toEqual(["early-morning", "daytime"]);
    expect(quality.label).toBe("Early morning–Daytime");
  });

  it("splits Daytime/Early evening for a slot crossing the 17:00 boundary", () => {
    const quality = classifyTimeQuality(16, 18);
    expect(quality.bands).toEqual(["daytime", "early-evening"]);
    expect(quality.label).toBe("Daytime–Early evening");
  });

  it("splits Early evening/Overnight for a slot crossing the 19:00 boundary", () => {
    const quality = classifyTimeQuality(18, 20);
    expect(quality.bands).toEqual(["early-evening", "overnight"]);
    expect(quality.label).toBe("Early evening–Overnight");
  });

  it("does not split when the slot merely starts on a boundary", () => {
    // 09:00-10:00 starts exactly where Early morning ends, but the slot doesn't occupy
    // any time before its own start, so it's Daytime only.
    expect(classifyTimeQuality(9, 10).bands).toEqual(["daytime"]);
  });

  it("splits correctly using raw (unwrapped) hours across a midnight boundary", () => {
    // Same 06:45-07:15 crossing as the wall-clock case above, but expressed as raw
    // hours from a slot that started the previous day (30.75 -> 31.25 wraps to the
    // same 06:45 -> 07:15): the boundary crossing must still be found correctly.
    const quality = classifyTimeQuality(30.75, 31.25);
    expect(quality.bands).toEqual(["overnight", "early-morning"]);
  });
});

describe("classifyTimeQuality — slots spanning 3+ bands", () => {
  it("falls back to a single midpoint-based band until a 3+-band visual is decided", () => {
    // 05:00-13:00: Overnight -> Early morning -> Daytime. No agreed 3-way visual yet
    // (flagged separately), so this collapses to one representative band.
    const quality = classifyTimeQuality(5, 13);
    expect(quality.bands).toHaveLength(1);
    expect(quality.dotColors).toHaveLength(1);
  });

  it("falls back for a full 24-hour slot that touches every band", () => {
    const quality = classifyTimeQuality(16, 40);
    expect(quality.bands).toHaveLength(1);
  });
});
