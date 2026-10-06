import { test, expect } from './fixtures'

test('the sidebar reaches every page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Good afternoon, Alex' })).toBeVisible()

  for (const name of ['Medications', 'Calendar', 'Analytics']) {
    await page.getByRole('link', { name }).click()
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  }

  await page.getByRole('link', { name: 'Home' }).click()
  await expect(page.getByRole('heading', { name: "Today's Schedule" })).toBeVisible()
})

test('a page opens directly from its URL', async ({ page }) => {
  await page.goto('/calendar')
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible()
})
