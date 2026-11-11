import { describe, expect, it } from 'vitest'
import { critAverage } from '../../../src/engine/formula/crit'

// A hit either crits (damage x Crit. DMG) or does not (damage x 1).
// The long-run average multiplier is 1 + rate x (Crit. DMG - 1), with the rate held between 0 and 1.

describe('critAverage', () => {
  it('50% rate with 200% Crit. DMG averages 1.5', () => {
    expect(critAverage(0.5, 2.0)).toBeCloseTo(1.5, 12)
  })

  it('the base 5% rate and 150% Crit. DMG average 1.025', () => {
    expect(critAverage(0.05, 1.5)).toBeCloseTo(1.025, 12)
  })

  it('Crit. Rate above 100% counts as 100%', () => {
    expect(critAverage(1.3, 2.5)).toBeCloseTo(2.5, 12)
  })

  it('negative Crit. Rate counts as 0%', () => {
    expect(critAverage(-0.2, 2.5)).toBe(1)
  })
})
