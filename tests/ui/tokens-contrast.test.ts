import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// DESIGN.md promises readable text. This reads the real token file and checks the
// WCAG 2 contrast ratio of every text-on-surface pair the design allows.

const css = readFileSync(new URL('../../src/ui/tokens.css', import.meta.url), 'utf8')

function token(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!match?.[1]) throw new Error(`Token --color-${name} not found in tokens.css`)
  return match[1]
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const v = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const SURFACES = ['page', 'panel', 'raised']
const TEXT = ['ink', 'ink-2', 'ink-3', 'signal', 'gain', 'loss']
const ELEMENTS = ['glacio', 'fusion', 'electro', 'aero', 'spectro', 'havoc', 'physical']

describe('design tokens: text contrast', () => {
  for (const surface of SURFACES) {
    for (const text of TEXT) {
      it(`${text} on ${surface} is at least 4.5:1`, () => {
        expect(contrast(token(text), token(surface))).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  it('text on the accent is at least 4.5:1', () => {
    expect(contrast(token('on-signal'), token('signal'))).toBeGreaterThanOrEqual(4.5)
  })

  for (const element of ELEMENTS) {
    it(`${element} is distinguishable on the page and panel (at least 3:1)`, () => {
      expect(contrast(token(element), token('page'))).toBeGreaterThanOrEqual(3)
      expect(contrast(token(element), token('panel'))).toBeGreaterThanOrEqual(3)
    })
  }

  it('meter ticks are visible on the page (at least 2:1)', () => {
    expect(contrast(token('rule-strong'), token('page'))).toBeGreaterThanOrEqual(2)
  })
})

// Owner's rule (DESIGN.md): no yellows and no purples anywhere.
function hue(hex: string): { h: number; s: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return { h: 0, s: 0 }
  const l = (max + min) / 2
  const s = d / (1 - Math.abs(2 * l - 1))
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = (h * 60 + 360) % 360
  return { h, s }
}

describe('design tokens: no yellows, no purples', () => {
  const colours = [...css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => ({
    name: m[1] ?? '',
    hex: m[2] ?? '',
  }))

  it('finds the colour tokens', () => {
    expect(colours.length).toBeGreaterThan(15)
  })

  for (const { name, hex } of colours) {
    it(`${name} is neither yellow nor purple`, () => {
      const { h, s } = hue(hex)
      // Near-greys carry no visible hue. Yellow band: 35 to 70 degrees. Purple band: 250 to 295 degrees.
      const visible = s > 0.25
      expect(visible && h >= 35 && h <= 70, `${hex} reads as yellow (hue ${h.toFixed(0)})`).toBe(false)
      expect(visible && h >= 250 && h <= 295, `${hex} reads as purple (hue ${h.toFixed(0)})`).toBe(false)
    })
  }
})
