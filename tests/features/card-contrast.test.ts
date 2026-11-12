import { describe, expect, it } from 'vitest'
import { CARD_PALETTES } from '../../src/features/card/palettes'

// The card is the one place with its own palettes. It still promises readable text and the
// no-yellow, no-purple rule, so every palette is measured rather than trusted.

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

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

const SURFACES = ['page', 'panel', 'raised'] as const
const liveTones = ['critRate', 'critDmg', 'atk', 'energyRegen', 'bonus', 'hp', 'def'] as const

describe.each(CARD_PALETTES.map((palette) => [palette.id, palette] as const))('card palette: %s', (_id, palette) => {
  for (const surface of SURFACES) {
    for (const text of ['ink', 'ink2', 'ink3', 'signal'] as const) {
      it(`${text} on ${surface} is at least 4.5:1`, () => {
        expect(contrast(palette[text], palette[surface])).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  it('text on the accent is at least 4.5:1', () => {
    expect(contrast(palette.onSignal, palette.signal)).toBeGreaterThanOrEqual(4.5)
  })

  for (const tone of liveTones) {
    it(`tone ${tone} is distinguishable on every surface (at least 3:1)`, () => {
      for (const surface of SURFACES) expect(contrast(palette.tones[tone], palette[surface])).toBeGreaterThanOrEqual(3)
    })
  }

  it('the "adds no damage" colour stays clearly darker than every live tone', () => {
    for (const tone of liveTones) expect(contrast(palette.tones[tone], palette.unused)).toBeGreaterThanOrEqual(2)
  })

  it('uses no yellow and no purple anywhere', () => {
    const colours = [
      palette.page,
      palette.panel,
      palette.raised,
      palette.rule,
      palette.ink,
      palette.ink2,
      palette.ink3,
      palette.signal,
      palette.onSignal,
      palette.unused,
      ...Object.values(palette.tones),
    ]
    for (const hex of colours) {
      const { h, s } = hue(hex)
      const visible = s > 0.25
      expect(visible && h >= 35 && h <= 70, `${hex} reads as yellow (hue ${h.toFixed(0)})`).toBe(false)
      expect(visible && h >= 250 && h <= 295, `${hex} reads as purple (hue ${h.toFixed(0)})`).toBe(false)
    }
  })
})
