import { test, expect, medicationCard, medicationSection } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/medications')
  await expect(medicationSection(page, 'Active')).toContainText('Metformin')
})

test('adding a medication puts it in the Active list', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Medication' }).click()

  const form = page.getByRole('dialog', { name: 'Add Medication' })
  await form.getByLabel('Name').fill('Aspirin')
  await form.getByLabel('Dosage').fill('100 mg')
  await form.getByRole('combobox', { name: 'Frequency' }).click()
  await page.getByRole('option', { name: 'Daily' }).click()
  await form.getByRole('combobox', { name: 'Method' }).click()
  await page.getByRole('option', { name: 'Pill' }).click()
  await form.getByLabel('Instructions').fill('Take with food.')
  await form.getByRole('button', { name: 'Save' }).click()

  await expect(form).toBeHidden()
  await expect(page.getByText('Aspirin saved')).toBeVisible()

  const card = medicationCard(page, 'Aspirin')
  await expect(medicationSection(page, 'Active')).toContainText('Aspirin')
  await expect(card).toContainText('100 mg')
  await expect(card).toContainText('Take with food.')
})

test('a weekly medication asks for its scheduled day', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Medication' }).click()

  const form = page.getByRole('dialog', { name: 'Add Medication' })
  await expect(form.getByRole('combobox', { name: 'Scheduled Day' })).toBeHidden()

  await form.getByRole('combobox', { name: 'Frequency' }).click()
  await page.getByRole('option', { name: 'Weekly', exact: true }).click()

  await expect(form.getByRole('combobox', { name: 'Scheduled Day' })).toBeVisible()
})

test('switching a medication off moves it to Inactive', async ({ page }) => {
  await medicationCard(page, 'Ibuprofen').getByRole('switch', { name: 'Active' }).click()

  await expect(medicationSection(page, 'Inactive')).toContainText('Ibuprofen')
  await expect(medicationSection(page, 'Active')).not.toContainText('Ibuprofen')
})

test('deleting a medication removes it after confirmation', async ({ page }) => {
  await medicationCard(page, 'Ibuprofen').getByRole('button', { name: 'Delete' }).click()

  const confirm = page.getByRole('dialog', { name: 'Delete medication?' })
  await expect(confirm).toContainText('Ibuprofen')
  await confirm.getByRole('button', { name: 'Delete' }).click()

  await expect(page.getByText('Ibuprofen deleted')).toBeVisible()
  await expect(page.getByRole('main')).not.toContainText('Ibuprofen')
})
