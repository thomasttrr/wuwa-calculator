import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Opens the Build page on a fresh browser profile and waits for the score. */
export async function openFresh(page: Page) {
  await page.goto('/build')
  await expect(page.getByRole('heading', { name: 'Build score' })).toBeVisible()
  await expect(scoreText(page)).toHaveText(/^\d+\.\d%$/, { timeout: 30_000 })
}

/** The big score number on the Build page. */
export function scoreText(page: Page) {
  return page.getByRole('region', { name: 'Build score' }).locator('[data-score]')
}

export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768
