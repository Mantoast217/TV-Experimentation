import { defineConfig } from "@playwright/test";

const PORT = 5197;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}/team-dashboard/`,
    browserName: "chromium",
    timezoneId: "Europe/London",
    locale: "en-GB",
    // Lets a machine with a different pre-installed Chromium run the tests. CI installs the matching one.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/team-dashboard/`,
    reuseExistingServer: !process.env.CI,
  },
});
