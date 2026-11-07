import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    // Browser tests run with Playwright (npm run test:e2e), not Vitest.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
