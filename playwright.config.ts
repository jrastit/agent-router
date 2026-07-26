import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:32147",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      "E2E_TEST_MODE=true npm run dev -- --webpack --hostname 127.0.0.1 --port 32147",
    url: "http://127.0.0.1:32147/e2e/llm-job",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
