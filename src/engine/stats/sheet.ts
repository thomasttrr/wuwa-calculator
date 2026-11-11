import type {
  BaseStats,
  HitFacets,
  Modifier,
  ScaledStatTrace,
  Scope,
  StatKey,
  StatSheet,
  StatTrace,
} from '../types/stats'

/**
 * Does a modifier with this scope apply to this hit?
 * No scope: always. A scope with no hit to test against: never (a scoped bonus
 * is not part of the Resonator's general stats).
 */
export function scopeMatches(scope: Scope | undefined, hit: HitFacets | undefined): boolean {
  if (!scope) return true
  if (!hit) return false
  if (scope.elements && !scope.elements.includes(hit.element)) return false
  if (scope.damageTypes && !scope.damageTypes.includes(hit.damageType)) return false
  if (scope.actionIds && (hit.actionId === undefined || !scope.actionIds.includes(hit.actionId))) return false
  if (scope.tags && !scope.tags.some((tag) => hit.tags?.includes(tag))) return false
  return true
}

function trace(applicable: readonly Modifier[], stat: StatKey): StatTrace {
  const parts = applicable.filter((modifier) => modifier.stat === stat)
  return { total: parts.reduce((total, part) => total + part.value, 0), parts }
}

function scaled(base: number, percent: StatTrace, flat: StatTrace): ScaledStatTrace {
  return { total: base * (1 + percent.total) + flat.total, base, percent, flat }
}

/**
 * Totals every stat from its modifiers, keeping the list of contributions behind each total.
 * Pass a hit to get the stats as they apply to that hit; omit it for the general sheet.
 */
export function computeStatSheet(base: BaseStats, modifiers: readonly Modifier[], hit?: HitFacets): StatSheet {
  const applicable = modifiers.filter((modifier) => scopeMatches(modifier.scope, hit))
  const of = (stat: StatKey) => trace(applicable, stat)
  const withBase = (stat: StatKey, baseValue: number) => {
    const t = of(stat)
    return { total: baseValue + t.total, parts: t.parts, base: baseValue }
  }

  return {
    atk: scaled(base.atk, of('atkPct'), of('atkFlat')),
    hp: scaled(base.hp, of('hpPct'), of('hpFlat')),
    def: scaled(base.def, of('defPct'), of('defFlat')),
    critRate: withBase('critRate', base.critRate),
    critDmg: withBase('critDmg', base.critDmg),
    energyRegen: withBase('energyRegen', base.energyRegen),
    healingBonus: of('healingBonus'),
    dmgBonus: of('dmgBonus'),
    amplify: of('amplify'),
    special: of('special'),
    multiplierBonus: of('multiplierBonus'),
    flatDmg: of('flatDmg'),
    defIgnore: of('defIgnore'),
    defReduction: of('defReduction'),
    resReduction: of('resReduction'),
    hasUnverified: applicable.some((modifier) => modifier.source.verified === false),
  }
}
