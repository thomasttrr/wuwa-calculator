// Which effects touch the current rotation, and which do nothing, with the reason in plain words.
import { scopeMatches } from '../stats/sheet'
import { activeStacks, ownedEffects } from '../stats/collect'
import type { Build } from '../types/build'
import type { Catalog, EffectDef } from '../types/catalog'
import type { DamageType, HitFacets, ScalingStat, StatKey } from '../types/stats'
import { simulateRotation } from './simulate'

export interface EffectAudit {
  /** The key the effect's on/off state is stored under. */
  key: string
  effectId: string
  label: string
  condition: string
  holder: 'self' | number
  active: boolean
  stacks: number
  touches: boolean
  hitCount: number
  reason: string
  verified: boolean
}

const NO_DAMAGE: Partial<Record<StatKey, string>> = { healingBonus: 'Healing Bonus' }
const SCALING: Partial<Record<StatKey, { stat: ScalingStat; name: string }>> = {
  atkPct: { stat: 'atk', name: 'ATK' },
  atkFlat: { stat: 'atk', name: 'ATK' },
  hpPct: { stat: 'hp', name: 'HP' },
  hpFlat: { stat: 'hp', name: 'HP' },
  defPct: { stat: 'def', name: 'DEF' },
  defFlat: { stat: 'def', name: 'DEF' },
  energyRegen: { stat: 'energyRegen', name: 'Energy Regen' },
}
const TYPE_NAME: Record<DamageType, string> = {
  basic: 'Basic Attack',
  heavy: 'Heavy Attack',
  skill: 'Resonance Skill',
  liberation: 'Resonance Liberation',
  intro: 'Intro Skill',
  outro: 'Outro Skill',
  echo: 'Echo Skill',
  tuneRupture: 'Tune Rupture',
  other: 'other',
}

interface Hit {
  facets: HitFacets
  scaling: ScalingStat
}

/** Why an active effect changes nothing, or null when it changes at least one hit. */
function whyNothing(effect: EffectDef, hits: readonly Hit[]): string | null {
  const reasons: string[] = []
  for (const modifier of effect.modifiers) {
    const noDamage = NO_DAMAGE[modifier.stat]
    if (noDamage) {
      reasons.push(`Raises ${noDamage}, which does not change damage.`)
      continue
    }
    const scoped = hits.filter((hit) => scopeMatches(modifier.scope, hit.facets))
    const scaling = SCALING[modifier.stat]
    const relevant = scaling ? scoped.filter((hit) => hit.scaling === scaling.stat) : scoped
    if (relevant.length > 0) return null
    if (scaling && scoped.length > 0) reasons.push(`Raises ${scaling.name}, but no hit in this rotation scales with ${scaling.name}.`)
    else if (modifier.scope?.damageTypes) {
      const names = modifier.scope.damageTypes.map((type) => TYPE_NAME[type]).join(' or ')
      reasons.push(`Only affects ${names} hits, and this rotation has none.`)
    } else reasons.push('Applies to hits this rotation does not have.')
  }
  return reasons[0] ?? 'Changes no hit in this rotation.'
}

export function auditEffects(build: Build, catalog: Catalog): EffectAudit[] {
  const hits: Hit[] = simulateRotation(build, catalog).steps.flatMap((step) =>
    step.action.parts.map((part) => ({ facets: part.facets, scaling: part.formula.scalingStat })),
  )

  return ownedEffects(build, catalog).map((owned) => {
    const { effect } = owned
    const stacks = activeStacks(effect, build.effects, owned.key)
    const common = {
      key: owned.key,
      effectId: effect.id,
      label: owned.label,
      condition: effect.condition,
      holder: owned.holder,
      stacks,
      verified: effect.provenance.verified,
    }
    if (stacks === 0) return { ...common, active: false, touches: false, hitCount: 0, reason: 'Switched off.' }

    const nothing = whyNothing(effect, hits)
    if (nothing) return { ...common, active: true, touches: false, hitCount: 0, reason: nothing }

    const hitCount = hits.filter((hit) =>
      effect.modifiers.some((modifier) => {
        if (NO_DAMAGE[modifier.stat] || !scopeMatches(modifier.scope, hit.facets)) return false
        const scaling = SCALING[modifier.stat]
        return !scaling || scaling.stat === hit.scaling
      }),
    ).length
    return {
      ...common,
      active: true,
      touches: true,
      hitCount,
      reason: `Changes ${hitCount} ${hitCount === 1 ? 'hit' : 'hits'} in this rotation.`,
    }
  })
}
