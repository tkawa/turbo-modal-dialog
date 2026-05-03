import { defineConfig, devices } from "@playwright/test"

const port = 9000
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: "./src/tests/functional",
  testMatch: /.*_tests\.js/,

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL,
    trace: "on-first-retry"
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] }
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] }
    }
  ],

  webServer: {
    command: `PORT=${port} node src/tests/server.mjs`,
    url: baseURL,
    timeout: 10_000,
    reuseExistingServer: !process.env.CI
  }
})
