import { expect, test } from "@playwright/test";
import { axeViolations, openDashboard, selectPeople } from "./helpers";

// jsdom can't render, so the unit tests' axe runs skip colour contrast. These run in a browser.
for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`axe in a real browser, ${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test("list view", async ({ page }) => {
      await openDashboard(page);
      expect(await axeViolations(page)).toEqual([]);
    });

    test("timeline view", async ({ page }) => {
      await openDashboard(page, "Timeline");
      expect(await axeViolations(page)).toEqual([]);
    });

    test("phone width, with people selected", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 760 });
      await openDashboard(page);
      await selectPeople(page);
      expect(await axeViolations(page)).toEqual([]);
    });

    test("empty state", async ({ page }) => {
      await openDashboard(page);
      await page.getByRole("searchbox").fill("nobody here");
      await expect(page.getByText("No people match “nobody here”.")).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });

    test("person dialog", async ({ page }) => {
      await openDashboard(page);
      await page.locator("table").getByRole("button", { name: "Liam Sinclair" }).click();
      await expect(page.getByRole("dialog", { name: "Liam Sinclair" })).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });

    test("hand-off step", async ({ page }) => {
      await openDashboard(page);
      await selectPeople(page);
      await page.getByRole("button", { name: "Find a meeting time" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Find a meeting time" })).toBeFocused();
      expect(await axeViolations(page)).toEqual([]);
    });
  });
}
