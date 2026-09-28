import { defineConfig, devices } from '@playwright/test'

/**
 * Virtual Spaces end to end against a real Supabase stack (`npx supabase start`).
 * Build with NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY pointing at it, then:
 *   SUPABASE_TEST_URL=... SUPABASE_TEST_SERVICE_KEY=... npx playwright test -c playwright.cloud.config.ts
 */
export default defineConfig({
  testDir: 'tests/e2e-cloud',
  timeout: 90_000,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4173/myplace/',
    trace: 'retain-on-failure',
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
      ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}),
    },
  },
  webServer: { command: 'node tools/serve-export.mjs 4173', url: 'http://localhost:4173/myplace/', reuseExistingServer: true },
})
