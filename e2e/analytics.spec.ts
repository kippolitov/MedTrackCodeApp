import fs from 'node:fs/promises'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

async function exportCsv(page: Page): Promise<string> {
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.csv$/)
  // saveAs(), not path(): the VS Code extension drives a remotely connected
  // browser, where the download's own path is not readable.
  const savedPath = test.info().outputPath(download.suggestedFilename())
  await download.saveAs(savedPath)
  return fs.readFile(savedPath, 'utf-8')
}

test.beforeEach(async ({ page }) => {
  await page.goto('/analytics')
  await expect(page.getByRole('heading', { name: 'Medication Breakdown' })).toBeVisible()
})

test('the breakdown lists each medication with its adherence', async ({ page }) => {
  const breakdown = page.getByRole('region', { name: 'Per-medication breakdown' })

  await expect(breakdown.getByRole('row', { name: /^Metformin \d+ \d+ \d+%$/ })).toBeVisible()
  await expect(breakdown.getByRole('row', { name: /^Insulin Glargine \d+ \d+ \d+%$/ })).toBeVisible()
})

test('Export CSV downloads the intake logs', async ({ page }) => {
  const csv = await exportCsv(page)

  expect(csv).toContain('Metformin')
  expect(csv).toContain('Insulin Glargine')
})

test('the medication filter narrows the export', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Medication filter' }).click()
  await page.getByRole('option', { name: 'Metformin' }).click()

  const csv = await exportCsv(page)

  expect(csv).toContain('Metformin')
  expect(csv).not.toContain('Insulin Glargine')
})
