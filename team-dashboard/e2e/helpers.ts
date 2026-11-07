import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Friday 16 October 2026, 14:00 in London: the moment the acceptance values are written for. */
export const NOW = new Date("2026-10-16T13:00:00Z");

export async function openDashboard(page: Page, view: "List" | "Timeline" = "List") {
  await page.clock.setFixedTime(NOW);
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Team dashboard" })).toBeVisible();
  if (view === "Timeline") await page.getByRole("radio", { name: "Timeline" }).check();
}

/** Checkboxes in whichever layout is showing (the table and the cards are both in the page). */
export const visibleCheckboxes = (page: Page) => page.locator("input[type=checkbox]:visible");

export async function selectPeople(page: Page, indexes: number[] = [0, 4, 9]) {
  for (const i of indexes) await visibleCheckboxes(page).nth(i).check();
  await expect(page.getByRole("region", { name: "Selected people" })).toBeVisible();
}

/** WCAG 2.2 A and AA rules, run against the real rendering, so colour contrast is included. */
export async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

/** Describes the focused element briefly, for test failure messages. */
export function focusedName(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return (el?.getAttribute("aria-label") || el?.textContent?.trim() || el?.tagName || "").slice(0, 40);
  });
}
