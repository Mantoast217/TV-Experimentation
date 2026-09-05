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
    expect(at(12).dotClassName).toBe("bg-success");
    expect(at(8).dotClassName).toBe("bg-warning");
    expect(at(18).dotClassName).toBe("bg-warning");
    expect(at(2).dotClassName).toBe("bg-muted");
  });

  it("classifies by the slot's midpoint, not its start", () => {
    // 08:00-10:00 midpoints at 09:00 (Daytime), even though it starts in the
    // Early-morning band.
    expect(classifyTimeQuality(8, 10).label).toBe("Daytime");
  });

  it("finds the correct midpoint for a slot that crosses midnight", () => {
    // 23:00 -> 01:00 next day (raw 23 -> 25) midpoints at 00:00 (Overnight), not at
    // the wrapped average of 23 and 1.
    expect(classifyTimeQuality(23, 25).label).toBe("Overnight");
  });
});
