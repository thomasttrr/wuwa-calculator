import { describe, expect, it } from 'vitest'
import { resMultiplier } from '../../../src/engine/formula/resistance'

// Source: Wuthering Waves Wiki (Fandom, CC-BY-SA), "Damage" page, section "RES Multiplier".
//   RES < 0          : 1 - RES / 2
//   0 <= RES < 0.8   : 1 - RES
//   RES >= 0.8       : 1 / (1 + 5 x RES)

describe('resMultiplier', () => {
  it('10% resistance leaves 90% of the damage', () => {
    expect(resMultiplier(0.1)).toBeCloseTo(0.9, 12)
  })

  it('40% resistance leaves 60%', () => {
    expect(resMultiplier(0.4)).toBeCloseTo(0.6, 12)
  })

  it('negative resistance is worth half as much: -10% gives 1.05', () => {
    expect(resMultiplier(-0.1)).toBeCloseTo(1.05, 12)
  })

  it('at exactly 80% the high-resistance branch gives 1 / (1 + 4) = 0.2', () => {
    expect(resMultiplier(0.8)).toBeCloseTo(0.2, 12)
  })

  it('90% resistance gives 1 / 5.5', () => {
    expect(resMultiplier(0.9)).toBeCloseTo(1 / 5.5, 12)
  })

  it('is continuous at 0', () => {
    expect(resMultiplier(0)).toBe(1)
    expect(resMultiplier(-1e-9)).toBeCloseTo(resMultiplier(1e-9), 8)
  })

  it('is continuous at 80%', () => {
    expect(resMultiplier(0.8 - 1e-9)).toBeCloseTo(resMultiplier(0.8), 8)
  })
})
