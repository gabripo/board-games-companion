import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the production build (service worker included), served by
 * `vite preview` with the fixture games. Chromium only — it is preinstalled in CI images.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "off",
    serviceWorkers: "allow",
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    {
      name: "tablet-landscape",
      use: { ...devices["iPad Pro 11 landscape"], browserName: "chromium", deviceScaleFactor: 1 },
    },
  ],
  webServer: {
    command: "pnpm exec vite build && pnpm exec vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { VITE_CONTENT: "fixtures" },
  },
});
