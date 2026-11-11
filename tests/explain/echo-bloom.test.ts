import { describe, expect, it } from 'vitest'
import { bloomEchoes, rollTier, substatTone } from '../../src/explain/echo-bloom'
import type { Build } from '../../src/engine/types/build'
import { createSampleBuild } from '../../src/data/sample-build'
import { catalog } from '../engine/fixtures/builds'

const sample = createSampleBuild(catalog)

describe('rollTier', () => {
  const critDmg = catalog.echoStats.substats.find((row) => row.stat === 'critDmg')
  if (!critDmg) throw new Error('Crit. DMG row missing')

  it('counts tiers from 1 at the lowest roll to the number of rolls at the highest', () => {
    expect(rollTier(critDmg, critDmg.rolls[0] ?? 0)).toEqual({ tier: 1, tiers: critDmg.rolls.length })
    expect(rollTier(critDmg, critDmg.rolls.at(-1) ?? 0)).toEqual({ tier: critDmg.rolls.length, tiers: critDmg.rolls.length })
  })

  it('matches a value that differs only by rounding to its tier', () => {
    expect(rollTier(critDmg, 0.16200000001).tier).toBe(critDmg.rolls.indexOf(0.162) + 1)
  })
})

describe('substatTone', () => {
  it('gives each stat group its own tone', () => {
    expect(substatTone('critRate')).toBe('critRate')
    expect(substatTone('critDmg')).toBe('critDmg')
    expect(substatTone('atkPct')).toBe('atk')
    expect(substatTone('atkFlat')).toBe('atk')
    expect(substatTone('energyRegen')).toBe('energyRegen')
    expect(substatTone('dmgBonus')).toBe('bonus')
    expect(substatTone('hpFlat')).toBe('hp')
    expect(substatTone('defPct')).toBe('def')
  })
})

describe('bloomEchoes', () => {
  const bloom = bloomEchoes(sample, catalog)

  it('has one entry per slot, null for an empty slot', () => {
    expect(bloom).toHaveLength(5)
    const empty: Build = { ...sample, echoes: [sample.echoes[0] ?? null, null, null, null, null] }
    expect(bloomEchoes(empty, catalog).slice(1)).toEqual([null, null, null, null])
  })

  it('lists every substat of each Echo with its tier', () => {
    sample.echoes.forEach((echo, slot) => {
      expect(bloom[slot]?.subs).toHaveLength(echo?.substats.length ?? 0)
      for (const sub of bloom[slot]?.subs ?? []) {
        expect(sub.tier).toBeGreaterThanOrEqual(1)
        expect(sub.tier).toBeLessThanOrEqual(sub.tiers)
      }
    })
  })

  it('marks a substat that adds no damage to this rotation, measured by taking it away', () => {
    // The sample build scales on ATK, so HP and DEF substats change nothing.
    const subs = bloom.flatMap((echo) => echo?.subs ?? [])
    const hp = subs.filter((sub) => sub.tone === 'hp' || sub.tone === 'def')
    expect(hp.length).toBeGreaterThan(0)
    for (const sub of hp) expect(sub.addsDamage).toBe(false)
    for (const sub of subs.filter((s) => s.tone === 'critRate' || s.tone === 'critDmg' || s.tone === 'atk')) expect(sub.addsDamage).toBe(true)
  })
})
