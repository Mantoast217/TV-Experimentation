import { expect, test, type Page } from "@playwright/test";
import { openDashboard, selectPeople } from "./helpers";

/**
 * WCAG 2.4.11 Focus Not Obscured (Minimum): with the sticky selection bar showing, no focused
 * element may be hidden behind it. Anything that fits above the bar must be fully clear of it;
 * something taller than the space above the bar (the timeline region) must not be entirely hidden.
 */
async function problemsWhileTabbing(page: Page): Promise<string[]> {
  const problems = new Set<string>();
  for (const key of ["Tab", "Shift+Tab"]) {
    await page.evaluate((fromEnd) => {
      (document.activeElement as HTMLElement | null)?.blur();
      window.scrollTo(0, fromEnd ? document.body.scrollHeight : 0);
    }, key === "Shift+Tab");
    for (let i = 0; i < 90; i++) {
      await page.keyboard.press(key);
      const problem = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const bar = document.querySelector('[role="region"][aria-label="Selected people"]');
        if (!bar || el === document.body || bar.contains(el)) return null;
        const target = (el.matches("input[type=checkbox], input[type=radio]") ? el.closest("label") : el) ?? el;
        const box = target.getBoundingClientRect();
        const barTop = bar.getBoundingClientRect().top;
        const name = (el.getAttribute("aria-label") || el.textContent?.trim() || el.tagName).slice(0, 40);
        if (box.top >= barTop) return `entirely hidden: ${name}`;
        if (box.height <= barTop && box.bottom > barTop + 0.5) return `partly hidden: ${name}`;
        return null;
      });
      if (problem) problems.add(problem);
    }
  }
  return [...problems];
}

for (const [label, viewport] of [
  ["desktop", { width: 1280, height: 720 }],
  ["phone", { width: 375, height: 667 }],
] as const) {
  test.describe(`focus is never hidden behind the selection bar, ${label}`, () => {
    test.use({ viewport });

    for (const view of ["List", "Timeline"] as const) {
      test(`${view.toLowerCase()} view`, async ({ page }) => {
        await openDashboard(page, view);
        await selectPeople(page);
        expect(await problemsWhileTabbing(page)).toEqual([]);
      });
    }
  });
}
