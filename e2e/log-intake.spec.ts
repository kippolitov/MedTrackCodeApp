import { test, expect } from './fixtures'

test('logging an overdue dose clears it from the dashboard', async ({ page }) => {
  await page.goto('/')

  const overdue = page.getByRole('region', { name: 'Overdue medications' })
  const metformin = page.getByRole('listitem').filter({ hasText: 'Metformin' })
  await expect(overdue).toContainText('Metformin')

  await metformin.getByRole('button', { name: 'Log' }).click()

  const dialog = page.getByRole('dialog', { name: 'Log Intake' })
  await expect(dialog.getByRole('combobox', { name: 'Medication' })).toContainText('Metformin')
  await expect(dialog.getByRole('button', { name: 'Taken' })).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('button', { name: 'Log Intake' }).click()

  await expect(page.getByText('Intake logged')).toBeVisible()
  await expect(metformin).toContainText('Taken')
  await expect(metformin.getByRole('button', { name: 'Edit Metformin log' })).toBeVisible()
  await expect(overdue).toBeHidden()
})

test('an injection logged on the dashboard shows up on the calendar', async ({ page }) => {
  await page.goto('/')

  await page
    .getByRole('listitem')
    .filter({ hasText: 'Insulin Glargine' })
    .getByRole('button', { name: 'Log' })
    .click()

  // An injection cannot be saved until a site is picked on the body map.
  const dialog = page.getByRole('dialog', { name: 'Log Intake' })
  const save = dialog.getByRole('button', { name: 'Log Intake' })
  await expect(save).toBeDisabled()
  await dialog.getByRole('button', { name: /^Abdominal Left/ }).click()
  await save.click()
  await expect(page.getByText('Intake logged')).toBeVisible()

  await page.getByRole('link', { name: 'Calendar' }).click()

  const dayDetail = page.getByRole('region', { name: 'Day detail' })
  await expect(dayDetail.getByRole('heading', { name: 'March 11, 2026' })).toBeVisible()
  await expect(dayDetail).toContainText('Insulin Glargine')
  await expect(dayDetail).toContainText('Abdominal Left')
})
