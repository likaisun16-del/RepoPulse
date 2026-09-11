import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["ai-*.spec.ts", "ranking.spec.ts"],
  fullyParallel: true,
  workers: 2,
  use: { baseURL: "http://127.0.0.1:3001", trace: "off" },
  projects: [
    { name: "server", testMatch: "ai-server.spec.ts" },
    { name: "desktop", testMatch: "ai-ui.spec.ts", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", testMatch: "ai-ui.spec.ts", use: { ...devices["Pixel 7"] } },
    { name: "regression", testMatch: "ranking.spec.ts", use: { ...devices["Desktop Chrome"] } },
  ],
});
