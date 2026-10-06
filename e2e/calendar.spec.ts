import { test, expect } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/calendar')
  await expect(page.getByRole('grid', { name: 'March 2026' })).toBeVisible()
})

test('selecting a past day lists that day\'s logs', async ({ page }) => {
  const dayDetail = page.getByRole('region', { name: 'Day detail' })
  await expect(dayDetail).toContainText('No logs for this day.')

  await page.getByRole('gridcell', { name: 'Tuesday, March 10th, 2026' }).click()

  await expect(dayDetail.getByRole('heading', { name: 'March 10, 2026' })).toBeVisible()
  await expect(dayDetail).toContainText('Metformin')
  await expect(dayDetail).toContainText('Insulin Glargine')
})

test('month navigation moves back and returns to today', async ({ page }) => {
  await page.getByRole('button', { name: 'Previous month' }).click()
  await expect(page.getByRole('grid', { name: 'February 2026' })).toBeVisible()

  await page.getByRole('button', { name: 'Today' }).click()
  await expect(page.getByRole('grid', { name: 'March 2026' })).toBeVisible()
  await expect(page.getByRole('gridcell', { name: /^Today, Wednesday, March 11th, 2026/ })).toBeVisible()
})
