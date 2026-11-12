import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { isPhone, openFresh } from './helpers'

async function openRotation(page: Page) {
  if (isPhone(page)) await page.getByRole('navigation', { name: 'Tools' }).last().getByRole('link', { name: 'Rotation' }).click()
  else await page.getByRole('link', { name: 'Rotation' }).first().click()
  await expect(page.getByRole('heading', { name: 'Rotation', level: 1 })).toBeVisible()
}

const steps = (page: Page) => page.getByRole('list', { name: 'Rotation steps' })
/** Each step's name, in list order. Waits for at least three steps, so a reorder check can never pass on an empty list. */
const order = async (page: Page) => {
  await expect(steps(page).locator('[data-step-name]').nth(2)).toBeVisible()
  return steps(page)
    .locator('[data-step-name]')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-step-name') ?? ''))
}
const centre = async (locator: Locator) => {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Not on screen')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('drag a step to a new place with the mouse, then undo it', async ({ page }) => {
  test.skip(isPhone(page), 'Mouse drag is a desktop check; the phone uses touch below.')
  await openFresh(page)
  await openRotation(page)
  const before = await order(page)
  const from = await centre(steps(page).getByRole('button', { name: /^Move step 1:/ }))
  const to = await centre(steps(page).getByRole('button', { name: /^Move step 3:/ }))
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= 10; i += 1) await page.mouse.move(from.x, from.y + ((to.y - from.y) * i) / 10 + 4)
  await page.mouse.up()
  await expect.poll(() => order(page)).toEqual([before[1], before[2], before[0], ...before.slice(3)])
  await page.getByRole('button', { name: /^Undo: Moved / }).first().click()
  await expect.poll(() => order(page)).toEqual(before)
})

test('move a step with the keyboard alone', async ({ page }) => {
  await openFresh(page)
  await openRotation(page)
  const before = await order(page)
  await steps(page).getByRole('button', { name: /^Move step 1:/ }).focus()
  // A short pause between keys lets the list measure the new place, as a person's typing does.
  for (const key of ['Space', 'ArrowDown', 'ArrowDown', 'Space']) {
    await page.keyboard.press(key)
    await page.waitForTimeout(150)
  }
  await expect.poll(() => order(page)).toEqual([before[1], before[2], before[0], ...before.slice(3)])
})

test('drag a step with touch', async ({ page }) => {
  test.skip(!isPhone(page), 'Touch is the phone check.')
  await openFresh(page)
  await openRotation(page)
  const before = await order(page)
  // Start mid-screen: near the bottom edge the list scrolls itself while you drag, as it should.
  await steps(page).getByRole('button', { name: /^Move step 2:/ }).evaluate((el) => el.scrollIntoView({ block: 'center' }))
  const from = await centre(steps(page).getByRole('button', { name: /^Move step 1:/ }))
  const to = await centre(steps(page).getByRole('button', { name: /^Move step 3:/ }))
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y) }] })
  await touch('touchStart', from.x, from.y)
  for (let i = 1; i <= 12; i += 1) {
    await touch('touchMove', from.x, from.y + ((to.y - 8 - from.y) * i) / 12)
    await page.waitForTimeout(20)
  }
  await touch('touchEnd', to.x, to.y - 8)
  await expect.poll(() => order(page)).toEqual([before[1], before[2], before[0], ...before.slice(3)])
})

test('add a step by typing part of its name, and see the total grow', async ({ page }) => {
  await openFresh(page)
  await openRotation(page)
  const count = (await order(page)).length
  const total = page.getByText('Average', { exact: true }).locator('xpath=following-sibling::dd')
  const before = await total.textContent()
  await page.getByPlaceholder("Add a step: type part of a skill's name").fill('Heavy Attack')
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await order(page)).length).toBe(count + 1)
  await expect(total).not.toHaveText(before ?? '')
  await expect(page.getByRole('button', { name: /^Undo: Added Heavy Attack/ }).first()).toBeVisible()
})

test('the summary lists the steps to follow in game', async ({ page }) => {
  await openFresh(page)
  await openRotation(page)
  await page.getByRole('tab', { name: 'Summary' }).click()
  const summary = page.getByRole('list', { name: 'Rotation summary' })
  await expect(summary.getByRole('listitem').first()).toHaveText(/^1\. /)
})
