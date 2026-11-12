import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { isPhone, openFresh, scoreText } from './helpers'

const headerScore = (page: Page) => page.locator('[data-header-score]').first()

async function openSuggestions(page: Page) {
  if (isPhone(page)) await page.getByRole('navigation', { name: 'Tools' }).last().getByRole('link', { name: 'Suggest' }).click()
  else await page.getByRole('link', { name: 'Suggestions' }).first().click()
  await expect(page.getByRole('heading', { name: 'Suggestions', level: 1 })).toBeVisible()
}

/** Sets an Echo's main stat to HP%, so the build has something to fix. */
async function weakenMainStat(page: Page, slot: number) {
  await page.getByRole('button', { name: new RegExp(`^Edit Echo ${slot}:`) }).click()
  const sheet = page.getByRole('dialog', { name: new RegExp(`Echo ${slot}:`) })
  const select = sheet.getByLabel('Main stat')
  const label = await select.locator('option', { hasText: /^HP% / }).textContent()
  await select.selectOption({ label: label ?? '' })
  await sheet.getByRole('button', { name: 'Done' }).click()
}

test('Try it shows the change everywhere, and Discard puts the build back', async ({ page }) => {
  await openFresh(page)
  const before = await headerScore(page).textContent()
  await openSuggestions(page)
  await page.getByRole('button', { name: /^Try it\b/ }).first().click()
  await expect(page.getByRole('status').filter({ hasText: 'Trying:' })).toBeVisible()
  await expect(page.getByText('Trying now')).toBeVisible()
  await expect(headerScore(page)).not.toHaveText(before ?? '')
  await page.getByRole('button', { name: 'Discard' }).click()
  await expect(headerScore(page)).toHaveText(before ?? '')
  await expect(page.getByRole('status').filter({ hasText: 'Trying:' })).toHaveCount(0)
})

test('the step-by-step path applies three changes, and undo takes them back one at a time', async ({ page }) => {
  await openFresh(page)
  for (const slot of [1, 2, 4]) await weakenMainStat(page, slot)
  await expect(scoreText(page)).toHaveText(/^\d+\.\d%$/, { timeout: 30_000 })
  const weakened = await headerScore(page).textContent()

  await openSuggestions(page)
  const path = page.getByRole('region', { name: 'Step by step' })
  await expect(path.getByText('Step 3')).toBeVisible()
  await path.getByRole('button', { name: 'Apply all 3' }).click()
  await expect(headerScore(page)).not.toHaveText(weakened ?? '')
  const improved = Number((await headerScore(page).textContent())?.replace('%', ''))
  expect(improved).toBeGreaterThan(Number(weakened?.replace('%', '')))

  const undo = page.getByRole('button', { name: /^Undo: Suggested: / }).first()
  for (let i = 0; i < 3; i += 1) await undo.click()
  await expect(headerScore(page)).toHaveText(weakened ?? '')
  await expect(page.getByRole('button', { name: /^Undo: Set Echo 4 main stat to HP%/ }).first()).toBeVisible()
})

test('substats name the next best roll to farm', async ({ page }) => {
  await openFresh(page)
  await openSuggestions(page)
  await page.getByRole('tab', { name: 'Substats' }).click()
  await expect(page.getByText(/^Your next best roll is .+ on any Echo\.$/)).toBeVisible()
})
