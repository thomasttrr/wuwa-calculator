import { describe, expect, it } from 'vitest'
import { buildLedger } from '../../../src/engine/ledger/ledger'
import { simulateRotation } from '../../../src/engine/rotation/simulate'
import type { Build } from '../../../src/engine/types/build'
import { allTraceNodeIds, bareBuild, catalog, echo, echoIdIn, enemy, maxSkills } from '../fixtures/builds'

// The ledger is the whole-build "how this number was calculated": every figure the app shows
// for a build, with the parts it is made of. These tests hold it to the same numbers the
// engine computes, so the explanation can never drift from the result.

const JINHSI = 1304

function jinhsi(): Build {
  const three = echoIdIn('Celestial Light', 3)
  const bare = bareBuild(JINHSI)
  return {
    ...bare,
    resonator: { ...bare.resonator, skillLevels: maxSkills, traceNodeIds: allTraceNodeIds(JINHSI) },
    weapon: { id: 21010074, level: 90, ascended: false, rank: 1 },
    echoes: [
      echo({
        ...three,
        cost: 3,
        mainStat: { stat: 'dmgBonus', scope: { elements: ['spectro'] }, value: 0.3 },
        substats: [{ stat: 'critDmg', value: 0.21 }],
      }),
      null,
      null,
      null,
      null,
    ],
    effects: { 'weapon:21010074:edge-direction': { on: true, stacks: 2 } },
    enemy: enemy(100),
    rotation: {
      id: 'r',
      name: 'Short',
      items: [
        { kind: 'step', id: 'a', actionId: 1304010, enabled: true },
        { kind: 'step', id: 'b', actionId: 1304016, enabled: true },
        { kind: 'step', id: 'c', actionId: 1304016, enabled: true },
      ],
    },
  }
}

describe('buildLedger', () => {
  const build = jinhsi()
  const ledger = buildLedger(build, catalog)
  const entry = (id: string) => {
    const found = ledger.entries.find((candidate) => candidate.id === id)
    if (!found) throw new Error(`No ledger entry ${id}`)
    return found
  }

  it('ATK shows its base, percent and flat parts, and they combine to the total', () => {
    const atk = entry('atk')
    // base 412.5 + 412.5 = 825; percent 0.12 (tree) + 2 x 0.04 (passive) = 0.20; flat 100 (3-cost fixed)
    expect(atk.value).toBeCloseTo(825 * 1.2 + 100, 9)
    expect(entry('atk.base').value).toBeCloseTo(825, 9)
    expect(entry('atk.percent').value).toBeCloseTo(0.2, 9)
    expect(entry('atk.flat').value).toBeCloseTo(100, 9)
    expect(entry('atk.base').parts.map((part) => part.label)).toEqual(['Jinhsi (level 90)', 'Autumntrace (level 90)'])
  })

  it('every summed entry equals the sum of its parts', () => {
    for (const item of ledger.entries.filter((candidate) => candidate.combine === 'sum')) {
      const total = item.parts.reduce((sum, part) => sum + part.value, 0) + (item.startsFrom ?? 0)
      expect(item.value, item.id).toBeCloseTo(total, 9)
    }
  })

  it('lists the stacking passive with its stack count, and the set bonus', () => {
    const labels = entry('atk.percent').parts.map((part) => part.label)
    expect(labels).toContain('Edge Direction (2 stacks)')
    // Only one Celestial Light Echo, so no set bonus yet.
    expect(entry('dmgBonus.spectro').parts.map((part) => part.label)).toEqual([
      expect.stringContaining('(main stat)'),
    ])
  })

  it('states the enemy terms with their inputs', () => {
    expect(entry('enemy.defense').value).toBeCloseTo(1520 / 3112, 12)
    expect(entry('enemy.defense').note).toContain('level 100')
    expect(entry('enemy.resistance.spectro').value).toBeCloseTo(0.9, 12)
  })

  it('the rotation total equals the simulation, and its parts are the actions', () => {
    const simulated = simulateRotation(build, catalog)
    const total = entry('rotation.total')
    expect(total.value).toBeCloseTo(simulated.total.average, 9)
    expect(total.parts.map((part) => part.label).sort()).toEqual(
      simulated.byAction.map((row) => `${row.label} (${row.count} ${row.count === 1 ? 'time' : 'times'})`).sort(),
    )
  })

  it('carries the patch and data date it was calculated from', () => {
    expect(ledger.gameVersion).toBe(catalog.gameVersion)
    expect(ledger.dataDate).toBe(catalog.dataDate)
  })

  it('marks an entry that uses an unverified input', () => {
    const custom: Build = {
      ...build,
      customModifiers: [{ id: 'x', label: 'My buff', stat: 'atkPct', value: 0.1, on: true }],
    }
    const withCustom = buildLedger(custom, catalog)
    const percent = withCustom.entries.find((candidate) => candidate.id === 'atk.percent')
    expect(percent?.parts.find((part) => part.label === 'My buff')?.kind).toBe('custom')
  })
})
