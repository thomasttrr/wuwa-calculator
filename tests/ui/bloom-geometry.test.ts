import { describe, expect, it } from 'vitest'
import { BLOOM, bloomWedges } from '../../src/ui/bloom-geometry'

const sub = (tier: number, tiers = 8) => ({ tier, tiers, tone: 'atk' as const, addsDamage: true })

describe('bloomWedges', () => {
  it('draws one wedge per substat and none for an empty slot', () => {
    const wedges = bloomWedges([{ subs: [sub(1), sub(2)] }, null, { subs: [sub(3)] }, null, null])
    expect(wedges).toHaveLength(3)
    expect(wedges.map((w) => w.slot)).toEqual([0, 0, 2])
  })

  it('makes a higher tier reach further out', () => {
    const [low, high] = bloomWedges([{ subs: [sub(1), sub(8)] }, null, null, null, null])
    expect(high?.outer).toBeGreaterThan(low?.outer ?? Infinity)
    expect(high?.outer).toBeCloseTo(BLOOM.inner + BLOOM.minLength + BLOOM.maxExtra)
  })

  it('treats tiers relative to how many tiers the stat has', () => {
    const [flat, pct] = bloomWedges([{ subs: [sub(4, 4), sub(8, 8)] }, null, null, null, null])
    expect(flat?.outer).toBeCloseTo(pct?.outer ?? 0)
  })

  it('keeps each Echo inside its own fifth of the circle', () => {
    const subs = [sub(1), sub(2), sub(3), sub(4), sub(5)]
    const wedges = bloomWedges([{ subs }, { subs }, { subs }, { subs }, { subs }])
    for (const w of wedges) {
      const start = -90 - 36 + w.slot * 72
      expect(w.from).toBeGreaterThanOrEqual(start)
      expect(w.to).toBeLessThanOrEqual(start + 72)
    }
  })

  it('returns closed SVG paths', () => {
    const [w] = bloomWedges([{ subs: [sub(5)] }, null, null, null, null])
    expect(w?.d).toMatch(/^M .* Z$/)
  })
})
