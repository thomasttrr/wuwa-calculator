// The brief's shared-build check: change one Echo and every tool shows the same new score.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { isPhone, openFresh, scoreText } from './helpers'

const go = async (page: Page, wide: string, short: string, heading: string) => {
  if (isPhone(page)) await page.getByRole('navigation', { name: 'Tools' }).last().getByRole('link', { name: short, exact: true }).click()
  else await page.getByRole('link', { name: wide, exact: true }).first().click()
  await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
}

test('one Echo change shows the same new score on Build, Suggestions, Optimizer and Rotation', async ({ page }) => {
  await openFresh(page)
  const before = await scoreText(page).textContent()
  await page.getByRole('button', { name: /^Edit Echo 1: Feilian Beringal/ }).click()
  const sheet = page.getByRole('dialog', { name: /Echo 1: Feilian Beringal/ })
  await sheet.getByLabel('Roll').first().selectOption({ label: '21.0%' })
  await sheet.getByRole('button', { name: 'Done' }).click()
  await expect(scoreText(page)).not.toHaveText(before ?? '')
  const score = (await scoreText(page).textContent()) ?? ''
  const rounded = `${Math.round(Number(score.replace('%', '')))}%`
  const header = () => page.locator('[data-header-score]').first()
  await expect(header()).toHaveText(rounded)

  await go(page, 'Suggestions', 'Suggest', 'Suggestions')
  await expect(header()).toHaveText(rounded)
  await go(page, 'Optimizer', 'Optimize', 'Optimizer')
  await expect(header()).toHaveText(rounded)
  await go(page, 'Rotation', 'Rotation', 'Rotation')
  await expect(header()).toHaveText(rounded)
  await expect(page.getByTestId('rotation-score')).toHaveText(score)
})
