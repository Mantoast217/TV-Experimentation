import { describe, expect, it } from "vitest";
import { classifyTimeQuality } from "./timeQuality";

/** A zero-length slot at `hour` — midpoint equals the hour itself. */
function at(hour: number) {
  return classifyTimeQuality(hour, hour);
}

describe("classifyTimeQuality", () => {
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
    expect(at(12).dotColor).toBe("var(--color-success)");
    expect(at(8).dotColor).toBe("var(--color-warning)");
    expect(at(18).dotColor).toBe("var(--color-warning)");
    expect(at(2).dotColor).toBe("var(--color-muted)");
  });

  it("classifies by the slot's midpoint, not its start, and always returns a single label", () => {
    // 08:00-10:00 midpoints at 09:00 (Daytime), even though it starts in the
    // Early-morning band — the result is one label, not "Early morning-Daytime".
    const quality = classifyTimeQuality(8, 10);
    expect(quality.label).toBe("Daytime");
    expect(quality.label).not.toContain("–");
  });

  it("finds the correct midpoint for a slot that crosses midnight", () => {
    // 23:00 -> 01:00 next day (raw 23 -> 25) midpoints at 00:00 (Overnight), not at
    // the wrapped average of 23 and 1.
    expect(classifyTimeQuality(23, 25).label).toBe("Overnight");
  });

  it("regression: a 06:00-07:00 slot resolves to the single label Overnight, not a compound string", () => {
    // This is the exact New York slot that previously rendered as the concatenated
    // "Overnight–Early morning". Midpoint is 06:30, entirely within Overnight.
    const quality = classifyTimeQuality(6, 7);
    expect(quality.label).toBe("Overnight");
    expect(quality.label).not.toBe("Overnight–Early morning");
    expect(quality.label).not.toContain("–");
  });

  it("resolves a slot centered exactly on each of the four boundaries to a single label", () => {
    // Centered on 07:00 (06:30-07:30): the boundary itself is the midpoint.
    expect(classifyTimeQuality(6.5, 7.5).label).toBe("Early morning");
    // Centered on 09:00 (08:30-09:30).
    expect(classifyTimeQuality(8.5, 9.5).label).toBe("Daytime");
    // Centered on 17:00 (16:30-17:30).
    expect(classifyTimeQuality(16.5, 17.5).label).toBe("Early evening");
    // Centered on 19:00 (18:30-19:30).
    expect(classifyTimeQuality(18.5, 19.5).label).toBe("Overnight");
  });
});
