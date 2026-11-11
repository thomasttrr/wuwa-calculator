import { describe, expect, it } from 'vitest'
import { computeAction } from '../../../src/engine/rotation/action'
import { simulateRotation } from '../../../src/engine/rotation/simulate'
import type { Build, RotationItem, RotationStep } from '../../../src/engine/types/build'
import { allTraceNodeIds, bareBuild, catalog, maxSkills } from '../fixtures/builds'

const YANGYANG = 1402
const STAGE_1 = 1402001 // Basic Attack
const STAGE_2 = 1402002 // Basic Attack
const HEAVY = 1402005 // Heavy Attack
const COMMANDO = 21020044
const PASSIVE = 'weapon:21020044:unyielding'

const step = (id: string, actionId: number, extra: Partial<RotationStep> = {}): RotationStep => ({
  kind: 'step',
  id,
  actionId,
  enabled: true,
  ...extra,
})

function buildWith(items: RotationItem[], overrides: Partial<Build> = {}): Build {
  return bareBuild(YANGYANG, {
    resonator: { ...bareBuild(YANGYANG).resonator, skillLevels: maxSkills, traceNodeIds: allTraceNodeIds(YANGYANG) },
    weapon: { id: COMMANDO, level: 90, ascended: false, rank: 1 },
    rotation: { id: 'r', name: 'Test', items },
    ...overrides,
  })
}

const single = (actionId: number, overrides: Partial<Build> = {}) => computeAction(buildWith([], overrides), catalog, actionId)

describe('simulateRotation', () => {
  it('an empty rotation deals nothing', () => {
    const result = simulateRotation(buildWith([]), catalog)
    expect(result.total).toEqual({ nonCrit: 0, crit: 0, average: 0 })
    expect(result.steps).toEqual([])
  })

  it('the total is the sum of its steps', () => {
    const result = simulateRotation(buildWith([step('a', STAGE_1), step('b', STAGE_2), step('c', HEAVY)]), catalog)
    const expected = single(STAGE_1).average + single(STAGE_2).average + single(HEAVY).average
    expect(result.total.average).toBeCloseTo(expected, 9)
    expect(result.steps.map((s) => s.stepId)).toEqual(['a', 'b', 'c'])
  })

  it('a step that is switched off is left out', () => {
    const result = simulateRotation(buildWith([step('a', STAGE_1), step('b', STAGE_2, { enabled: false })]), catalog)
    expect(result.total.average).toBeCloseTo(single(STAGE_1).average, 9)
    expect(result.steps).toHaveLength(1)
  })

  it('a loop repeats its steps', () => {
    const loop: RotationItem = { kind: 'loop', id: 'L', count: 3, enabled: true, steps: [step('a', STAGE_1), step('b', STAGE_2)] }
    const result = simulateRotation(buildWith([loop]), catalog)
    expect(result.total.average).toBeCloseTo(3 * (single(STAGE_1).average + single(STAGE_2).average), 9)
    expect(result.steps).toHaveLength(6)
    expect(result.steps[2]).toMatchObject({ stepId: 'a', loopId: 'L', iteration: 2 })
  })

  it('a loop that is switched off is left out', () => {
    const loop: RotationItem = { kind: 'loop', id: 'L', count: 3, enabled: false, steps: [step('a', STAGE_1)] }
    expect(simulateRotation(buildWith([loop]), catalog).total.average).toBe(0)
  })

  it('an effect switched on "from here on" applies to that step and the ones after', () => {
    const on = { effectChanges: [{ effectId: PASSIVE, on: true, lasts: 'onward' as const }] }
    const result = simulateRotation(buildWith([step('a', STAGE_1), step('b', STAGE_1, on), step('c', STAGE_1)]), catalog)
    const plain = single(STAGE_1).average
    const buffed = single(STAGE_1, { effects: { [PASSIVE]: { on: true } } }).average
    expect(buffed).toBeGreaterThan(plain)
    expect(result.steps.map((s) => s.action.average)).toEqual([plain, buffed, buffed].map((v) => expect.closeTo(v, 9)))
  })

  it('an effect switched on "for this step only" reverts afterwards', () => {
    const once = { effectChanges: [{ effectId: PASSIVE, on: true, lasts: 'thisStep' as const }] }
    const result = simulateRotation(buildWith([step('a', STAGE_1, once), step('b', STAGE_1)]), catalog)
    const plain = single(STAGE_1).average
    const buffed = single(STAGE_1, { effects: { [PASSIVE]: { on: true } } }).average
    expect(result.steps[0]?.action.average).toBeCloseTo(buffed, 9)
    expect(result.steps[1]?.action.average).toBeCloseTo(plain, 9)
  })

  it('breaks the total down by damage type, by element and by action, each adding up to the total', () => {
    const result = simulateRotation(buildWith([step('a', STAGE_1), step('b', STAGE_1), step('c', HEAVY)]), catalog)
    const sum = (rows: readonly { average: number }[]) => rows.reduce((total, row) => total + row.average, 0)
    expect(sum(result.byDamageType)).toBeCloseTo(result.total.average, 9)
    expect(sum(result.byElement)).toBeCloseTo(result.total.average, 9)
    expect(sum(result.byAction)).toBeCloseTo(result.total.average, 9)
    expect(result.byDamageType.map((row) => row.key).sort()).toEqual(['basic', 'heavy'])
    expect(result.byElement.map((row) => row.key)).toEqual(['aero'])
    const stage1 = result.byAction.find((row) => row.key === STAGE_1)
    expect(stage1?.count).toBe(2)
    expect(stage1?.share).toBeCloseTo((2 * single(STAGE_1).average) / result.total.average, 9)
  })

  it('lists actions it could not count, with the reason, instead of silently dropping them', () => {
    const verina = Object.values(catalog.resonators).find((r) => r.name === 'Verina')
    const heal = verina?.actions.find((a) => a.kind === 'heal')
    expect(heal, 'Verina should have a healing action in the data').toBeDefined()
    const build = bareBuild(verina?.id ?? 0, { rotation: { id: 'r', name: 'T', items: [step('h', heal?.id ?? 0)] } })
    const result = simulateRotation(build, catalog)
    expect(result.total.average).toBe(0)
    expect(result.uncounted).toEqual([{ stepId: 'h', name: heal?.name, reason: 'This is healing, not damage.' }])
  })

  it('actions that share a name are told apart by their skill type', () => {
    // Jiyan has a "Skill DMG" under both his Resonance Skill and his Intro Skill.
    const jiyan = bareBuild(1404, {
      rotation: {
        id: 'r',
        name: 'T',
        items: [
          { kind: 'step', id: 'a', actionId: 1404015, enabled: true },
          { kind: 'step', id: 'b', actionId: 1404018, enabled: true },
          { kind: 'step', id: 'c', actionId: 1404001, enabled: true },
        ],
      },
    })
    const names = simulateRotation(jiyan, catalog).steps.map((s) => s.action.name)
    expect(names).toEqual(['Skill DMG (Resonance Skill)', 'Skill DMG (Intro Skill)', 'Stage 1 DMG'])
  })

  it('adds up step times only when every counted step has one', () => {
    const timed = simulateRotation(buildWith([step('a', STAGE_1, { seconds: 0.5 }), step('b', STAGE_2, { seconds: 0.7 })]), catalog)
    expect(timed.seconds).toBeCloseTo(1.2, 9)
    const partly = simulateRotation(buildWith([step('a', STAGE_1, { seconds: 0.5 }), step('b', STAGE_2)]), catalog)
    expect(partly.seconds).toBeUndefined()
  })
})
