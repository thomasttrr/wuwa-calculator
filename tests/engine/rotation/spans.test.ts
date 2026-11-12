import { describe, expect, it } from 'vitest'
import { createSampleBuild } from '../../../src/data/sample-build'
import { effectSpans } from '../../../src/engine/rotation/spans'
import { simulateRotation } from '../../../src/engine/rotation/simulate'
import type { Build, RotationItem, RotationStep } from '../../../src/engine/types/build'
import { allTraceNodeIds, bareBuild, catalog, maxSkills } from '../fixtures/builds'

const YANGYANG = 1402
const STAGE_1 = 1402001
const COMMANDO = 21020044
const PASSIVE = 'weapon:21020044:unyielding'

const step = (id: string, extra: Partial<RotationStep> = {}): RotationStep => ({ kind: 'step', id, actionId: STAGE_1, enabled: true, ...extra })
const buildWith = (items: RotationItem[]): Build =>
  bareBuild(YANGYANG, {
    resonator: { ...bareBuild(YANGYANG).resonator, skillLevels: maxSkills, traceNodeIds: allTraceNodeIds(YANGYANG) },
    weapon: { id: COMMANDO, level: 90, ascended: false, rank: 1 },
    rotation: { id: 'r', name: 'Test', items },
  })

describe('effectSpans: buffs the rotation switches, per counted step', () => {
  it('lists each effect the rotation changes, on from the step that switches it on', () => {
    const build = buildWith([step('a'), step('b', { effectChanges: [{ effectId: PASSIVE, on: true, lasts: 'onward' }] }), step('c')])
    const spans = effectSpans(simulateRotation(build, catalog), build, catalog)
    expect(spans).toHaveLength(1)
    expect(spans[0]).toMatchObject({ key: PASSIVE, on: [false, true, true] })
    expect(spans[0]?.name).toMatch(/\S/)
  })

  it('shows a "this step only" change on that step alone, and follows loop passes', () => {
    const once = step('b', { effectChanges: [{ effectId: PASSIVE, on: true, lasts: 'thisStep' }] })
    const build = buildWith([{ kind: 'loop', id: 'L', count: 2, enabled: true, steps: [step('a'), once] }])
    const spans = effectSpans(simulateRotation(build, catalog), build, catalog)
    expect(spans[0]?.on).toEqual([false, true, false, true])
  })

  it('switching a stacking effect "on" without a count keeps the stacks it already had', () => {
    // Found on the Rotation page: Verdant Summit at 2 of 2 stacks, switched "on" at a step, fell to its default of 0.
    const sample = createSampleBuild(catalog)
    const stacking = 'weapon:21010016:2'
    expect(sample.effects[stacking]).toEqual({ on: true, stacks: 2 })
    const first = sample.rotation.items[0]
    if (!first || first.kind !== 'step') throw new Error('expected a step')
    const changed = { ...sample, rotation: { ...sample.rotation, items: [{ ...first, effectChanges: [{ effectId: stacking, on: true, lasts: 'onward' as const }] }, ...sample.rotation.items.slice(1)] } }
    const result = simulateRotation(changed, catalog)
    expect(result.total.average).toBeCloseTo(simulateRotation(sample, catalog).total.average, 6)
    expect(effectSpans(result, changed, catalog)[0]?.on.every(Boolean)).toBe(true)
  })

  it('is empty when the rotation changes no effects', () => {
    const build = buildWith([step('a')])
    expect(effectSpans(simulateRotation(build, catalog), build, catalog)).toEqual([])
  })
})
