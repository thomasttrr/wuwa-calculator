import { describe, expect, it } from 'vitest'
import { computeHit } from '../../../src/engine/formula/hit'
import type { EnemyState, HitInput } from '../../../src/engine/formula/hit'
import { computeStatSheet } from '../../../src/engine/stats/sheet'
import type { BaseStats, Modifier, SourceRef } from '../../../src/engine/types/stats'

// Source: Wuthering Waves Wiki (Fandom, CC-BY-SA), "Damage" page.
//   DMG = (Stat x MV + Flat) x (1 + DMG Bonus) x (1 + Amplify) x (1 + Special) x Crit x DEF mult x RES mult
// Every expected value is worked by hand in the comment above its assertion.

const src = (name: string): SourceRef => ({ kind: 'custom', name })

const BASE: BaseStats = {
  atk: 750,
  hp: 10000,
  def: 1000,
  atkParts: [],
  hpParts: [],
  defParts: [],
  critRate: 0.05,
  critDmg: 1.5,
  energyRegen: 1,
}

const MODIFIERS: Modifier[] = [
  { stat: 'atkPct', value: 0.3, source: src('ATK percent') },
  { stat: 'atkFlat', value: 150, source: src('ATK flat') },
  { stat: 'critRate', value: 0.301, source: src('Crit. Rate') },
  { stat: 'critDmg', value: 0.44, source: src('Crit. DMG') },
  { stat: 'dmgBonus', value: 0.3, scope: { elements: ['aero'] }, source: src('Aero DMG Bonus') },
  { stat: 'dmgBonus', value: 0.12, scope: { damageTypes: ['basic'] }, source: src('Basic Attack DMG Bonus') },
  { stat: 'amplify', value: 0.15, source: src('Amplify') },
]

const ENEMY: EnemyState = {
  level: 100,
  resistance: { physical: 0.1, glacio: 0.1, fusion: 0.1, electro: 0.1, aero: 0.1, spectro: 0.1, havoc: 0.1 },
}

const HIT: HitInput = {
  multiplier: 0.4473,
  flat: 0,
  count: 1,
  scalingStat: 'atk',
  facets: { element: 'aero', damageType: 'basic', actionId: 1 },
}

const hitWith = (modifiers: Modifier[], hit: HitInput = HIT, enemy: EnemyState = ENEMY) =>
  computeHit(hit, computeStatSheet(BASE, modifiers, hit.facets), 90, enemy)

