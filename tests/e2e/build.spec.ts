import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { openFresh, scoreText } from './helpers'

const enemyLevel = (page: Page) => page.getByRole('textbox', { name: 'Enemy level', exact: true })

test('first run loads the sample build with its guide, and the guide stays dismissed', async ({ page }) => {
  await openFresh(page)
  await expect(page.getByRole('heading', { name: 'Start from this build, change one thing' })).toBeVisible()
  await expect(page.getByText('Jiyan', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Compare this score only with builds that use the same rotation, team and target.')).toBeVisible()
  await expect(page.getByText(/^Patch 3\.8\.0, data from /).first()).toBeVisible()
  await page.getByRole('button', { name: 'Close the guide' }).click()
  await page.waitForTimeout(500) // autosave delay
  await page.reload()
  await expect(scoreText(page)).toHaveText(/%$/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Start from this build, change one thing' })).toHaveCount(0)
})

test('changing one Echo substat changes the score and says what changed; undo restores it', async ({ page }) => {
  await openFresh(page)
  const before = await scoreText(page).textContent()
  await page.getByRole('button', { name: /^Edit Echo 1: Feilian Beringal/ }).click()
  const sheet = page.getByRole('dialog', { name: /Echo 1: Feilian Beringal/ })
  await expect(sheet).toBeVisible()
  // Substat 1 is Crit. DMG; set its roll to the highest value.
  await sheet.getByLabel('Roll').first().selectOption({ label: '21.0%' })
  await sheet.getByRole('button', { name: 'Done' }).click()
  await expect(scoreText(page)).not.toHaveText(before ?? '')
  await expect(page.getByText(/Last change: Set Echo 1 Crit\. DMG to 21\.0%\./)).toBeVisible()
  await expect(page.getByText(/Score \+\d+\.\d points\./)).toBeVisible()
  await page.getByRole('button', { name: /^Undo:/ }).first().click()
  await expect(scoreText(page)).toHaveText(before ?? '')
})

test('the Resonator picker works with the keyboard alone', async ({ page }) => {
  await openFresh(page)
  await page.getByRole('button', { name: 'Change Resonator' }).click()
  const search = page.getByRole('combobox', { name: 'Search by name' })
  await expect(search).toBeFocused()
  await search.fill('yangy')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Resonator' }).getByText(/^Yangyang/).first()).toBeVisible()
})

test('edits survive a reload', async ({ page }) => {
  await openFresh(page)
  await page.getByRole('button', { name: 'Raise Enemy level' }).click()
  await expect(enemyLevel(page)).toHaveValue('101')
  await page.waitForTimeout(500)
  await page.reload()
  await expect(scoreText(page)).toHaveText(/%$/, { timeout: 30_000 })
  await expect(enemyLevel(page)).toHaveValue('101')
})

test('a change made just before leaving the page is kept', async ({ page }) => {
  await openFresh(page)
  await page.getByRole('button', { name: 'Raise Enemy level' }).click()
  // Leave at once: no time for the 300 ms autosave delay. The pagehide flush must save it.
  await page.goto('/saved')
  await page.goto('/build')
  await expect(scoreText(page)).toHaveText(/%$/, { timeout: 30_000 })
  await expect(enemyLevel(page)).toHaveValue('101')
})

test('Show everything reveals expert controls without removing anything', async ({ page }) => {
  await openFresh(page)
  await expect(page.getByLabel('Resonance Skill')).toHaveCount(0)
  await page.getByRole('switch', { name: 'Show everything' }).click()
  await expect(page.getByLabel('Resonance Skill', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your own buffs' })).toBeVisible()
})

test('How this was calculated opens the whole-build sheet', async ({ page }) => {
  await openFresh(page)
  await page.getByRole('button', { name: 'How this was calculated' }).click()
  const sheet = page.getByRole('dialog', { name: 'How this was calculated' })
  await expect(sheet.getByText('Rotation damage (average)')).toBeVisible()
  await expect(sheet.getByText('Enemy defence', { exact: true })).toBeVisible()
})

test('compare two builds after duplicating one', async ({ page }) => {
  await openFresh(page)
  await page.getByRole('button', { name: /^Your builds\. Open now:/ }).click()
  await page.getByRole('button', { name: 'Duplicate Sample build: Jiyan' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Compare' }).click()
  await expect(page.getByText('Same setup. These scores and damage numbers can be compared directly.')).toBeVisible()
})

for (const path of ['/build', '/suggestions', '/saved', '/compare']) {
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
