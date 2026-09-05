import { describe, expect, it } from "vitest";
import { buildEndTimeOptions, nextIncrementAfter } from "./scheduling";

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
