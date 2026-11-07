import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkContrast, contrast, toRgb } from "../scripts/check-contrast.mjs";

const appRoot = path.resolve(__dirname, "..");
const heroui = readFileSync(path.join(appRoot, "node_modules/@heroui/styles/dist/themes/default/variables.css"), "utf8");
const ours = readFileSync(path.join(appRoot, "src/index.css"), "utf8");

describe("contrast check", () => {
  it("converts the colour formats the tokens use", () => {
    expect(toRgb("#767676")).toEqual([118, 118, 118]);
    expect(toRgb("#fff")).toEqual([255, 255, 255]);
    expect(toRgb("oklch(100% 0 0)")).toEqual([255, 255, 255]);
    expect(toRgb("oklch(0 0 0)")).toEqual([0, 0, 0]);
    // HeroUI's light-mode text colour, checked against the browser's own conversion.
    expect(toRgb("oklch(0.2103 0.0059 285.89)")).toEqual([24, 24, 27]);
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrast([118, 118, 118], [255, 255, 255])).toBeCloseTo(4.54, 2);
  });

  it("passes every pair in both themes", () => {
    const failures = checkContrast().filter((r) => !r.pass);
    expect(failures).toEqual([]);
  });

  it("fails when a token is changed to something too pale", () => {
    const paler = ours.replace("--secondary-text: #4a4a51;", "--secondary-text: #9a9aa0;");
    const failures = checkContrast([heroui, paler]).filter((r) => !r.pass);
    expect(failures.map((r) => `${r.theme} ${r.use}`)).toContain("light Secondary text");
  });
});
