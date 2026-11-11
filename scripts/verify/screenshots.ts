// Renders pages at desktop and phone widths into verification/<phase>/ for inspection.
// Usage: npm run verify:screens -- <phase> [name=route ...]   (route has no leading slash)
//   npm run verify:screens -- phase-0 tokens=
// Browsers live inside node_modules (PLAYWRIGHT_BROWSERS_PATH=0) so nothing outside
// the project folder is touched.
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'

process.env.PLAYWRIGHT_BROWSERS_PATH = '0'

const VIEWPORTS = [
  { label: '1440', width: 1440, height: 900 },
  { label: '390', width: 390, height: 844 },
] as const

async function main() {
  const [phase = 'phase-0', ...routeArgs] = process.argv.slice(2)
  // Routes are written without the leading slash ("home=", "build=build") because
  // Git Bash on Windows rewrites arguments that start with "/" into Windows paths.
  const routes = (routeArgs.length > 0 ? routeArgs : ['home=']).map((arg) => {
    const [name = 'page', route = ''] = arg.split('=')
    return { path: `/${route.replace(/^\/+/, '')}`, name }
  })

  const outDir = resolve('verification', phase)
  mkdirSync(outDir, { recursive: true })

  const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' })
  await server.listen()

  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch()
  const problems: string[] = []

  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        colorScheme: 'dark',
      })
      const page = await context.newPage()
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`[${viewport.label}] console error: ${message.text()}`)
      })
      page.on('pageerror', (error) => problems.push(`[${viewport.label}] page error: ${error.message}`))

      for (const route of routes) {
        await page.goto(`http://localhost:5199${route.path}`, { waitUntil: 'networkidle' })
        await page.evaluate(() => document.fonts.ready)
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        if (overflow > 0) problems.push(`[${viewport.label}] ${route.path} scrolls sideways by ${overflow}px`)
        const file = resolve(outDir, `${route.name}-${viewport.label}.png`)
        await page.screenshot({ path: file, fullPage: true })
        console.log(`saved ${file}`)
      }
      await context.close()
    }
  } finally {
    await browser.close()
    await server.close()
  }

  if (problems.length > 0) {
    console.error(problems.join('\n'))
    process.exitCode = 1
  } else {
    console.log('No console errors and no sideways scrolling.')
  }
}

await main()
