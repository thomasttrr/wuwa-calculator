import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { isPhone, openFresh } from './helpers'

async function openOptimizer(page: Page) {
  if (isPhone(page)) await page.getByRole('navigation', { name: 'Tools' }).last().getByRole('link', { name: 'Optimize' }).click()
  else await page.getByRole('link', { name: 'Optimizer' }).first().click()
  await expect(page.getByRole('heading', { name: 'Optimizer', level: 1 })).toBeVisible()
}

const status = (page: Page) => page.getByRole('region', { name: 'Results' }).getByRole('status')

test('a search of my Echoes finishes, and a result saves as a build', async ({ page }) => {
  await openFresh(page)
  await openOptimizer(page)
  await page.getByRole('button', { name: 'Add my 5 equipped Echoes' }).click()
  await expect(page.getByRole('radio', { name: 'My Echoes (5)' })).toBeChecked()
  await page.getByRole('button', { name: 'Find the best Echoes' }).click()
  await expect(status(page)).toContainText('Done in', { timeout: 30_000 })
  // Only the five equipped Echoes exist, so the best result is the build as it is.
  await expect(page.getByText('Same as your build now').first()).toBeVisible()

  await page.getByRole('button', { name: /^Save as build\b.*result 1$/ }).click()
  await expect(page.getByText(/^Saved as "Sample build: Jiyan, Optimizer 1"\./)).toBeVisible()
  await expect(page.getByRole('button', { name: /^Your builds\. Open now: Sample build: Jiyan\b/ }).first()).toBeVisible()
})

test('a long search shows progress and a time estimate, stays responsive, and cancel stops it within a second', async ({ page }) => {
  await openFresh(page)
  await openOptimizer(page)
  await page.getByText('Generated plan').click()
  await page.getByRole('button', { name: 'Choose sets' }).click()
  await page.getByRole('button', { name: 'Allow all' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Make a plan' }).click()

  await expect(status(page)).toContainText('Searching:')
  await expect(status(page)).toContainText(/seconds? left|minutes left|Working out how long/)

  // The page answers while the search runs.
  const toggle = page.getByRole('switch', { name: 'Count every condition as met' })
  const before = performance.now()
  await toggle.click()
  await expect(toggle).toBeChecked()
  expect(performance.now() - before).toBeLessThan(1000)
  await expect(status(page)).toContainText('Searching:')

  const cancelledAt = Date.now()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(status(page)).toContainText('Stopped after', { timeout: 1000 })
  expect(Date.now() - cancelledAt).toBeLessThan(1000)
})
