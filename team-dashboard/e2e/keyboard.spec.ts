import { expect, test, type Locator, type Page } from "@playwright/test";
import { focusedName, openDashboard } from "./helpers";

/** Presses Tab until the focused element matches, failing after `limit` presses. */
async function tabTo(page: Page, matches: () => Promise<boolean>, limit = 80, key = "Tab") {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press(key);
    if (await matches()) return;
  }
  throw new Error(`Never reached the target after ${limit} presses of ${key}; last focus: ${await focusedName(page)}`);
}

const isFocused = (locator: Locator) => () => locator.evaluate((el) => el === document.activeElement);
const rowNames = (page: Page) => page.locator('table th[scope="row"]').allTextContents();

test.describe("keyboard only", () => {
  test("the skip link comes first and moves focus to the main content", async ({ page }) => {
    await openDashboard(page);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
  });

  test("search, filter and sort", async ({ page }) => {
    await openDashboard(page);
    const search = page.getByRole("searchbox");
    await tabTo(page, isFocused(search));
    await page.keyboard.type("japan");
    await expect(page.getByText("Showing 1 of 11 people")).toBeVisible();
    expect(await rowNames(page)).toEqual(["Hana Kobayashi"]);
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");

    const status = page.getByRole("combobox", { name: "Status" });
    await tabTo(page, isFocused(status));
    await page.keyboard.press("ArrowDown");
    await expect(status).toHaveValue("working");
    await expect(page.getByText("Showing 5 of 11 people")).toBeVisible();

    const nameHeader = page.locator("table").getByRole("button", { name: /^Name/ });
    await tabTo(page, isFocused(nameHeader));
    await page.keyboard.press("Enter");
    await expect(page.locator("table thead th").filter({ has: page.getByRole("button", { name: /^Name/ }) })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(await rowNames(page)).toEqual(["Amara Okafor", "Arnold Beethoven", "Diego Fernández", "Ethan Walker", "Sofia Bergström"]);
  });

  test("switch views with the arrow keys", async ({ page }) => {
    await openDashboard(page);
    const list = page.getByRole("radio", { name: "List" });
    await tabTo(page, isFocused(list));
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "Timeline" })).toBeChecked();
    await expect(page.getByRole("region", { name: /^Timeline/ })).toBeVisible();
  });

  test("select people with Space, then hand off and come back", async ({ page }) => {
    await openDashboard(page);
    const zoe = page.locator("table").getByRole("checkbox", { name: "Select Zoe Fitzgerald" });
    await tabTo(page, isFocused(zoe));
    await page.keyboard.press("Space");
    await expect(zoe).toBeChecked();
    await expect(page.getByRole("region", { name: "Selected people" })).toContainText("1 person selected");

    const findTime = page.getByRole("button", { name: "Find a meeting time" });
    await tabTo(page, isFocused(findTime));
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Find a meeting time" })).toBeFocused();
    await expect(page).toHaveTitle("Find a meeting time – Team dashboard");

    await tabTo(page, isFocused(page.getByRole("button", { name: "Back" })));
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Find a meeting time" })).toBeFocused();
    await expect(page).toHaveTitle("Team dashboard");
  });

  test("the dialog opens from a name, keeps focus inside, and closes with Esc", async ({ page }) => {
    await openDashboard(page);
    const trigger = page.locator("table").getByRole("button", { name: "Hana Kobayashi" });
    await tabTo(page, isFocused(trigger));
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Hana Kobayashi" });
    await expect(dialog).toBeVisible();

    for (const key of ["Tab", "Shift+Tab"]) {
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press(key);
        expect(await dialog.evaluate((d) => d.contains(document.activeElement)), `focus left the dialog after ${key}`).toBe(true);
      }
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  for (const forcedColors of ["none", "active"] as const) {
    // Forced colours (Windows contrast themes) removes box shadows, so only a real outline counts.
    test(`every control can be reached and shows an outline when focused, forced colours ${forcedColors}`, async ({ page }) => {
      await page.emulateMedia({ forcedColors });
      await openDashboard(page);
      await page.locator("table").getByRole("checkbox", { name: "Select Hana Kobayashi" }).check();
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      const expected = await page.evaluate(
        () =>
          [...document.querySelectorAll<HTMLElement>("a[href], button, input, select, [tabindex='0']")].filter(
            (el) =>
              el.checkVisibility() &&
              !el.matches(":disabled") &&
              el.tabIndex >= 0 &&
              // A radio group is one Tab stop: only its checked radio is reached.
              !(el.matches("input[type=radio]") && !(el as HTMLInputElement).checked),
          ).length,
      );
      const reached = new Set<number>();
      const withoutOutline = new Set<string>();
      for (let i = 0; i < expected * 2 && reached.size < expected; i++) {
        await page.keyboard.press("Tab");
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          if (el === document.body) return null;
          // Checkboxes and radios draw their ring on the label around them.
          const ringed = el.matches("input[type=checkbox], input[type=radio]") ? el.closest("label")! : el;
          const style = getComputedStyle(ringed);
          return {
            index: [...document.querySelectorAll("*")].indexOf(el),
            outline: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2,
          };
        });
        if (!info) continue;
        reached.add(info.index);
        if (!info.outline) withoutOutline.add(await focusedName(page));
      }
      expect(reached.size).toBe(expected);
      expect([...withoutOutline]).toEqual([]);
    });
  }
});

test.describe("outlines on controls that only appear later, forced colours active", () => {
  const outlineOnFocused = (page: Page) =>
    page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as HTMLElement);
      return style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2;
    });

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await openDashboard(page);
  });

  test("the dialog's buttons", async ({ page }) => {
    await tabTo(page, isFocused(page.locator("table").getByRole("button", { name: "Hana Kobayashi" })));
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    for (const name of ["Add to meeting", "Copy email", "Close"]) {
      await tabTo(page, isFocused(dialog.getByRole("button", { name })), 10);
      expect(await outlineOnFocused(page), name).toBe(true);
    }
  });

  test("Clear search and filters", async ({ page }) => {
    await tabTo(page, isFocused(page.getByRole("searchbox")));
    await page.keyboard.type("nobody");
    await tabTo(page, isFocused(page.getByRole("button", { name: "Clear search and filters" })));
    expect(await outlineOnFocused(page)).toBe(true);
  });

  test("Back on the hand-off step", async ({ page }) => {
    await tabTo(page, isFocused(page.locator("table").getByRole("checkbox", { name: "Select Hana Kobayashi" })));
    await page.keyboard.press("Space");
    await tabTo(page, isFocused(page.getByRole("button", { name: "Find a meeting time" })));
    await page.keyboard.press("Enter");
    await tabTo(page, isFocused(page.getByRole("button", { name: "Back" })));
    expect(await outlineOnFocused(page)).toBe(true);
  });
});
