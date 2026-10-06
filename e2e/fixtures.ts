import { test as base, expect, type Locator, type Page } from '@playwright/test'

// The seed data in src/mocks/mock-data.ts is built relative to "now", so the
// browser clock is pinned to keep the same doses due and overdue on every run.
// A Wednesday at noon: Metformin (06:00) is overdue, the evening doses are not.
const NOW = new Date('2026-03-11T12:00:00Z')

// The mock store lives in browser memory and resets on every full page load.
// Inside a test, move between pages with the nav links, not page.goto().
export const test = base.extend<{ pinnedClock: void }>({
  pinnedClock: [
    async ({ page }, run) => {
      await page.clock.setFixedTime(NOW)
      await run()
    },
    { auto: true },
  ],
})

export { expect }

/** The "Active" or "Inactive" group on the Medications page. */
export function medicationSection(page: Page, name: 'Active' | 'Inactive'): Locator {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name, exact: true }) })
}

/** One medication's card: the innermost element holding both its schedule and its actions. */
export function medicationCard(page: Page, name: string): Locator {
  return page
    .locator('div')
    .filter({ has: page.getByRole('region', { name: `Schedule for ${name}`, exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Delete' }) })
    .last()
}
