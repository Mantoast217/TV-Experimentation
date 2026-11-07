#!/usr/bin/env node
// Checks every colour pairing the dashboard uses, in both themes, against WCAG 2.2 AA: 4.5:1
// for text, 3:1 for controls, borders, the focus ring and the timeline graphics. Runs as part of
// `npm run build`, so a token change that drops a pair below its limit fails the build.
//
// Reads the colour tokens straight from the CSS (HeroUI's theme and src/index.css), so it needs
// no browser. Handles the formats those files use: hex, oklch() and var() references.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CSS_FILES = [
  path.join(appDir, "node_modules/@heroui/styles/dist/themes/default/variables.css"),
  path.join(appDir, "src/index.css"),
];

const TEXT = 4.5;
const NON_TEXT = 3;

/** [foreground token, background token, minimum ratio, where it's used] */
export const PAIRS = [
  ["--foreground", "--background", TEXT, "Body text"],
  ["--secondary-text", "--background", TEXT, "Secondary text"],
  ["--brand-blue", "--background", TEXT, "Name buttons and links"],
  ["--foreground", "--surface", TEXT, "Card text"],
  ["--secondary-text", "--surface", TEXT, "Card secondary text"],
  ["--brand-blue", "--surface", TEXT, "Name buttons on cards"],
  ["--background", "--brand-blue", TEXT, "Primary button text"],
  ["--field-foreground", "--field-background", TEXT, "Search box text"],
  ["--foreground", "--overlay", TEXT, "Dialog text"],
  ["--secondary-text", "--overlay", TEXT, "Dialog secondary text"],
  ["--control-border", "--background", NON_TEXT, "Control and card borders"],
  ["--control-border", "--surface", NON_TEXT, "Borders inside cards"],
  ["--control-border", "--field-background", NON_TEXT, "Search box and menu borders"],
  ["--control-border", "--overlay", NON_TEXT, "Dialog button borders"],
  ["--brand-blue", "--background", NON_TEXT, "Focus ring"],
  ["--brand-blue", "--surface", NON_TEXT, "Focus ring on cards"],
  ["--brand-blue", "--overlay", NON_TEXT, "Focus ring in the dialog"],
  ["--timeline-bar-outline", "--background", NON_TEXT, "Timeline bar outline"],
  ["--timeline-now", "--background", NON_TEXT, "Timeline now line"],
];

/** Collects custom properties for each theme. Dark inherits everything light defines and overrides some. */
function readTokens(cssTexts) {
  const light = new Map();
  const dark = new Map();
  for (const css of cssTexts) {
    const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const block of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectors = block[1].split(";").pop().split(",").map((s) => s.trim());
      if (selectors.some((s) => s.includes("vibrant"))) continue;
      const target = selectors.includes('[data-theme="dark"]')
        ? dark
        : selectors.some((s) => s === ":root" || s === '[data-theme="light"]')
          ? light
          : null;
      if (!target) continue;
      for (const decl of block[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) target.set(decl[1], decl[2].trim());
    }
  }
  return { light, dark: new Map([...light, ...dark]) };
}

function resolve(tokens, name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`Circular reference at ${name}`);
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`Token ${name} is not defined`);
  return value.replace(/var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)/g, (_, ref, fallback) =>
    tokens.has(ref) ? resolve(tokens, ref, new Set([...seen, name])) : fallback?.trim() ?? "",
  );
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const encode = (linear) => {
  const c = clamp01(linear);
  return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
};

/** A CSS colour as the 8-bit sRGB the browser paints. */
export function toRgb(value) {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const oklch = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/i.exec(value);
  if (oklch) {
    const L = Number(oklch[1]) / (oklch[2] ? 100 : 1);
    const C = Number(oklch[3]);
    const h = (Number(oklch[4]) * Math.PI) / 180;
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ].map(encode);
  }
  throw new Error(`Unsupported colour "${value}"`);
}

function luminance([r, g, b]) {
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function checkContrast(cssTexts = CSS_FILES.map((file) => readFileSync(file, "utf8"))) {
  const themes = readTokens(cssTexts);
  const results = [];
  for (const [theme, tokens] of Object.entries(themes)) {
    for (const [fg, bg, min, use] of PAIRS) {
      const ratio = contrast(toRgb(resolve(tokens, fg)), toRgb(resolve(tokens, bg)));
      results.push({ theme, fg, bg, min, use, ratio, pass: ratio >= min });
    }
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const results = checkContrast();
  for (const r of results) {
    console.log(`${r.pass ? "pass" : "FAIL"}  ${r.theme.padEnd(5)}  ${r.ratio.toFixed(2).padStart(5)}:1 (needs ${r.min}:1)  ${r.use}: ${r.fg} on ${r.bg}`);
  }
  const failures = results.filter((r) => !r.pass);
  if (failures.length) {
    console.error(`\n${failures.length} colour pair(s) below the WCAG 2.2 AA minimum.`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} colour pairs meet WCAG 2.2 AA.`);
}
