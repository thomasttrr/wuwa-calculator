// Captures every Rotation state into verification/phase-4/ for inspection. Not an assertion suite.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { isPhone, openFresh } from './helpers'

const width = (page: Page) => page.viewportSize()?.width
const shot = (page: Page, name: string, fullPage = true) => page.screenshot({ path: `verification/phase-4/state-${name}-${width(page)}.png`, fullPage })

async function open(page: Page) {
  if (isPhone(page)) await page.getByRole('navigation', { name: 'Tools' }).last().getByRole('link', { name: 'Rotation' }).click()
  else await page.getByRole('link', { name: 'Rotation' }).first().click()
  await expect(page.getByRole('heading', { name: 'Rotation', level: 1 })).toBeVisible()
}

test('capture Rotation states', async ({ page }) => {
  await openFresh(page)
  await page.getByRole('button', { name: 'Close the guide' }).click()
  await open(page)

  // Step 2: time it, switch a buff on from here, then repeat it.
  await page.getByRole('button', { name: /^Open step 2:/ }).click()
  const panel = page.getByRole('dialog')
  await panel.getByLabel('Time in seconds').fill('0.6')
  await panel.getByLabel('Time in seconds').press('Enter')
  await panel.getByRole('button', { name: 'Add an effect change' }).click()
  await page.screenshot({ path: `verification/phase-4/state-inspector-${width(page)}.png` })
  await panel.getByRole('button', { name: 'Repeat this step' }).click()
  await panel.getByRole('button', { name: 'Done' }).click()
  await shot(page, 'loop-and-buff')

  await page.getByRole('tab', { name: 'Breakdowns' }).click()
  await page.getByRole('region', { name: 'Results' }).screenshot({ path: `verification/phase-4/state-breakdowns-${width(page)}.png` })
  await page.getByRole('tab', { name: 'Summary' }).click()
  await page.getByRole('region', { name: 'Results' }).screenshot({ path: `verification/phase-4/state-summary-${width(page)}.png` })

  await page.getByRole('tab', { name: 'Saved rotations' }).click()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('button', { name: /^Undo:/ }).first().click()
  await page.getByRole('button', { name: /^Compare/ }).first().click()
  await page.getByRole('region', { name: 'Results' }).screenshot({ path: `verification/phase-4/state-saved-compare-${width(page)}.png` })
})
