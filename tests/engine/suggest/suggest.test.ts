import { describe, expect, it } from 'vitest'
import { createSampleBuild } from '../../../src/data/sample-build'
import { simulateRotation } from '../../../src/engine/rotation/simulate'
import { applyChange, changeKey } from '../../../src/engine/suggest/change'
import type { Change } from '../../../src/engine/suggest/change'
import { rankMainStats, rankSets, rankSubstats, rankWeapons, rankWholeBuilds, upgradePath } from '../../../src/engine/suggest/rank'
import type { Build } from '../../../src/engine/types/build'
import { catalog } from '../fixtures/builds'

const sample = createSampleBuild(catalog)
const damageOf = (build: Build) => simulateRotation(build, catalog).total.average
const now = damageOf(sample)

function expectHonest(suggestions: readonly { change: Change; build: Build; damage: number; gain: number }[]) {
  expect(suggestions.length).toBeGreaterThan(0)
  for (const s of suggestions) {
    const direct = damageOf(applyChange(sample, s.change, catalog))
    expect(s.damage).toBeCloseTo(direct, 6)
    expect(damageOf(s.build)).toBeCloseTo(direct, 6)
    expect(s.gain).toBeCloseTo(direct / now - 1, 9)
  }
  for (let i = 1; i < suggestions.length; i += 1) expect(suggestions[i - 1]!.gain).toBeGreaterThanOrEqual(suggestions[i]!.gain)
}

describe('applyChange', () => {
  it('a weapon change swaps only the weapon', () => {
    const other = Object.values(catalog.weapons).find((w) => w.weaponType === 'broadblade' && w.id !== sample.weapon?.id)!
    const next = applyChange(sample, { kind: 'weapon', weaponId: other.id, rank: 1 }, catalog)
    expect(next.weapon).toMatchObject({ id: other.id, rank: 1 })
    expect(next.echoes).toEqual(sample.echoes)
    expect(next.effects).toEqual(sample.effects)
  })

  it('counting every condition as met switches on only the new weapon’s own effects', () => {
    const owned = catalog.effects.filter((e) => e.owner.kind === 'weapon' && e.control.kind !== 'always')
    const weaponId = owned.map((e) => e.owner.id).find((id) => catalog.weapons[id]?.weaponType === 'broadblade' && id !== sample.weapon?.id)
    expect(weaponId).toBeDefined()
    const next = applyChange(sample, { kind: 'weapon', weaponId: weaponId!, rank: 1 }, catalog, { assumeConditionsMet: true })
    for (const effect of owned.filter((e) => e.owner.id === weaponId)) {
      expect(next.effects[effect.id]?.on).toBe(true)
      if (effect.control.kind === 'stacks') expect(next.effects[effect.id]?.stacks).toBe(effect.control.max)
    }
    for (const [key, state] of Object.entries(sample.effects)) {
      if (!owned.some((e) => e.id === key && e.owner.id === weaponId)) expect(next.effects[key]).toEqual(state)
    }
  })

  it('a main stat change touches one slot', () => {
    const next = applyChange(sample, { kind: 'mainStat', slot: 1, option: 0 }, catalog)
    expect(next.echoes[1]?.mainStat.stat).toBe(catalog.echoStats.mainStats[3][0]!.stat)
    expect(next.echoes.filter((_, i) => i !== 1)).toEqual(sample.echoes.filter((_, i) => i !== 1))
  })

  it('a set change moves every Echo into the set and keeps their stats and the main Echo', () => {
    const sonataId = Number(Object.keys(catalog.sonatas).find((id) => Number(id) !== sample.echoes[0]?.sonataId))
    const next = applyChange(sample, { kind: 'set', sonataId }, catalog)
    next.echoes.forEach((echo, slot) => {
      expect(echo?.sonataId).toBe(sonataId)
      expect(echo?.substats).toEqual(sample.echoes[slot]?.substats)
      expect(echo?.echoId).toBe(sample.echoes[slot]?.echoId)
    })
  })

  it('gives each change a stable key', () => {
    expect(changeKey({ kind: 'mainStat', slot: 2, option: 1 })).toBe(changeKey({ kind: 'mainStat', slot: 2, option: 1 }))
    expect(changeKey({ kind: 'weapon', weaponId: 1, rank: 1 })).not.toBe(changeKey({ kind: 'weapon', weaponId: 1, rank: 2 }))
  })
})

