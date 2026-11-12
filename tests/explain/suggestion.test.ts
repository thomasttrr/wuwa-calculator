import { describe, expect, it } from 'vitest'
import { createSampleBuild } from '../../src/data/sample-build'
import { simulateRotation } from '../../src/engine/rotation/simulate'
import { applyChange } from '../../src/engine/suggest/change'
import { rankSubstats } from '../../src/engine/suggest/rank'
import type { Build } from '../../src/engine/types/build'
import { explainChange, farmingGoal } from '../../src/explain/suggestion'
import { catalog } from '../engine/fixtures/builds'

const sample = createSampleBuild(catalog)
const sim = (build: Build) => simulateRotation(build, catalog)
const option = (cost: 1 | 3 | 4, stat: string) => catalog.echoStats.mainStats[cost].findIndex((m) => m.stat === stat)

describe('explainChange', () => {
  it('says "no real difference" when damage barely moves', () => {
    expect(explainChange(sim(sample), sim(sample)).text).toBe('No real difference for this rotation.')
  })

  it('names ATK when an ATK% main stat is what grew', () => {
    const hp = applyChange(sample, { kind: 'mainStat', slot: 3, option: option(1, 'hpPct') }, catalog)
    const result = explainChange(sim(hp), sim(sample))
    expect(result.term).toBe('scaling')
    expect(result.text).toMatch(/^Mostly through ATK: 2,\d{3} to 2,500 on average\./)
  })

  it('names average crit when a crit stat is what grew', () => {
    const hp = applyChange(sample, { kind: 'mainStat', slot: 0, option: option(4, 'hpPct') }, catalog)
    const result = explainChange(sim(hp), sim(sample))
    expect(result.term).toBe('crit')
    expect(result.text).toMatch(/^Mostly through average crit: ×\d\.\d\d to ×\d\.\d\d on average\./)
  })

  it('says when a bucket was already crowded, so a big number adds less than it looks', () => {
    // Slot 2 back from HP% to its 30% Aero DMG Bonus: the bucket already holds about +80%.
    const hp = applyChange(sample, { kind: 'mainStat', slot: 1, option: option(3, 'hpPct') }, catalog)
    const result = explainChange(sim(hp), sim(sample))
    expect(result.term).toBe('dmgBonus')
    expect(result.text).toMatch(/^Mostly through DMG Bonus: \+\d+\.\d% to \+\d+\.\d% on average\. It was already high, so that lifts damage by about \d+(\.\d)?%\.$/)
  })

  it('says what is lost when the change makes things worse', () => {
    const hp = applyChange(sample, { kind: 'mainStat', slot: 3, option: option(1, 'hpPct') }, catalog)
    expect(explainChange(sim(sample), sim(hp)).text).toMatch(/^Loses mostly through ATK: 2,500 to 2,\d{3} on average\./)
  })
})

describe('farmingGoal', () => {
  it('names the substat worth the most per roll', () => {
    const values = rankSubstats(sample, catalog)
    const top = catalog.echoStats.substats[values[0]!.row]!.label
    expect(farmingGoal(values, catalog)).toBe(`Your next best roll is ${top} on any Echo.`)
  })

  it('says so when no substat helps', () => {
    expect(farmingGoal([{ row: 0, perRoll: 0, share: 0, count: 0 }], catalog)).toBe('No substat adds damage to this rotation.')
  })
})
