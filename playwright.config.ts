import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  workers: 2,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  webServer: {
    command: "node tests/e2e/support/local-app.mjs --production",
    url: "http://127.0.0.1:4318",
    reuseExistingServer: false,
    timeout: 360_000,
    stdout: "pipe",
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
  },
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4318",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "chromium-system",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined,
          args: ["--no-sandbox"],
        },
      },
    },
  ],
});
