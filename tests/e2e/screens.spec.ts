// Saves every Phase 1 screen state at both widths into verification/phase-1 for inspection.
// Run with: npx playwright test screens
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { openFresh } from './helpers'

const shot = async (page: Page, name: string, fullPage = false) => {
  const width = page.viewportSize()?.width ?? 0
  await page.screenshot({ path: `verification/phase-1/state-${name}-${width}.png`, fullPage })
}

test('capture Build page states', async ({ page }) => {
  await openFresh(page)
  await shot(page, 'build-top')

  await page.getByRole('button', { name: 'Change Resonator' }).click()
  await expect(page.getByRole('dialog', { name: 'Choose a Resonator' })).toBeVisible()
  await shot(page, 'resonator-picker')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: /^Edit Echo 1:/ }).click()
  await expect(page.getByRole('dialog', { name: /Echo 1:/ })).toBeVisible()
  await shot(page, 'echo-editor')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'How this was calculated' }).click()
  await expect(page.getByRole('dialog', { name: 'How this was calculated' })).toBeVisible()
  await shot(page, 'ledger-sheet')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'What the score means' }).click()
  await expect(page.getByText('Best main stats here')).toBeVisible()
  await shot(page, 'score-meaning')
  await page.keyboard.press('Escape')

  await page.getByRole('tab', { name: 'Damage by hit' }).click()
  const firstStep = page.locator('ol summary').first()
  await firstStep.scrollIntoViewIfNeeded()
  await firstStep.click()
  await page.waitForTimeout(200)
  await firstStep.screenshot({ path: `verification/phase-1/state-hit-row-${page.viewportSize()?.width}.png` })
  await page.locator('ol details').first().screenshot({ path: `verification/phase-1/state-hit-formula-${page.viewportSize()?.width}.png` })

  await page.getByRole('switch', { name: 'Show everything' }).click()
  await page.getByRole('switch', { name: 'Show everything' }).scrollIntoViewIfNeeded()
  await shot(page, 'show-everything')
})

test('capture a new empty build, Saved builds and Compare', async ({ page }) => {
  await openFresh(page)
  await page.getByRole('button', { name: /^Your builds\. Open now:/ }).click()
  await shot(page, 'build-list')
  await page.getByRole('button', { name: 'New build' }).click()
  await page.getByRole('combobox', { name: 'Search by name' }).fill('Phoebe')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Build score' })).toBeVisible()
  await page.waitForTimeout(1500)
  await shot(page, 'new-empty-build', true)

  await page.getByRole('link', { name: /^Saved/ }).click()
  await page.waitForTimeout(1500)
  await shot(page, 'saved', true)

  await page.getByRole('link', { name: 'Compare' }).click()
  await page.waitForTimeout(1500)
  await shot(page, 'compare', true)
})
