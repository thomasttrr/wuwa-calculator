import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The damage engine is pure TypeScript with no UI, browser or package dependencies.
// Every import in src/engine must be a relative path that stays inside src/engine.

const ENGINE = resolve(__dirname, '../../src/engine')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : path.endsWith('.ts') ? [path] : []
  })
}

const IMPORT = /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

describe('engine boundary', () => {
  const sources = files(ENGINE)

  it('finds the engine files', () => {
    expect(sources.length).toBeGreaterThan(5)
  })

  for (const file of sources) {
    it(`${relative(ENGINE, file)} imports only engine files`, () => {
      const text = readFileSync(file, 'utf8')
      for (const match of text.matchAll(IMPORT)) {
        const specifier = match[1] ?? match[2] ?? ''
        expect(specifier.startsWith('.'), `"${specifier}" is not a relative import`).toBe(true)
        const target = resolve(dirname(file), specifier)
        expect(relative(ENGINE, target).startsWith('..'), `"${specifier}" leaves src/engine`).toBe(false)
      }
    })

    it(`${relative(ENGINE, file)} uses no browser or Node globals`, () => {
      const text = readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
      for (const name of ['window', 'document', 'localStorage', 'indexedDB', 'process', 'require', 'fetch']) {
        expect(new RegExp(`\\b${name}\\b`).test(text), `uses ${name}`).toBe(false)
      }
    })
  }
})
