// Captures every Suggestions state into verification/phase-2/ for inspection. Not an assertion suite.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { isPhone, openFresh, scoreText } from './helpers'

const shot = (page: Page, name: string) => page.screenshot({ path: `verification/phase-2/state-${name}-${page.viewportSize()?.width}.png`, fullPage: true })

async function open(page: Page) {
  if (isPhone(page)) await page.getByRole('navigation', { name: 'Tools' }).last().getByRole('link', { name: 'Suggest' }).click()
  else await page.getByRole('link', { name: 'Suggestions' }).first().click()
  await expect(page.getByRole('heading', { name: 'Suggestions', level: 1 })).toBeVisible()
}

test('capture Suggestions states', async ({ page }) => {
  await openFresh(page)
  await page.getByRole('button', { name: 'Close the guide' }).click()
  await open(page)
  for (const tab of ['Main stats', 'Sets', 'Substats', 'Whole builds']) {
    await page.getByRole('tab', { name: tab }).click()
    await shot(page, `mode-${tab.toLowerCase().replace(' ', '-')}`)
  }
  await page.getByRole('tab', { name: 'Weapons' }).click()
  await page.getByRole('button', { name: /^Try it\b/ }).first().click()
  await expect(page.getByText('Trying now')).toBeVisible()
  await page.screenshot({ path: `verification/phase-2/state-trying-${page.viewportSize()?.width}.png` })
  await page.getByRole('button', { name: 'Discard' }).click()

  await page.getByRole('button', { name: 'Choose weapons I own' }).click()
  await page.getByRole('checkbox', { name: /Verdant Summit/ }).check()
  await page.getByRole('checkbox', { name: /Ages of Harvest/ }).check()
  await page.screenshot({ path: `verification/phase-2/state-owned-sheet-${page.viewportSize()?.width}.png` })
  await page.keyboard.press('Escape')
  await page.getByRole('switch', { name: 'Only weapons I own' }).click()
  await shot(page, 'owned-only')
})

test('capture the step-by-step path on a weakened build', async ({ page }) => {
  await openFresh(page)
  await page.getByRole('button', { name: 'Close the guide' }).click()
  for (const slot of [1, 2, 4]) {
    await page.getByRole('button', { name: new RegExp(`^Edit Echo ${slot}:`) }).click()
    const sheet = page.getByRole('dialog', { name: new RegExp(`Echo ${slot}:`) })
    const select = sheet.getByLabel('Main stat')
    await select.selectOption({ label: (await select.locator('option', { hasText: /^HP% / }).textContent()) ?? '' })
    await sheet.getByRole('button', { name: 'Done' }).click()
  }
  await expect(scoreText(page)).toHaveText(/^\d+\.\d%$/, { timeout: 30_000 })
  await open(page)
  await page.getByRole('tab', { name: 'Main stats' }).click()
  await shot(page, 'path-weakened')
})
