// Times the Optimizer on random inventories in a real browser, with the real worker pool.
// Usage: npx tsx scripts/verify/optimizer-timing.ts   (writes verification/phase-3/optimizer-timing.json)
// Browsers live inside node_modules (PLAYWRIGHT_BROWSERS_PATH=0) so nothing outside the project is touched.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'

process.env.PLAYWRIGHT_BROWSERS_PATH = '0'

const SIZES = [50, 100, 300]

async function main() {
  const server = await createServer({ server: { port: 5198, strictPort: true }, logLevel: 'error' })
  await server.listen()
  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch()
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
    await page.goto('http://localhost:5198/build', { waitUntil: 'networkidle' })
    const rows = []
    for (const size of SIZES) {
      // Sent as text: tsx would otherwise wrap the function in helpers the page does not have.
      const row = (await page.evaluate(`(async (n) => {
        const { loadCatalog } = await import('/src/data/catalog.ts')
        const { createSampleBuild } = await import('/src/data/sample-build.ts')
        const { defaultSettings } = await import('/src/engine/optimize/search.ts')
        const { runOptimizer } = await import('/src/workers/optimizer-pool.ts')
        const { randomInventory } = await import('/tests/engine/fixtures/inventory-core.ts')
        const catalog = await loadCatalog()
        const build = createSampleBuild(catalog)
        const problem = { build, candidates: randomInventory(catalog, build, 42, n), settings: { ...defaultSettings(), keep: 10 } }
        let workers = 0
        const end = await runOptimizer(problem, catalog, { onProgress: (p) => (workers = p.workers) }).finished
        return { echoes: n, workers, seconds: Math.round(end.elapsedMs / 100) / 10, best: Math.round(end.results[0]?.damage ?? 0) }
      })(${size})`)) as { echoes: number; workers: number; seconds: number; best: number }
      console.log(JSON.stringify(row))
      rows.push(row)
    }
    const out = resolve('verification', 'phase-3')
    mkdirSync(out, { recursive: true })
    writeFileSync(resolve(out, 'optimizer-timing.json'), `${JSON.stringify({ measuredAt: new Date().toISOString(), cores: await page.evaluate(() => navigator.hardwareConcurrency), rows }, null, 2)}\n`)
  } finally {
    await browser.close()
    await server.close()
  }
}

void main()
