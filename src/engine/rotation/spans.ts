// Which effects the rotation switches are on at each counted step: the buff bars of the timeline.
import { activeStacks } from '../stats/collect'
import type { Build } from '../types/build'
import type { Catalog } from '../types/catalog'
import type { RotationResult } from './simulate'

export interface EffectSpan {
  /** The effect-state key (an effect id, or a teammate's prefixed one). */
  key: string
  name: string
  /** Parallel to result.steps. */
  on: boolean[]
}

const TEAMMATE = /^teammate\d+:/

export function effectSpans(result: RotationResult, build: Build, catalog: Catalog): EffectSpan[] {
  const keys = new Set<string>()
  for (const item of build.rotation.items) {
    const steps = item.kind === 'loop' ? item.steps : [item]
    for (const step of steps) for (const change of step.effectChanges ?? []) keys.add(change.effectId)
  }
  return [...keys].flatMap((key) => {
    const effect = catalog.effects.find((e) => e.id === key.replace(TEAMMATE, ''))
    if (!effect) return []
    return [{ key, name: effect.name, on: result.steps.map((step) => activeStacks(effect, step.states, key) > 0) }]
  })
}
