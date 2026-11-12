import { computeHit } from '../formula/hit'
import type { EnemyState, HitResult } from '../formula/hit'
import { resolveBaseStats } from '../stats/base'
import { collectModifiers } from '../stats/collect'
import { computeStatSheet } from '../stats/sheet'
import type { Build, EffectStates } from '../types/build'
import type { ActionDef, Catalog, LevelledSkillType, ResonatorDef, SkillType } from '../types/catalog'
import { LEVELLED_SKILL_TYPES } from '../types/catalog'
import type { BaseStats, Modifier } from '../types/stats'

/** The damage of one action: every part of its skill value, with the full working for each. */
export interface ActionResult {
  actionId: number
  name: string
  skillType: SkillType
  kind: 'damage' | 'heal'
  /** False when the action is left out of totals. `reason` then says why in plain words. */
  counted: boolean
  reason?: string
  parts: readonly HitResult[]
  nonCrit: number
  crit: number
  average: number
  /** True when any input used is unverified: the action's own data, or a contribution to its stats. */
  hasUnverified: boolean
}

const isLevelled = (type: SkillType): type is LevelledSkillType =>
  (LEVELLED_SKILL_TYPES as readonly string[]).includes(type)

/** The level that applies to an action: its skill's level, or 1 for skills that have none. */
export function skillLevelFor(build: Build, skillType: SkillType): number {
  return isLevelled(skillType) ? build.resonator.skillLevels[skillType] : 1
}

/** The value at a skill level from a per-level list. A one-entry list does not scale. */
export function atLevel(values: readonly number[], level: number): number {
  return values[Math.min(Math.max(level, 1), values.length) - 1] ?? 0
}

export const SKILL_TYPE_NAME: Record<SkillType, string> = {
  normal: 'Basic Attack',
  skill: 'Resonance Skill',
  forte: 'Forte Circuit',
  liberation: 'Resonance Liberation',
  intro: 'Intro Skill',
  outro: 'Outro Skill',
  inherent: 'Inherent Skill',
  tuneBreak: 'Tune Break',
}

/** The action's name, with its skill type added when another action of the Resonator shares the name. */
export function actionDisplayName(resonator: ResonatorDef, action: ActionDef): string {
  const shared = resonator.actions.some((other) => other.id !== action.id && other.name === action.name)
  return shared ? `${action.name} (${SKILL_TYPE_NAME[action.skillType]})` : action.name
}

export function findAction(resonator: ResonatorDef, actionId: number): ActionDef {
  const action = resonator.actions.find((candidate) => candidate.id === actionId)
  if (!action) throw new Error(`${resonator.name} has no action ${actionId}`)
  return action
}

/** Values that stay the same for every action of a build, worked out once and reused. */
export interface BuildContext {
  build: Build
  catalog: Catalog
  resonator: ResonatorDef
  base: BaseStats
  modifiers: readonly Modifier[]
  enemy: EnemyState
}

export function prepareBuild(build: Build, catalog: Catalog, effectStates?: EffectStates): BuildContext {
  const resonator = catalog.resonators[build.resonator.id]
  if (!resonator) throw new Error(`Unknown Resonator ${build.resonator.id}`)
  return {
    build,
    catalog,
    resonator,
    base: resolveBaseStats(build, catalog),
    modifiers: collectModifiers(build, catalog, effectStates),
    enemy: { level: build.enemy.level, resistance: build.enemy.resistance },
  }
}

export function computeActionIn(context: BuildContext, actionId: number): ActionResult {
  const { build, resonator } = context
  const action = findAction(resonator, actionId)
  const header = { actionId: action.id, name: actionDisplayName(resonator, action), skillType: action.skillType, kind: action.kind }
  const skipped = (reason: string): ActionResult => ({
    ...header,
    counted: false,
    reason,
    parts: [],
    nonCrit: 0,
    crit: 0,
    average: 0,
    hasUnverified: false,
  })

  if (action.kind === 'heal') return skipped('This is healing, not damage.')
  if (!action.modelled) return skipped(action.notModelledReason ?? 'This action is not modelled.')

  const level = skillLevelFor(build, action.skillType)
  const parts = action.parts.map((part) => {
    const facets = { element: part.element, damageType: part.damageType, actionId: action.id, tags: part.tags }
    const sheet = computeStatSheet(context.base, context.modifiers, facets)
    return computeHit(
      {
        multiplier: atLevel(part.multipliers, level),
        flat: atLevel(part.flats, level),
        count: part.count,
        scalingStat: part.scalingStat,
        facets,
      },
      sheet,
      build.resonator.level,
      context.enemy,
    )
  })

  const sum = (pick: (part: HitResult) => number) => parts.reduce((total, part) => total + pick(part), 0)
  return {
    ...header,
    counted: true,
    parts,
    nonCrit: sum((part) => part.nonCrit),
    crit: sum((part) => part.crit),
    average: sum((part) => part.average),
    hasUnverified:
      !action.provenance.verified || !resonator.provenance.verified || parts.some((part) => part.hasUnverified),
  }
}

/** Damage of one action for a build, with the build's own effect switches. */
export function computeAction(build: Build, catalog: Catalog, actionId: number): ActionResult {
  return computeActionIn(prepareBuild(build, catalog), actionId)
}
