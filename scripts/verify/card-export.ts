// Saves the exported card exactly as the browser downloads it, for inspection at its real size.
// Usage: npx tsx scripts/verify/card-export.ts   (writes verification/phase-5/card-export.png)
// Browsers live inside node_modules (PLAYWRIGHT_BROWSERS_PATH=0) so nothing outside the project is touched.
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'

process.env.PLAYWRIGHT_BROWSERS_PATH = '0'

async function main() {
  const server = await createServer({ server: { port: 5197, strictPort: true }, logLevel: 'error' })
  await server.listen()
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, colorScheme: 'dark' })
    const page = await context.newPage()
    await page.goto('http://localhost:5197/card', { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll('button')].find((element) => element.textContent?.includes('Download PNG'))
      return button instanceof HTMLButtonElement && !button.disabled
    })

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PNG' }).click()])
    const out = resolve('verification', 'phase-5', 'card-export.png')
    mkdirSync(resolve('verification', 'phase-5'), { recursive: true })
    await download.saveAs(out)
    console.log(`saved ${out}`)
  } finally {
    await browser.close()
    await server.close()
  }
}

void main()
