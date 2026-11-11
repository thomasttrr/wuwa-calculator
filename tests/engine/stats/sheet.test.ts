import { describe, expect, it } from 'vitest'
import { computeStatSheet, scopeMatches } from '../../../src/engine/stats/sheet'
import type { BaseStats, HitFacets, Modifier, SourceRef } from '../../../src/engine/types/stats'

const src = (name: string): SourceRef => ({ kind: 'custom', name })

const BASE: BaseStats = {
  atk: 750,
  hp: 10000,
  def: 1000,
  atkParts: [
    { name: 'Resonator', value: 250 },
    { name: 'Weapon', value: 500 },
  ],
  hpParts: [{ name: 'Resonator', value: 10000 }],
  defParts: [{ name: 'Resonator', value: 1000 }],
  critRate: 0.05,
  critDmg: 1.5,
  energyRegen: 1,
}

const AERO_BASIC: HitFacets = { element: 'aero', damageType: 'basic', actionId: 7 }

describe('scopeMatches', () => {
  it('a modifier with no scope applies to every hit', () => {
    expect(scopeMatches(undefined, AERO_BASIC)).toBe(true)
  })

  it('an element scope applies only to that element', () => {
    expect(scopeMatches({ elements: ['aero'] }, AERO_BASIC)).toBe(true)
    expect(scopeMatches({ elements: ['fusion'] }, AERO_BASIC)).toBe(false)
  })

  it('every named facet must match', () => {
    expect(scopeMatches({ elements: ['aero'], damageTypes: ['heavy'] }, AERO_BASIC)).toBe(false)
    expect(scopeMatches({ elements: ['aero'], damageTypes: ['basic', 'heavy'] }, AERO_BASIC)).toBe(true)
  })

  it('an action scope matches by action id', () => {
    expect(scopeMatches({ actionIds: [7] }, AERO_BASIC)).toBe(true)
    expect(scopeMatches({ actionIds: [8] }, AERO_BASIC)).toBe(false)
  })

  it('a tag scope needs the hit to carry one of the tags', () => {
    expect(scopeMatches({ tags: ['frazzle'] }, AERO_BASIC)).toBe(false)
    expect(scopeMatches({ tags: ['frazzle'] }, { ...AERO_BASIC, tags: ['frazzle'] })).toBe(true)
  })

  it('with no hit given, only unscoped modifiers apply', () => {
    expect(scopeMatches(undefined, undefined)).toBe(true)
    expect(scopeMatches({ elements: ['aero'] }, undefined)).toBe(false)
  })
})

describe('computeStatSheet', () => {
  it('ATK is base x (1 + percent) + flat', () => {
    const modifiers: Modifier[] = [
      { stat: 'atkPct', value: 0.12, source: src('Trace nodes') },
      { stat: 'atkPct', value: 0.18, source: src('Echo main stat') },
      { stat: 'atkFlat', value: 150, source: src('Echo fixed stat') },
    ]
    const sheet = computeStatSheet(BASE, modifiers)
    // 750 x (1 + 0.30) + 150 = 1125
    expect(sheet.atk.total).toBeCloseTo(1125, 9)
    expect(sheet.atk.base).toBe(750)
    expect(sheet.atk.percent.total).toBeCloseTo(0.3, 12)
    expect(sheet.atk.flat.total).toBe(150)
  })

  it('every stat total equals the sum of its listed sources', () => {
    const modifiers: Modifier[] = [
      { stat: 'critRate', value: 0.22, source: src('Echo main stat') },
      { stat: 'critRate', value: 0.081, source: src('Echo 1 substat') },
      { stat: 'critDmg', value: 0.44, source: src('Echo main stat') },
      { stat: 'dmgBonus', value: 0.3, scope: { elements: ['aero'] }, source: src('Echo main stat') },
      { stat: 'dmgBonus', value: 0.12, scope: { damageTypes: ['basic'] }, source: src('Weapon') },
      { stat: 'dmgBonus', value: 0.5, scope: { elements: ['fusion'] }, source: src('Wrong element') },
      { stat: 'amplify', value: 0.15, source: src('Teammate outro') },
    ]
    const sheet = computeStatSheet(BASE, modifiers, AERO_BASIC)
    const sum = (parts: readonly Modifier[]) => parts.reduce((total, part) => total + part.value, 0)

    expect(sheet.critRate.total).toBeCloseTo(0.05 + sum(sheet.critRate.parts), 12)
    expect(sheet.critRate.total).toBeCloseTo(0.351, 12)
    expect(sheet.critDmg.total).toBeCloseTo(1.5 + 0.44, 12)
    expect(sheet.dmgBonus.total).toBeCloseTo(sum(sheet.dmgBonus.parts), 12)
    expect(sheet.dmgBonus.total).toBeCloseTo(0.42, 12)
    expect(sheet.amplify.total).toBeCloseTo(0.15, 12)
  })

  it('leaves out modifiers scoped to other hits, and lists only what applied', () => {
    const modifiers: Modifier[] = [
      { stat: 'dmgBonus', value: 0.3, scope: { elements: ['aero'] }, source: src('Aero bonus') },
      { stat: 'dmgBonus', value: 0.5, scope: { elements: ['fusion'] }, source: src('Fusion bonus') },
    ]
    const sheet = computeStatSheet(BASE, modifiers, AERO_BASIC)
    expect(sheet.dmgBonus.parts.map((part) => part.source.name)).toEqual(['Aero bonus'])
  })

  it('with no hit given, scoped bonuses are not counted', () => {
    const modifiers: Modifier[] = [
      { stat: 'dmgBonus', value: 0.3, scope: { elements: ['aero'] }, source: src('Aero bonus') },
      { stat: 'atkPct', value: 0.1, source: src('Trace nodes') },
    ]
    const sheet = computeStatSheet(BASE, modifiers)
    expect(sheet.dmgBonus.total).toBe(0)
    expect(sheet.atk.total).toBeCloseTo(825, 9)
  })

  it('Energy Regen starts from its base of 100%', () => {
    const sheet = computeStatSheet(BASE, [{ stat: 'energyRegen', value: 0.32, source: src('Echo main stat') }])
    expect(sheet.energyRegen.total).toBeCloseTo(1.32, 12)
  })

  it('flags the sheet when any contribution used is unverified', () => {
    const verified = computeStatSheet(BASE, [{ stat: 'atkPct', value: 0.1, source: src('Trace nodes') }])
    expect(verified.hasUnverified).toBe(false)

    const unverified = computeStatSheet(BASE, [
      { stat: 'atkPct', value: 0.1, source: { kind: 'weaponPassive', name: 'Weapon passive', verified: false } },
    ])
    expect(unverified.hasUnverified).toBe(true)
  })
})
