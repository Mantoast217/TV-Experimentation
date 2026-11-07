import { expect, test, type Page } from "@playwright/test";
import { openDashboard } from "./helpers";

const pageOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("reflow at 320px (WCAG 1.4.10)", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test("the list shows as cards with no sideways scrolling", async ({ page }) => {
    await openDashboard(page);
    expect(await pageOverflow(page)).toBe(0);
    await expect(page.locator("table")).toBeHidden();
    await expect(page.getByRole("heading", { level: 4, name: "Hana Kobayashi" })).toBeVisible();
  });

  test("only the timeline scrolls sideways, inside its own region, and the keyboard can scroll it", async ({ page }) => {
    await openDashboard(page, "Timeline");
    expect(await pageOverflow(page)).toBe(0);
    const region = page.getByRole("region", { name: /^Timeline/ });
    expect(await region.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await region.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    // Each person's text stays inside the visible width.
    const widest = await region.evaluate((el) =>
      Math.max(...[...el.querySelectorAll("li > div:first-child")].map((t) => t.getBoundingClientRect().width)),
    );
    expect(widest).toBeLessThanOrEqual(320);
  });
});

test.describe("200% zoom (WCAG 1.4.4)", () => {
  // A 1280px-wide window at 200% zoom lays out like a 640px-wide one with twice the pixel density.
  test.use({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 });

  test("everything still fits and works", async ({ page }) => {
    await openDashboard(page);
    expect(await pageOverflow(page)).toBe(0);
    await page.getByRole("searchbox").fill("Sydney");
    await expect(page.getByText("Showing 1 of 11 people")).toBeVisible();
    await expect(page.getByRole("heading", { level: 4, name: "Zoe Fitzgerald" })).toBeVisible();
  });
});

test.describe("text spacing (WCAG 1.4.12)", () => {
  for (const view of ["List", "Timeline"] as const) {
    test(`${view.toLowerCase()} view loses no text with wider spacing`, async ({ page }) => {
      await openDashboard(page, view);
      await page.addStyleTag({
        content:
          "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }",
      });
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("body *")]
          .filter((el) => !el.closest(".sr-only") && el.checkVisibility())
          .filter((el) => {
            const s = getComputedStyle(el);
            const hidesY = s.overflowY === "hidden" || s.overflowY === "clip";
            const hidesX = s.overflowX === "hidden" || s.overflowX === "clip";
            return (hidesY && el.scrollHeight > el.clientHeight + 1) || (hidesX && el.scrollWidth > el.clientWidth + 1);
          })
          .map((el) => `${el.tagName}.${el.className}`),
      );
      expect(clipped).toEqual([]);
      if (view === "List") expect(await pageOverflow(page)).toBe(0);
    });
  }
});

test.describe("forced colours (Windows contrast themes)", () => {
  test.use({ colorScheme: "dark" });

  test("timeline bars, the now line and the best-hour boxes keep their outlines", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await openDashboard(page, "Timeline");
    const region = page.getByRole("region", { name: /^Timeline/ });
    const outlines = await region.evaluate((el) => {
      const describe = (node: Element | null, side: "Top" | "Left") => {
        if (!node) return "missing";
        const s = getComputedStyle(node);
        return `${s[`border${side}Style`]} ${s[`border${side}Width`]} ${s[`border${side}Color`]}`;
      };
      return {
        bar: describe(el.querySelector("[class*='timeline-bar-outline']"), "Top"),
        now: describe(el.querySelector("[class*='timeline-now']"), "Left"),
        best: describe(el.querySelector(".font-bold.border-2"), "Top"),
      };
    });
    for (const [name, value] of Object.entries(outlines)) {
      expect(value, name).toMatch(/^solid [1-9]/);
      expect(value, name).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    }
  });

  test("status markers and focus rings still show", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await openDashboard(page);
    await expect(page.locator("table").getByText("●").first()).toBeVisible();
    await page.getByRole("searchbox").focus();
    const ring = await page.getByRole("searchbox").evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(ring).not.toBe("none");
  });
});
