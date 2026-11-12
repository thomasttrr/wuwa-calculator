// Phase 5: two-tab saving, file round-trips, and the exported card. These are the behaviours the
// phase exists for, so they are checked against real browser storage and a real canvas.
import { readFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { isPhone, openFresh, scoreText } from './helpers'

const conflict = (page: Page) => page.getByRole('alert').filter({ hasText: 'Another tab saved a newer version of your builds.' })

async function openSecondTab(page: Page) {
  const other = await page.context().newPage()
  await other.goto('/build')
  await expect(other.getByRole('heading', { name: 'Build score' })).toBeVisible()
  await expect(scoreText(other)).toHaveText(/^\d+\.\d%$/, { timeout: 30_000 })
  return other
}

test('two tabs: a newer save is never overwritten without a choice', async ({ page }) => {
  await openFresh(page)
  await page.waitForTimeout(600) // the first save

  const other = await openSecondTab(page)
  await other.getByRole('button', { name: 'Lower Level' }).click()
  await other.waitForTimeout(600) // its autosave reaches this tab

  await expect(conflict(page)).toBeVisible()
  await expect(page.getByLabel('Level', { exact: true })).toHaveValue('90')

  // This tab keeps working. Its change is held back, not written over the newer save.
  await page.getByRole('button', { name: 'Lower Level' }).click()
  await page.getByRole('button', { name: 'Lower Level' }).click()
  await page.waitForTimeout(500)
  await expect(page.getByLabel('Level', { exact: true })).toHaveValue('88')
  await expect(conflict(page)).toBeVisible()

  await page.getByRole('button', { name: "Keep this tab's version" }).click()
  await expect(conflict(page)).toHaveCount(0)

  await page.reload()
  await expect(scoreText(page)).toHaveText(/%$/, { timeout: 30_000 })
  await expect(page.getByLabel('Level', { exact: true })).toHaveValue('88')
  await other.close()
})

test("two tabs: using the other tab's version adopts its save without writing it back", async ({ page }) => {
  await openFresh(page)
  await page.waitForTimeout(600)

  const other = await openSecondTab(page)
  await other.getByRole('button', { name: 'Lower Level' }).click()
  await other.waitForTimeout(600)

  await expect(conflict(page)).toBeVisible()
  await page.getByRole('button', { name: "Use the other tab's version" }).click()
  await expect(conflict(page)).toHaveCount(0)
  await expect(page.getByLabel('Level', { exact: true })).toHaveValue('89')

  await page.reload()
  await expect(scoreText(page)).toHaveText(/%$/, { timeout: 30_000 })
  await expect(page.getByLabel('Level', { exact: true })).toHaveValue('89')
  await other.close()
})

test('builds export, then survive an erase and import; a damaged file is refused', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
  await page.waitForTimeout(600)

  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export builds and rotations' }).click()
  const download = await downloadEvent
  const path = await download.path()
  expect(path).toBeTruthy()
  expect(download.suggestedFilename()).toMatch(/builds-and-rotations\.json$/)

  // A file that is not ours says so, and changes nothing.
  await page.locator('input[type=file]').nth(1).setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"something else"}'),
  })
  await expect(page.getByRole('alert').filter({ hasText: 'not a theWuthering builds file' })).toBeVisible()

  await page.getByRole('button', { name: 'Erase everything' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Type erase').fill('erase')
  await page.getByRole('button', { name: 'Erase everything' }).click()
  await expect(page.getByText(/^0 builds,/)).toBeVisible()

  await page.locator('input[type=file]').nth(1).setInputFiles(path!)
  await expect(page.getByText(/^Imported 1 build\.$/)).toBeVisible()
  await expect(page.getByText(/^1 build,/)).toBeVisible()

  await page.getByRole('link', { name: 'Build', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: /Build: Sample build: Jiyan/ })).toBeVisible()
})

test('the card shows the real build numbers and downloads a 1080 by 1350 PNG', async ({ page }) => {
  await openFresh(page)
  const damage = await page.locator('dl div').filter({ hasText: 'Rotation damage' }).locator('dd').first().textContent()
  const headerScore = await page.locator('[data-header-score]').first().textContent()

  if (isPhone(page)) await page.getByRole('navigation', { name: 'Tools' }).last().getByRole('link', { name: 'Card', exact: true }).click()
  else await page.getByRole('link', { name: 'Card', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Card', level: 1 })).toBeVisible()

  await expect(page.locator('[data-card-damage]')).toHaveText(damage ?? '')
  const cardScore = await page.locator('dl div').filter({ hasText: 'Build score' }).locator('dd').first().textContent()
  expect(Math.round(Number((cardScore ?? '').replace('%', '')))).toBe(Number((headerScore ?? '').replace('%', '')))

  const canvas = page.locator('[data-card-canvas]')
  await expect(canvas).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeEnabled()

  const colours = await canvas.evaluate((element) => {
    const context = (element as HTMLCanvasElement).getContext('2d')
    if (!context) return 0
    const { width, height } = element as HTMLCanvasElement
    const { data } = context.getImageData(0, 0, width, height)
    const seen = new Set<string>()
    for (let index = 0; index < data.length; index += 4 * 499) seen.add(`${data[index]},${data[index + 1]},${data[index + 2]}`)
    return seen.size
  })
  expect(colours).toBeGreaterThan(4)

  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PNG' }).click()
  const download = await downloadEvent
  expect(download.suggestedFilename()).toMatch(/\.png$/)
  const file = readFileSync((await download.path())!)
  expect(file.subarray(1, 4).toString('ascii')).toBe('PNG')
  expect(file.readUInt32BE(16)).toBe(1080)
  expect(file.readUInt32BE(20)).toBe(1350)
})

for (const path of ['/', '/card', '/settings', '/guide', '/guide/formula']) {
  test(`no accessibility violations on ${path}`, async ({ page }) => {
    await openFresh(page)
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target.join(' ')})`)).toEqual([])
  })

  test(`nothing runs past the screen edge on ${path}`, async ({ page }) => {
    await openFresh(page)
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const outside = await page.evaluate(() =>
      [...document.querySelectorAll('main *')]
        .filter((element) => {
          const box = element.getBoundingClientRect()
          return box.width > 0 && box.right > window.innerWidth + 1 && getComputedStyle(element).position !== 'fixed'
        })
        .map((element) => element.tagName),
    )
    expect(outside).toEqual([])
  })
}