describe('computeHit', () => {
  it('multiplies base, bonus, amplify, defence and resistance for the non-crit hit', () => {
    // ATK      = 750 x 1.30 + 150                 = 1125
    // base     = 1125 x 0.4473                    = 503.2125
    // bonus    = 1 + 0.30 + 0.12                  = 1.42   -> 714.56175
    // amplify  = 1 + 0.15                         = 1.15   -> 821.7460125
    // RES      = 1 - 0.10                         = 0.9    -> 739.57141125
    // DEF      = 1520 / (1520 + 1592)             = 1520 / 3112
    // non-crit = 739.57141125 x 1520 / 3112       = 361.230252...
    const result = hitWith(MODIFIERS)
    expect(result.nonCrit).toBeCloseTo((739.57141125 * 1520) / 3112, 9)
    expect(result.nonCrit).toBeCloseTo(361.230252, 5)
  })

  it('a crit multiplies the non-crit hit by Crit. DMG', () => {
    // Crit. DMG = 1.5 + 0.44 = 1.94; 361.230252 x 1.94 = 700.786689
    const result = hitWith(MODIFIERS)
    expect(result.crit).toBeCloseTo(result.nonCrit * 1.94, 9)
    expect(result.crit).toBeCloseTo(700.786689, 4)
  })

  it('the average weighs crit and non-crit by Crit. Rate', () => {
    // Crit. Rate = 0.05 + 0.301 = 0.351; average factor = 1 + 0.351 x 0.94 = 1.32994
    // 361.230252 x 1.32994 = 480.41456
    const result = hitWith(MODIFIERS)
    expect(result.average).toBeCloseTo(result.nonCrit * 1.32994, 9)
    expect(result.average).toBeCloseTo(480.41456, 4)
  })

  it('a hit that lands several times is counted that many times', () => {
    const once = hitWith(MODIFIERS)
    const twice = hitWith(MODIFIERS, { ...HIT, count: 2 })
    expect(twice.average).toBeCloseTo(once.average * 2, 9)
    expect(twice.perHit.nonCrit).toBeCloseTo(once.nonCrit, 9)
  })

  it('scales on the stat the hit names', () => {
    // DEF = 1000 (no DEF modifiers); base = 1000 x 0.5 = 500; no bonuses
    // 500 x 0.9 x 1520 / 3112 = 219.794344...
    const result = hitWith([], { ...HIT, scalingStat: 'def', multiplier: 0.5 })
    expect(result.nonCrit).toBeCloseTo((500 * 0.9 * 1520) / 3112, 9)
  })

  it('adds the flat part of a skill value before any multiplier', () => {
    // base = 750 x 0.4473 + 96 = 431.475; x 0.9 x 1520 / 3112
    const result = hitWith([], { ...HIT, flat: 96 })
    expect(result.nonCrit).toBeCloseTo((431.475 * 0.9 * 1520) / 3112, 9)
  })

  it('a multiplier bonus scales the hit multiplier itself', () => {
    // multiplier = 0.4473 x 1.2 = 0.53676; base = 750 x 0.53676 = 402.57
    const result = hitWith([{ stat: 'multiplierBonus', value: 0.2, source: src('Multiplier bonus') }])
    expect(result.nonCrit).toBeCloseTo((402.57 * 0.9 * 1520) / 3112, 9)
  })

  it('resistance reduction can push resistance below zero, where it is worth half', () => {
    // RES = 0.10 - 0.20 = -0.10 -> multiplier 1.05; base = 750 x 0.4473 = 335.475
    const result = hitWith([
      { stat: 'resReduction', value: 0.2, scope: { elements: ['aero'] }, source: src('RES shred') },
    ])
    expect(result.nonCrit).toBeCloseTo((335.475 * 1.05 * 1520) / 3112, 9)
    expect(result.formula.resistance.total).toBeCloseTo(-0.1, 12)
  })

  it('DEF ignore reduces the enemy defence that counts', () => {
    // enemy DEF 1592 x (1 - 0.10) = 1432.8; DEF mult = 1520 / 2952.8
    const result = hitWith([{ stat: 'defIgnore', value: 0.1, source: src('DEF ignore') }])
    expect(result.nonCrit).toBeCloseTo((335.475 * 0.9 * 1520) / 2952.8, 9)
  })

  it('uses the resistance of the element the hit deals', () => {
    const enemy: EnemyState = { ...ENEMY, resistance: { ...ENEMY.resistance, aero: 0.4 } }
    const result = hitWith([], HIT, enemy)
    expect(result.nonCrit).toBeCloseTo((335.475 * 0.6 * 1520) / 3112, 9)
  })

  it('exposes every term, and the product of the terms is the non-crit damage', () => {
    const result = hitWith(MODIFIERS)
    const product = result.formula.terms.reduce((total, term) => total * term.value, 1)
    expect(product).toBeCloseTo(result.nonCrit, 9)
    expect(result.formula.terms.map((term) => term.key)).toEqual([
      'base',
      'dmgBonus',
      'amplify',
      'special',
      'defense',
      'resistance',
    ])
  })

  it('carries the unverified mark from any contribution it used', () => {
    expect(hitWith(MODIFIERS).hasUnverified).toBe(false)
    const result = hitWith([
      { stat: 'dmgBonus', value: 0.1, source: { kind: 'weaponPassive', name: 'Passive', verified: false } },
    ])
    expect(result.hasUnverified).toBe(true)
  })
})
