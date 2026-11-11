import { describe, expect, it } from 'vitest'
import { defMultiplier, enemyDefense } from '../../../src/engine/formula/defense'

// Source: Wuthering Waves Wiki (Fandom, CC-BY-SA), "Damage" page, section "DEF Multiplier".
//   Enemy DEF = 8 x enemy level + 792
//   DEF mult  = (800 + 8 x attacker level) / (800 + 8 x attacker level + enemy DEF x (1 - DEF ignore))
//   "DEF Reduction is a stat change on the enemy and will be applied before the DEF% formula"
// Expected values below are worked by hand from those lines.

describe('enemyDefense', () => {
  it('is 8 x level + 792: level 90 gives 1512', () => {
    expect(enemyDefense(90)).toBe(1512)
  })

  it('level 100 gives 1592', () => {
    expect(enemyDefense(100)).toBe(1592)
  })
})

describe('defMultiplier', () => {
  it('level 90 attacker against a level 90 enemy is 1520 / 3032', () => {
    // 800 + 8 x 90 = 1520; enemy DEF = 1512; 1520 / (1520 + 1512)
    expect(defMultiplier(90, 90, 0, 0)).toBeCloseTo(1520 / 3032, 12)
    expect(defMultiplier(90, 90, 0, 0)).toBeCloseTo(0.501319261, 9)
  })

  it('level 90 attacker against a level 100 enemy is 1520 / 3112', () => {
    expect(defMultiplier(90, 100, 0, 0)).toBeCloseTo(1520 / 3112, 12)
  })

  it('10% DEF ignore removes a tenth of the enemy DEF', () => {
    // 1592 x 0.9 = 1432.8; 1520 / (1520 + 1432.8) = 1520 / 2952.8
    expect(defMultiplier(90, 100, 0.1, 0)).toBeCloseTo(1520 / 2952.8, 12)
  })

  it('DEF reduction lowers the enemy DEF before DEF ignore applies', () => {
    // 1592 x (1 - 0.2) = 1273.6; x (1 - 0.1) = 1146.24; 1520 / (1520 + 1146.24)
    expect(defMultiplier(90, 100, 0.1, 0.2)).toBeCloseTo(1520 / 2666.24, 12)
  })

  it('full DEF ignore means defence removes nothing', () => {
    expect(defMultiplier(90, 100, 1, 0)).toBe(1)
  })

  it('DEF ignore above 100% is treated as 100%', () => {
    expect(defMultiplier(90, 100, 1.5, 0)).toBe(1)
  })
})
