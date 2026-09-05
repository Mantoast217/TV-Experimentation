import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

describe("contrastRatio", () => {
  it("returns 1 for identical colors", () => {
    expect(contrastRatio("#515158", "#515158")).toBeCloseTo(1, 5);
  });

  it("returns 21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("is symmetric regardless of argument order", () => {
    const a = contrastRatio("#515158", "#f5f5f5");
    const b = contrastRatio("#f5f5f5", "#515158");
    expect(a).toBeCloseTo(b, 10);
  });

  it("the field-label grey (#515158) meets 4.5:1 against the page background (#f5f5f5)", () => {
    // Regression guard for the recurring accessibility punch-list item: Start time /
    // End time / Duration labels must stay at least 4.5:1 (WCAG 2.2 AA, small text).
    expect(contrastRatio("#515158", "#f5f5f5")).toBeGreaterThanOrEqual(4.5);
  });
});
