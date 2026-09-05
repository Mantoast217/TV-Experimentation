import { describe, expect, it } from "vitest";
import { computeEndTimeOnStartChange, nextIncrementAfter } from "./scheduling";

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

describe("computeEndTimeOnStartChange", () => {
  it("snaps End to the next increment after a custom, non-aligned Start", () => {
    // A 1-hour meeting starting at the arbitrary 17:22 would preserve-duration to an
    // equally off-grid 18:22 — instead End should land on the next 15-minute mark.
    expect(computeEndTimeOnStartChange("17:22", 15, 1)).toBe("17:30");
  });

  it("preserves the current duration when the new Start is already grid-aligned", () => {
    expect(computeEndTimeOnStartChange("17:15", 15, 1)).toBe("18:15");
    expect(computeEndTimeOnStartChange("16:00", 15, 2.5)).toBe("18:30");
  });

  it("wraps past midnight for a non-aligned Start near the end of the day", () => {
    expect(computeEndTimeOnStartChange("23:58", 15, 1)).toBe("00:00");
  });
});
