// Captures every Optimizer state into verification/phase-3/ for inspection. Not an assertion suite.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { isPhone, openFresh } from './helpers'

const width = (page: Page) => page.viewportSize()?.width
const shot = (page: Page, name: string, fullPage = true) => page.screenshot({ path: `verification/phase-3/state-${name}-${width(page)}.png`, fullPage })
const status = (page: Page) => page.getByRole('region', { name: 'Results' }).getByRole('status')

async function open(page: Page) {
  if (isPhone(page)) await page.getByRole('navigation', { name: 'Tools' }).last().getByRole('link', { name: 'Optimize' }).click()
  else await page.getByRole('link', { name: 'Optimizer' }).first().click()
  await expect(page.getByRole('heading', { name: 'Optimizer', level: 1 })).toBeVisible()
}

test('capture Optimizer states', async ({ page }) => {
  await openFresh(page)
  await page.getByRole('button', { name: 'Close the guide' }).click()
  await open(page)
  await shot(page, 'setup-empty')

  await page.getByRole('button', { name: 'Add my 5 equipped Echoes' }).click()
  await page.getByRole('button', { name: 'Add an Echo' }).click()
  await page.getByRole('combobox', { name: 'Search by Echo or Sonata set' }).fill('Hoochief')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'Hoochief' })).toBeVisible()
  await page.screenshot({ path: `verification/phase-3/state-inventory-editor-${width(page)}.png` })
  await page.getByRole('button', { name: 'Done' }).click()

  await page.getByRole('button', { name: 'Find the best Echoes' }).click()
  await expect(status(page)).toContainText('Done in', { timeout: 30_000 })
  await shot(page, 'results-mine')

  await page.getByText('Generated plan').click()
  await page.getByRole('button', { name: 'Choose sets' }).click()
  await page.getByRole('button', { name: 'Allow all' }).click()
  await page.screenshot({ path: `verification/phase-3/state-sets-sheet-${width(page)}.png` })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Make a plan' }).click()
  await expect(status(page)).toContainText(/seconds? left|minutes left/, { timeout: 10_000 })
  await page.getByRole('region', { name: 'Results' }).screenshot({ path: `verification/phase-3/state-running-${width(page)}.png` })
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(status(page)).toContainText('Stopped after')
  await shot(page, 'cancelled')
})