describe('rankWeapons', () => {
  const ranked = rankWeapons(sample, catalog)

  it('matches a direct re-simulation of every weapon, best first', () => expectHonest(ranked))

  it('lists only weapons this Resonator can use, never the one already equipped', () => {
    for (const s of ranked) {
      if (s.change.kind !== 'weapon') throw new Error('not a weapon change')
      expect(catalog.weapons[s.change.weaponId]?.weaponType).toBe('broadblade')
      expect(s.change.weaponId).not.toBe(sample.weapon?.id)
    }
  })

  it('keeps to the owned list when one is given', () => {
    const owned = ranked.slice(-2).map((s) => (s.change.kind === 'weapon' ? s.change.weaponId : -1))
    const only = rankWeapons(sample, catalog, { ownedWeaponIds: owned })
    expect(only.map((s) => (s.change.kind === 'weapon' ? s.change.weaponId : -1)).sort()).toEqual([...owned].sort())
  })
})

describe('rankMainStats', () => {
  const ranked = rankMainStats(sample, catalog)

  it('matches a direct re-simulation of every main stat in every slot, best first', () => expectHonest(ranked))

  it('never suggests the main stat a slot already has', () => {
    for (const s of ranked) {
      if (s.change.kind !== 'mainStat') throw new Error('not a main stat change')
      const echo = sample.echoes[s.change.slot]!
      const option = catalog.echoStats.mainStats[echo.cost][s.change.option]!
      expect(option.stat === echo.mainStat.stat && JSON.stringify(option.scope ?? null) === JSON.stringify(echo.mainStat.scope ?? null)).toBe(false)
    }
  })
})

describe('rankSets', () => {
  it('matches a direct re-simulation of five pieces of every other set, best first', () => expectHonest(rankSets(sample, catalog)))
})

describe('rankSubstats', () => {
  const values = rankSubstats(sample, catalog)
  const row = (stat: string) => values.find((v) => catalog.echoStats.substats[v.row]?.stat === stat && !catalog.echoStats.substats[v.row]?.scope)!

  it('values one more average roll of a stat by re-simulating with it added', () => {
    const critDmg = catalog.echoStats.substats[row('critDmg').row]!
    const mean = critDmg.rolls.reduce((sum, roll, i) => sum + roll * (critDmg.chances[i] ?? 0), 0)
    const added: Build = {
      ...sample,
      echoes: sample.echoes.map((echo, slot) => (echo && slot === 0 ? { ...echo, substats: [...echo.substats, { stat: 'critDmg', value: mean }] } : echo)),
    }
    expect(row('critDmg').perRoll).toBeCloseTo(damageOf(added) / now - 1, 9)
  })

  it('measures the share of damage a stat on your Echoes is giving you now, by taking it all away', () => {
    const without: Build = {
      ...sample,
      echoes: sample.echoes.map((echo) => (echo ? { ...echo, substats: echo.substats.filter((s) => s.stat !== 'critRate') } : echo)),
    }
    expect(row('critRate').share).toBeCloseTo(1 - damageOf(without) / now, 9)
  })

  it('gives HP nothing for an ATK Resonator, and ranks by value per roll', () => {
    expect(row('hpFlat').perRoll).toBe(0)
    expect(row('critDmg').perRoll).toBeGreaterThan(0)
    for (let i = 1; i < values.length; i += 1) expect(values[i - 1]!.perRoll).toBeGreaterThanOrEqual(values[i]!.perRoll)
  })
})

describe('rankWholeBuilds', () => {
  const whole = rankWholeBuilds(sample, catalog)

  it('matches a direct re-simulation of each combination, best first', () => expectHonest(whole))

  it('does at least as well as the best single weapon change', () => {
    expect(whole[0]!.damage).toBeGreaterThanOrEqual(rankWeapons(sample, catalog)[0]!.damage - 1e-6)
  })
})

describe('upgradePath', () => {
  // The sample is already the best single-change build, so weaken it: the worst weapon and HP% mains.
  const worstWeapon = rankWeapons(sample, catalog).at(-1)!.change
  const hpOption = (cost: 1 | 3 | 4) => catalog.echoStats.mainStats[cost].findIndex((m) => m.stat === 'hpPct')
  const weak = [worstWeapon, { kind: 'mainStat', slot: 0, option: hpOption(4) }, { kind: 'mainStat', slot: 1, option: hpOption(3) }].reduce(
    (b: Build, c) => applyChange(b, c as Change, catalog),
    sample,
  )
  const path = upgradePath(weak, catalog, {}, 3)

  it('suggests no steps when no single change adds damage', () => {
    expect(upgradePath(sample, catalog, {}, 3)).toEqual([])
  })

  it('takes up to the asked number of steps, each one adding damage, none repeated', () => {
    expect(path).toHaveLength(3)
    let previous = damageOf(weak)
    for (const step of path) {
      expect(step.damage).toBeGreaterThan(previous)
      previous = step.damage
    }
    expect(new Set(path.map((s) => changeKey(s.change))).size).toBe(path.length)
  })

  it('each step is the change applied on top of the steps before it', () => {
    let build = weak
    for (const step of path) {
      build = applyChange(build, step.change, catalog)
      expect(damageOf(build)).toBeCloseTo(step.damage, 6)
    }
  })
})
