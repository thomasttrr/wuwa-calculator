import type { Build, EffectStates, RotationStep } from '../types/build'
import type { Catalog } from '../types/catalog'
import type { DamageType, Element } from '../types/stats'
import { computeActionIn, prepareBuild } from './action'
import type { ActionResult, BuildContext } from './action'

export interface DamageTotals {
  nonCrit: number
  crit: number
  average: number
}

/** One counted step, in the order it happens (loops are unrolled). */
export interface StepResult {
  stepId: string
  /** Set when the step ran inside a loop. */
  loopId?: string
  /** 1-based pass through the loop. */
  iteration?: number
  note?: string
  seconds?: number
  action: ActionResult
}

export interface BreakdownRow<K> {
  key: K
  label: string
  /** How many steps fed this row. */
  count: number
  nonCrit: number
  crit: number
  average: number
  /** Share of the rotation's average damage, 0 to 1. */
  share: number
}

export interface UncountedStep {
  stepId: string
  name: string
  reason: string
}

export interface RotationResult {
  total: DamageTotals
  steps: readonly StepResult[]
  byDamageType: readonly BreakdownRow<DamageType>[]
  byElement: readonly BreakdownRow<Element>[]
  byAction: readonly BreakdownRow<number>[]
  /** Steps that ran but deal no countable damage (healing, unmodelled actions), with the reason. */
  uncounted: readonly UncountedStep[]
  /** Total seconds, only when every counted step has a time. */
  seconds?: number
  hasUnverified: boolean
}

const DAMAGE_TYPE_LABEL: Record<DamageType, string> = {
  basic: 'Basic Attack',
  heavy: 'Heavy Attack',
  skill: 'Resonance Skill',
  liberation: 'Resonance Liberation',
  intro: 'Intro Skill',
  outro: 'Outro Skill',
  echo: 'Echo Skill',
  tuneRupture: 'Tune Rupture',
  other: 'Other',
}

const ELEMENT_LABEL: Record<Element, string> = {
  physical: 'Physical',
  glacio: 'Glacio',
  fusion: 'Fusion',
  electro: 'Electro',
  aero: 'Aero',
  spectro: 'Spectro',
  havoc: 'Havoc',
}

function applyChanges(states: EffectStates, step: RotationStep, lasts: 'onward' | 'thisStep'): EffectStates {
  const changes = (step.effectChanges ?? []).filter((change) => change.lasts === lasts)
  if (changes.length === 0) return states
  const next: Record<string, { on: boolean; stacks?: number }> = { ...states }
  for (const change of changes) {
    next[change.effectId] = change.stacks === undefined ? { on: change.on } : { on: change.on, stacks: change.stacks }
  }
  return next
}

/** The build's results for one set of effect switches, cached so repeated states are worked out once. */
function contextCache(build: Build, catalog: Catalog) {
  const cache = new Map<string, BuildContext>()
  return (states: EffectStates): BuildContext => {
    const key = JSON.stringify(Object.entries(states).sort(([a], [b]) => a.localeCompare(b)))
    let context = cache.get(key)
    if (!context) {
      context = prepareBuild(build, catalog, states)
      cache.set(key, context)
    }
    return context
  }
}

function breakdown<K>(
  steps: readonly StepResult[],
  total: number,
  facetsOf: (step: StepResult) => readonly { key: K; nonCrit: number; crit: number; average: number }[],
  labelOf: (key: K, step: StepResult) => string,
): BreakdownRow<K>[] {
  const rows = new Map<K, BreakdownRow<K>>()
  for (const step of steps) {
    const seen = new Set<K>()
    for (const facet of facetsOf(step)) {
      const row = rows.get(facet.key) ?? { key: facet.key, label: labelOf(facet.key, step), count: 0, nonCrit: 0, crit: 0, average: 0, share: 0 }
      row.nonCrit += facet.nonCrit
      row.crit += facet.crit
      row.average += facet.average
      if (!seen.has(facet.key)) row.count += 1
      seen.add(facet.key)
      rows.set(facet.key, row)
    }
  }
  return [...rows.values()]
    .map((row) => ({ ...row, share: total > 0 ? row.average / total : 0 }))
    .sort((a, b) => b.average - a.average)
}

/**
 * Runs the build's rotation step by step. Effect changes attached to a step take hold at that
 * step: "onward" ones stay until changed again, "thisStep" ones apply to that step only.
 * Loops repeat their steps `count` times; effect changes inside a loop carry across passes.
 */
export function simulateRotation(build: Build, catalog: Catalog): RotationResult {
  const contextFor = contextCache(build, catalog)
  const steps: StepResult[] = []
  const uncounted: UncountedStep[] = []
  let states: EffectStates = build.effects

  const run = (step: RotationStep, loop?: { id: string; iteration: number }) => {
    if (!step.enabled) return
    states = applyChanges(states, step, 'onward')
    const stepStates = applyChanges(states, step, 'thisStep')
    const action = computeActionIn(contextFor(stepStates), step.actionId)
    if (!action.counted) {
      uncounted.push({ stepId: step.id, name: action.name, reason: action.reason ?? 'Not counted.' })
      return
    }
    steps.push({
      stepId: step.id,
      ...(loop ? { loopId: loop.id, iteration: loop.iteration } : {}),
      ...(step.note ? { note: step.note } : {}),
      ...(step.seconds !== undefined ? { seconds: step.seconds } : {}),
      action,
    })
  }

  for (const item of build.rotation.items) {
    if (item.kind === 'step') {
      run(item)
      continue
    }
    if (!item.enabled) continue
    for (let iteration = 1; iteration <= item.count; iteration += 1) {
      for (const step of item.steps) run(step, { id: item.id, iteration })
    }
  }

  const sum = (pick: (step: StepResult) => number) => steps.reduce((total, step) => total + pick(step), 0)
  const total: DamageTotals = {
    nonCrit: sum((step) => step.action.nonCrit),
    crit: sum((step) => step.action.crit),
    average: sum((step) => step.action.average),
  }

  const partFacets = <K>(keyOf: (part: ActionResult['parts'][number]) => K) => (step: StepResult) =>
    step.action.parts.map((part) => ({ key: keyOf(part), nonCrit: part.nonCrit, crit: part.crit, average: part.average }))

  const allTimed = steps.length > 0 && steps.every((step) => step.seconds !== undefined)

  return {
    total,
    steps,
    byDamageType: breakdown(steps, total.average, partFacets((part) => part.facets.damageType), (key) => DAMAGE_TYPE_LABEL[key]),
    byElement: breakdown(steps, total.average, partFacets((part) => part.facets.element), (key) => ELEMENT_LABEL[key]),
    byAction: breakdown(
      steps,
      total.average,
      (step) => [{ key: step.action.actionId, nonCrit: step.action.nonCrit, crit: step.action.crit, average: step.action.average }],
      (_key, step) => step.action.name,
    ),
    uncounted,
    ...(allTimed ? { seconds: sum((step) => step.seconds ?? 0) } : {}),
    hasUnverified: steps.some((step) => step.action.hasUnverified),
  }
}
