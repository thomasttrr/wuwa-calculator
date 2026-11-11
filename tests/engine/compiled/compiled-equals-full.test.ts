import { describe, expect, it } from 'vitest'
import { compileRotation, echoStatVector, ECHO_STAT_KEYS, stripEchoStats } from '../../../src/engine/compiled/compile'
import { simulateRotation } from '../../../src/engine/rotation/simulate'
import type { Build, EchoInstance, RotationItem } from '../../../src/engine/types/build'
import type { EchoCost } from '../../../src/engine/types/catalog'
import { allTraceNodeIds, bareBuild, catalog, echoIdIn, enemy, maxSkills } from '../fixtures/builds'

// The compiled evaluator folds everything except Echo stats into constants so the score,
// suggestions and optimizer can evaluate thousands of loadouts quickly. It must give exactly
// the same answer as the full step-by-step simulation.

/** Small deterministic random generator so failures can be reproduced. */
function rng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

const pick = <T,>(random: () => number, items: readonly T[]): T => {
  const item = items[Math.floor(random() * items.length)]
  if (item === undefined) throw new Error('pick from empty list')
  return item
}

const COSTS: readonly EchoCost[] = [4, 3, 3, 1, 1]
const SETS = ['Sierra Gale', 'Celestial Light', 'Havoc Eclipse', 'Lingering Tunes']

function randomEchoes(random: () => number): EchoInstance[] {
  const set = pick(random, SETS)
  return COSTS.map((cost, slot) => {
    const { echoId, sonataId } = echoIdIn(set, cost)
    const main = pick(random, catalog.echoStats.mainStats[cost])
    const fixed = catalog.echoStats.fixedStats[cost]
    const pool = [...catalog.echoStats.substats]
    const substats = Array.from({ length: 5 }, () => {
      const chosen = pool.splice(Math.floor(random() * pool.length), 1)[0]
      if (!chosen) throw new Error('ran out of substats')
      return { stat: chosen.stat, scope: chosen.scope, value: pick(random, chosen.rolls) }
    })
    return {
      uid: `r${slot}`,
      echoId,
      sonataId,
      cost,
      mainStat: { stat: main.stat, scope: main.scope, value: main.value },
      fixedStat: { stat: fixed.stat, value: fixed.value },
      substats,
    }
  })
}

function rotationFor(resonatorId: number, size: number): RotationItem[] {
  const resonator = catalog.resonators[resonatorId]
  const damaging = (resonator?.actions ?? []).filter((a) => a.kind === 'damage' && a.modelled)
  return damaging.slice(0, size).map((action, index) => ({ kind: 'step', id: `s${index}`, actionId: action.id, enabled: true }))
}

function fullBuild(resonatorId: number, echoes: EchoInstance[], weaponId: number, effects: Build['effects'] = {}): Build {
  const bare = bareBuild(resonatorId)
  return {
    ...bare,
    resonator: { ...bare.resonator, skillLevels: maxSkills, traceNodeIds: allTraceNodeIds(resonatorId) },
    weapon: { id: weaponId, level: 90, ascended: false, rank: 3 },
    echoes,
    effects,
    enemy: enemy(100, 0.4),
    rotation: { id: 'r', name: 'Random', items: rotationFor(resonatorId, 12) },
  }
}

const CASES: { name: string; id: number; weapon: number; effects: Build['effects'] }[] = [
  { name: 'Yangyang', id: 1402, weapon: 21020044, effects: { 'weapon:21020044:unyielding': { on: true } } },
  { name: 'Taoqi', id: 1601, weapon: 21010074, effects: { 'weapon:21010074:edge-direction': { on: true, stacks: 3 } } },
  { name: 'Jinhsi', id: 1304, weapon: 21010074, effects: {} },
]

describe('compiled evaluator', () => {
  it('has one slot per stat an Echo can carry', () => {
    const keys = ECHO_STAT_KEYS.map((key) => key.id)
    expect(new Set(keys).size).toBe(keys.length)
    for (const cost of [1, 3, 4] as const) {
      for (const main of catalog.echoStats.mainStats[cost]) {
        expect(() => echoStatVector([{ uid: 'x', echoId: 0, sonataId: 0, cost, mainStat: main, fixedStat: catalog.echoStats.fixedStats[cost], substats: [] }])).not.toThrow()
      }
    }
  })

  for (const testCase of CASES) {
    it(`matches the full simulation for ${testCase.name} on 40 random legal loadouts`, () => {
      const random = rng(testCase.id)
      for (let trial = 0; trial < 40; trial += 1) {
        const build = fullBuild(testCase.id, randomEchoes(random), testCase.weapon, testCase.effects)
        const full = simulateRotation(build, catalog).total.average
        const compiled = compileRotation(stripEchoStats(build), catalog)
        const fast = compiled.evaluate(echoStatVector(build.echoes))
        expect(full).toBeGreaterThan(0)
        expect(Math.abs(fast - full) / full, `trial ${trial}`).toBeLessThan(1e-9)
      }
    })
  }

  it('can target a single action instead of the whole rotation', () => {
    const random = rng(7)
    const build = fullBuild(1402, randomEchoes(random), 21020044)
    const actionId = 1402001
    const single: Build = { ...build, rotation: { id: 'r', name: 'One', items: [{ kind: 'step', id: 'x', actionId, enabled: true }] } }
    const compiled = compileRotation(stripEchoStats(build), catalog, { kind: 'action', actionId })
    expect(compiled.evaluate(echoStatVector(build.echoes))).toBeCloseTo(simulateRotation(single, catalog).total.average, 6)
  })

  it('with no Echo stats it equals the build with its Echo stats removed', () => {
    const random = rng(11)
    const stripped = stripEchoStats(fullBuild(1304, randomEchoes(random), 21010074))
    const compiled = compileRotation(stripped, catalog)
    expect(compiled.evaluate(new Float64Array(ECHO_STAT_KEYS.length))).toBeCloseTo(simulateRotation(stripped, catalog).total.average, 6)
  })

  it('keeps set bonuses and the main Echo when stripping stats', () => {
    const random = rng(3)
    const build = fullBuild(1402, randomEchoes(random), 21020044)
    const stripped = stripEchoStats(build)
    expect(stripped.echoes.map((e) => e?.sonataId)).toEqual(build.echoes.map((e) => e?.sonataId))
    expect(stripped.echoes.map((e) => e?.echoId)).toEqual(build.echoes.map((e) => e?.echoId))
    expect(stripped.echoes.every((e) => e?.mainStat.value === 0 && e.fixedStat.value === 0 && e.substats.length === 0)).toBe(true)
  })

  it('rejects an Echo stat it has no slot for', () => {
    expect(() =>
      echoStatVector([
        { uid: 'x', echoId: 0, sonataId: 0, cost: 1, mainStat: { stat: 'amplify', value: 0.1 }, fixedStat: { stat: 'hpFlat', value: 1 }, substats: [] },
      ]),
    ).toThrow(/amplify/)
  })

  it('reports how few groups the rotation folds into', () => {
    const random = rng(5)
    const compiled = compileRotation(stripEchoStats(fullBuild(1402, randomEchoes(random), 21020044)), catalog)
    expect(compiled.groupCount).toBeGreaterThan(0)
    expect(compiled.groupCount).toBeLessThanOrEqual(compiled.hitCount)
  })
})
