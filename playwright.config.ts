import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

// Dedicated port, so a run never attaches to a live-data dev server on 3000.
const PORT = 3100

// vite.config.ts serves HTTPS only when the gitignored local dev certs exist,
// so the URL has to follow the same rule (HTTPS on a dev machine, HTTP in CI).
const hasLocalCerts = ['localhost-key.pem', 'localhost.pem'].every((file) =>
  fs.existsSync(path.resolve(import.meta.dirname, file))
)
const baseURL = `${hasLocalCerts ? 'https' : 'http'}://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    // Pinned so dates and times render the same on every machine.
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Mock mode: in-memory seed data, no Power Apps runtime or Dataverse needed.
  webServer: {
    command: `npm run dev:mock -- --port ${PORT} --strictPort`,
    url: baseURL,
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
  },
})
