// Stats, modifiers and scopes: the vocabulary every number in the engine is built from.

export const ELEMENTS = ['physical', 'glacio', 'fusion', 'electro', 'aero', 'spectro', 'havoc'] as const
export type Element = (typeof ELEMENTS)[number]

/** How the game classes a hit. Decides which "X DMG Bonus" stats apply to it. */
export const DAMAGE_TYPES = [
  'basic',
  'heavy',
  'skill',
  'liberation',
  'intro',
  'outro',
  'echo',
  'tuneRupture',
  'other',
] as const
export type DamageType = (typeof DAMAGE_TYPES)[number]

/** The stat a hit's multiplier is applied to. */
export const SCALING_STATS = ['atk', 'hp', 'def', 'energyRegen'] as const
export type ScalingStat = (typeof SCALING_STATS)[number]

/**
 * Every kind of contribution the damage formula knows about.
 * Percentages are fractions throughout the engine: 0.12 means 12%.
 */
export const STAT_KEYS = [
  'atkPct',
  'atkFlat',
  'hpPct',
  'hpFlat',
  'defPct',
  'defFlat',
  'critRate',
  'critDmg',
  'energyRegen',
  'healingBonus',
  /** Added to (1 + sum) "DMG Bonus" term. Scope narrows it to an element or attack type. */
  'dmgBonus',
  /** Added to the (1 + sum) "DMG Amplify" term. */
  'amplify',
  /** Added to the (1 + sum) "Special DMG" term. */
  'special',
  /** Multiplies a hit's own multiplier: 0.2 turns 100% into 120%. */
  'multiplierBonus',
  /** Flat damage added to the base before any multiplier. */
  'flatDmg',
  /** Share of the enemy's DEF this attacker ignores. */
  'defIgnore',
  /** Reduction of the enemy's DEF stat. */
  'defReduction',
  /** Reduction of the enemy's resistance. Scope narrows it to an element. */
  'resReduction',
] as const
export type StatKey = (typeof STAT_KEYS)[number]

/**
 * Which hits a modifier applies to. An absent facet means "any".
 * A modifier applies when every facet it names matches the hit.
 */
export interface Scope {
  elements?: readonly Element[]
  damageTypes?: readonly DamageType[]
  /** Specific actions, by ActionDef id. */
  actionIds?: readonly number[]
  /** Free tags carried by a hit, for example "spectroFrazzle". */
  tags?: readonly string[]
}

export type SourceKind =
  | 'base'
  | 'trace'
  | 'weapon'
  | 'weaponPassive'
  | 'echoMain'
  | 'echoFixed'
  | 'echoSub'
  | 'echoEffect'
  | 'sonata'
  | 'sequence'
  | 'resonatorEffect'
  | 'teammate'
  | 'buff'
  | 'custom'
  | 'enemy'

/** Where a number came from. Shown to the user in every breakdown. */
export interface SourceRef {
  kind: SourceKind
  /** Catalog id of the thing that granted it, when there is one. */
  id?: number | string
  /** Plain name shown in breakdowns, for example "Emerald of Genesis" or "Echo 2 substat". */
  name: string
  /** False when the value is unverified, so results that use it can carry the mark. */
  verified?: boolean
}

/** One contribution to one stat. Totals are sums of these, so breakdowns are just lists of them. */
export interface Modifier {
  stat: StatKey
  value: number
  scope?: Scope
  source: SourceRef
}

/** The facets of a hit that scopes are matched against. */
export interface HitFacets {
  element: Element
  damageType: DamageType
  actionId?: number
  tags?: readonly string[]
}

/** A total with the contributions that produced it. */
export interface StatTrace {
  total: number
  parts: readonly Modifier[]
}

export interface BaseStats {
  /** Resonator base plus weapon base, before any percentage. */
  atk: number
  hp: number
  def: number
  /** Parts of each base value, for breakdowns. */
  atkParts: readonly { name: string; value: number }[]
  hpParts: readonly { name: string; value: number }[]
  defParts: readonly { name: string; value: number }[]
  critRate: number
  critDmg: number
  energyRegen: number
}

/** A scaling stat worked out as base x (1 + percent) + flat, keeping every part. */
export interface ScaledStatTrace {
  total: number
  base: number
  percent: StatTrace
  flat: StatTrace
}

/** Every stat as it applies to one hit (or, with no hit given, to the Resonator in general). */
export interface StatSheet {
  atk: ScaledStatTrace
  hp: ScaledStatTrace
  def: ScaledStatTrace
  critRate: StatTrace & { base: number }
  critDmg: StatTrace & { base: number }
  energyRegen: StatTrace & { base: number }
  healingBonus: StatTrace
  dmgBonus: StatTrace
  amplify: StatTrace
  special: StatTrace
  multiplierBonus: StatTrace
  flatDmg: StatTrace
  defIgnore: StatTrace
  defReduction: StatTrace
  resReduction: StatTrace
  /** True when any contribution used is marked unverified. */
  hasUnverified: boolean
}
