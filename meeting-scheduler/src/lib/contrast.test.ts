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

  // Regression guards for the app's two theme-reactive custom colors (index.css
  // --secondary-text / --brand-blue) at WCAG 2.2 AAA thresholds: 7:1 for normal text,
  // 3:1 for non-text UI components (borders, focus indicators — AAA doesn't raise this
  // bar over AA's 1.4.11). Covers the exact regression found when dark mode was added:
  // the previous fixed field-label grey (#515158) measured 7.22:1 against the light
  // page background (#f5f5f5) — just over AAA's 7:1 — but only 2.57:1 against the dark
  // background, since it never adapted between themes (verified live in the browser).

  it("--secondary-text (light: #4a4a51) meets AAA normal-text contrast (7:1) against the light page background (#f5f5f5)", () => {
    expect(contrastRatio("#4a4a51", "#f5f5f5")).toBeGreaterThanOrEqual(7);
  });

  it("--secondary-text (dark: #a0a0aa) meets AAA normal-text contrast (7:1) against the dark page background (#060607)", () => {
    expect(contrastRatio("#a0a0aa", "#060607")).toBeGreaterThanOrEqual(7);
  });

  it("--brand-blue (light: #0d3f9c) meets AAA non-text contrast (3:1) against the light page background (#f5f5f5)", () => {
    // Used for focus outlines/borders that sit directly against the page background —
    // WCAG 2.4.13 Focus Appearance (AAA) requires >=3:1 there, same bar as 1.4.11.
    expect(contrastRatio("#0d3f9c", "#f5f5f5")).toBeGreaterThanOrEqual(3);
  });

  it("--brand-blue (dark: #5c9cff) meets AAA non-text contrast (3:1) against the dark page background (#060607)", () => {
    // The light-mode value (#0d3f9c) measures only ~2.1:1 here (verified live) — this is
    // exactly why dark mode needs its own, lighter shade rather than reusing one color.
    expect(contrastRatio("#5c9cff", "#060607")).toBeGreaterThanOrEqual(3);
  });

  it("the fixed brand-blue-on-white button pairing (#0d3f9c / #ffffff) meets AAA normal-text contrast (7:1) in both themes", () => {
    // This pairing (the "Selected time" card's invite button, and the ErrorBoundary
    // reload button) is deliberately NOT theme-reactive: both buttons sit on a fixed
    // background regardless of theme, so the pairing's own contrast never depends on
    // the surrounding page — verified live to hold in both themes unchanged.
    expect(contrastRatio("#0d3f9c", "#ffffff")).toBeGreaterThanOrEqual(7);
  });
});
