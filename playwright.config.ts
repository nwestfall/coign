import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Coign SDK browser tests.
 *
 * These tests verify DOM-dependent behavior (widget, modal, context extraction,
 * built-in tools, IIFE queue replay) in a real Chromium browser.
 */
export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/test/fixtures/widget-test.html',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
