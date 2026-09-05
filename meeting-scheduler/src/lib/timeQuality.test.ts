import { describe, expect, it } from "vitest";
import { classifyTimeQuality } from "./timeQuality";

/** A zero-length slot at `hour` — never crosses a boundary, so always a solid dot. */
function at(hour: number) {
  return classifyTimeQuality(hour, hour);
}

describe("classifyTimeQuality — single-band slots", () => {
  it("labels 00:00-06:00 as Night, grey", () => {
    expect(at(0).label).toBe("Night");
    expect(at(3).label).toBe("Night");
    expect(at(5.99).label).toBe("Night");
    expect(at(0).dotColors).toEqual(["var(--color-muted)"]);
  });

  it("labels 06:00-09:00 as Early morning, amber", () => {
    expect(at(6).label).toBe("Early morning");
    expect(at(8).label).toBe("Early morning");
    expect(at(6).dotColors).toEqual(["var(--color-warning)"]);
  });

  it("labels 09:00-12:00 as Morning, green", () => {
    expect(at(9).label).toBe("Morning");
    expect(at(11).label).toBe("Morning");
    expect(at(9).dotColors).toEqual(["var(--color-success)"]);
  });

  it("labels 12:00-17:00 as Afternoon, green", () => {
    expect(at(12).label).toBe("Afternoon");
    expect(at(16).label).toBe("Afternoon");
    expect(at(12).dotColors).toEqual(["var(--color-success)"]);
  });

  it("labels 17:00-21:00 as Evening, amber", () => {
    expect(at(17).label).toBe("Evening");
    expect(at(20).label).toBe("Evening");
    expect(at(17).dotColors).toEqual(["var(--color-warning)"]);
  });

  it("labels 21:00-00:00 as Late evening, grey", () => {
    expect(at(21).label).toBe("Late evening");
    expect(at(22).label).toBe("Late evening");
    expect(at(23.99).label).toBe("Late evening");
    expect(at(21).dotColors).toEqual(["var(--color-muted)"]);
  });

  it("resolves each of the six boundaries to the band that starts there", () => {
    expect(at(6).label).toBe("Early morning");
    expect(at(9).label).toBe("Morning");
    expect(at(12).label).toBe("Afternoon");
    expect(at(17).label).toBe("Evening");
    expect(at(21).label).toBe("Late evening");
    expect(at(24).label).toBe("Night");
  });

  it("stays a single band when the slot doesn't cross a color boundary", () => {
    expect(classifyTimeQuality(9, 11).bands).toEqual(["morning"]);
  });

  it("finds the correct band for a slot that crosses midnight without crossing a color boundary", () => {
    // 22:00 -> 23:00 next-cycle-equivalent stays entirely in Late evening.
    const quality = classifyTimeQuality(22, 23);
    expect(quality.bands).toEqual(["late-evening"]);
  });
});

describe("classifyTimeQuality — slots spanning exactly two bands (split dot)", () => {
  it("splits Afternoon/Evening for a slot crossing the 17:00 boundary, as in the example", () => {
    const quality = classifyTimeQuality(16, 18);
    expect(quality.bands).toEqual(["afternoon", "evening"]);
    expect(quality.label).toBe("Afternoon - Evening");
    expect(quality.dotColors).toEqual(["var(--color-success)", "var(--color-warning)"]);
  });

  it("splits Night/Early morning for a slot ending exactly on the 06:00 boundary", () => {
    const quality = classifyTimeQuality(5.5, 6);
    expect(quality.bands).toEqual(["night", "early-morning"]);
    expect(quality.label).toBe("Night - Early morning");
  });

  it("splits Early morning/Morning for a slot crossing the 09:00 boundary", () => {
    const quality = classifyTimeQuality(8, 10);
    expect(quality.bands).toEqual(["early-morning", "morning"]);
    expect(quality.label).toBe("Early morning - Morning");
  });

  it("splits Morning/Afternoon for a slot crossing the 12:00 boundary", () => {
    const quality = classifyTimeQuality(11, 13);
    expect(quality.bands).toEqual(["morning", "afternoon"]);
    expect(quality.label).toBe("Morning - Afternoon");
  });

  it("splits Evening/Late evening for a slot crossing the 21:00 boundary", () => {
    const quality = classifyTimeQuality(20, 22);
    expect(quality.bands).toEqual(["evening", "late-evening"]);
    expect(quality.label).toBe("Evening - Late evening");
  });

  it("splits Late evening/Night for a slot crossing midnight", () => {
    const quality = classifyTimeQuality(23, 25);
    expect(quality.bands).toEqual(["late-evening", "night"]);
    expect(quality.label).toBe("Late evening - Night");
  });

  it("does not split when the slot merely starts on a boundary", () => {
    // 06:00-07:00 starts exactly where Night ends, but the slot doesn't occupy any
    // time before its own start, so it's Early morning only.
    expect(classifyTimeQuality(6, 7).bands).toEqual(["early-morning"]);
  });
});

describe("classifyTimeQuality — slots spanning 3+ bands (first/last split dot)", () => {
  it("splits Morning/Late evening for the 09:00-23:00 example, skipping the bands in between", () => {
    const quality = classifyTimeQuality(9, 23);
    expect(quality.bands).toEqual(["morning", "late-evening"]);
    expect(quality.label).toBe("Morning - Late evening");
    expect(quality.dotColors).toEqual(["var(--color-success)", "var(--color-muted)"]);
  });

  it("splits Early morning/Afternoon for a slot crossing three boundaries", () => {
    // 08:00-13:00: Early morning -> Morning -> Afternoon.
    const quality = classifyTimeQuality(8, 13);
    expect(quality.bands).toEqual(["early-morning", "afternoon"]);
    expect(quality.label).toBe("Early morning - Afternoon");
  });

  it("collapses to a solid dot when a 24h+ slot wraps back into its starting band", () => {
    // 09:00 to 09:00 the next day: touches every band and lands back in Morning.
    const quality = classifyTimeQuality(9, 33);
    expect(quality.bands).toEqual(["morning"]);
    expect(quality.label).toBe("Morning");
    expect(quality.dotColors).toEqual(["var(--color-success)"]);
  });

  it("collapses to a solid dot for a 24h+ slot wrapping back into a non-Morning starting band", () => {
    // 23:00 to 22:00 the next day (23h): touches every band and lands back in Late evening.
    const quality = classifyTimeQuality(23, 46);
    expect(quality.bands).toEqual(["late-evening"]);
    expect(quality.label).toBe("Late evening");
  });
});
