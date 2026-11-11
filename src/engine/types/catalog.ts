// The game data the engine works from. Callers build a Catalog (from data/game/<version>)
// and pass it in; the engine never loads data itself.
import type { DamageType, Element, Scope, ScalingStat, StatKey } from './stats'

export type DataSource = 'encore' | 'nanoka' | 'arikatsu' | 'authored'

/** Where a record came from and whether a second source agrees with it. */
export interface Provenance {
  source: DataSource
  /** Id or path of the record in the source, so the value can be traced back. */
  sourceId: string
  /** True when a second public source gives the same values. */
  verified: boolean
  /** True when the record exists only in a game version that is not live yet. */
  beta?: boolean
  note?: string
}

export const WEAPON_TYPES = ['broadblade', 'sword', 'pistols', 'gauntlets', 'rectifier'] as const
export type WeaponType = (typeof WEAPON_TYPES)[number]

/** The five skills a player can level, plus the ones that have no level. */
export const SKILL_TYPES = ['normal', 'skill', 'forte', 'liberation', 'intro', 'outro', 'inherent', 'tuneBreak'] as const
export type SkillType = (typeof SKILL_TYPES)[number]
export const LEVELLED_SKILL_TYPES = ['normal', 'skill', 'forte', 'liberation', 'intro'] as const
export type LevelledSkillType = (typeof LEVELLED_SKILL_TYPES)[number]

/** Base stats at one level. A level where ascension happens appears twice: before and after. */
export interface GrowthPoint {
  level: number
  /** True for the entry after ascending at this level. */
  ascended: boolean
  hp: number
  atk: number
  def: number
}

/** A stat node in the skill tree ("ATK increased by 1.80%"). */
export interface TraceNodeDef {
  id: number
  stat: StatKey
  scope?: Scope
  value: number
  label: string
}

/** One term of a skill value such as "29.86%*2": a multiplier, landing `count` times. */
export interface ActionPart {
  /** Multiplier as a fraction, per skill level (index 0 is level 1). One entry if it does not scale. */
  multipliers: readonly number[]
  /** Flat part per skill level, parallel to multipliers. All zero for most hits. */
  flats: readonly number[]
  count: number
  damageType: DamageType
  element: Element
  scalingStat: ScalingStat
  tags: readonly string[]
  /** Resonance Energy gained per landing, when the source gives it. */
  energy?: number
  /** Id of the raw damage row this part was matched to. */
  rowId?: number
  /** False when no raw damage row matched, so type and element fell back to the skill's own. */
  matched: boolean
}

/** One line of a skill's value table: a named thing the Resonator does ("Stage 3 DMG"). */
export interface ActionDef {
  id: number
  skillId: number
  skillType: SkillType
  /** The name the game shows for this value. */
  name: string
  kind: 'damage' | 'heal'
  parts: readonly ActionPart[]
  /**
   * False when the engine cannot compute this action from the standard formula
   * (a non-standard formula type, or a value that could not be parsed).
   * Such actions are shown as "Not modelled" and left out of totals.
   */
  modelled: boolean
  notModelledReason?: string
  provenance: Provenance
}

export interface SkillDef {
  id: number
  type: SkillType
  name: string
  description: string
  actionIds: readonly number[]
}

export interface SequenceDef {
  /** 1 to 6. */
  index: number
  name: string
  description: string
  /** The numbers the description quotes, exactly as the source gives them. */
  params: readonly string[]
}

export interface ResonatorDef {
  id: number
  name: string
  rarity: 4 | 5
  element: Element
  weaponType: WeaponType
  growth: readonly GrowthPoint[]
  baseCritRate: number
  baseCritDmg: number
  traceNodes: readonly TraceNodeDef[]
  skills: readonly SkillDef[]
  actions: readonly ActionDef[]
  sequences: readonly SequenceDef[]
  /** "full": mechanics are hand-encoded. "basic": stats and raw multipliers only. */
  model: 'full' | 'basic'
  provenance: Provenance
}

export interface WeaponGrowthPoint {
  level: number
  ascended: boolean
  atk: number
  /** Secondary stat value as a fraction (0.2025 for 20.25%). */
  secondary: number
}

export interface WeaponDef {
  id: number
  name: string
  rarity: 1 | 2 | 3 | 4 | 5
  weaponType: WeaponType
  growth: readonly WeaponGrowthPoint[]
  secondaryStat: StatKey
  passive: {
    name: string
    description: string
    /** params[i][rank - 1]: the i-th number in the description at each refinement rank. */
    params: readonly (readonly string[])[]
  }
  provenance: Provenance
}

export type EchoCost = 1 | 3 | 4

export interface EchoDef {
  id: number
  name: string
  cost: EchoCost
  /** Sonata sets this Echo can belong to. */
  sonataIds: readonly number[]
  element?: Element
  skill: {
    description: string
    cooldown: number
    /** Skill values per Echo rarity, lowest first, exactly as the source gives them. */
    params: readonly (readonly string[])[]
  }
  provenance: Provenance
}

export interface SonataPieceEffect {
  /** How many pieces are needed: 2, 3 or 5. */
  pieces: number
  description: string
  params: readonly string[]
  /** Plain stat bonuses the game stores as structured data (most 2-piece effects). Always on. */
  fixed: readonly { stat: StatKey; scope?: Scope; value: number }[]
}

export interface SonataDef {
  id: number
  name: string
  effects: readonly SonataPieceEffect[]
  provenance: Provenance
}

export interface EnemyDef {
  id: number
  name: string
  /** The game's class label, for example "Common Class" or "Overlord Class". */
  rank: string
  resistance: Record<Element, number>
  provenance: Provenance
}

/** Legal Echo stats: main stats by cost, the fixed second stat by cost, and substat roll values. */
export interface EchoStatTables {
  /** Main stat choices per cost, with the value at maximum level for a 5-star Echo. */
  mainStats: Record<EchoCost, readonly { stat: StatKey; scope?: Scope; value: number; label: string }[]>
  /** The fixed second stat every Echo of that cost has, at maximum level for a 5-star Echo. */
  fixedStats: Record<EchoCost, { stat: StatKey; value: number; label: string }>
  /** Each substat with every value it can roll, lowest first. */
  substats: readonly {
    stat: StatKey
    scope?: Scope
    label: string
    rolls: readonly number[]
    /** Chance of each roll value, parallel to rolls, as published by Kuro Games. */
    chances: readonly number[]
  }[]
  provenance: Provenance
}

/** How an effect is switched on in the interface. */
export type EffectControl =
  | { kind: 'always' }
  | { kind: 'toggle'; default: boolean }
  | {
      kind: 'stacks'
      max: number
      default: number
      /** Index of the owner's description parameter that states the stack limit, when it has one. */
      maxParamIndex?: number
    }

/** What grants an effect. */
export type EffectOwner =
  /** `sequence`: a Sequence node. `skillId`: a passive or Outro skill, whose numbers are quoted in its description. */
  | { kind: 'resonator'; id: number; sequence?: number; skillId?: number }
  | { kind: 'weapon'; id: number }
  | { kind: 'sonata'; id: number; pieces: number }
  | { kind: 'echo'; id: number }

/** One modifier an effect grants. `values` holds one number, or one per weapon rank. */
export interface EffectModifier {
  stat: StatKey
  scope?: Scope
  /** One value, or five (refinement ranks 1 to 5) for weapon passives. */
  values: readonly number[]
  /** True when the value is multiplied by the number of active stacks. */
  perStack?: boolean
  /**
   * Index into the owner's description params that this value was read from, or -1 when the
   * owner has no params and the value is quoted word for word in its description.
   */
  paramIndex: number
}

/** A hand-encoded effect. Every number in it cites the description parameter it came from. */
export interface EffectDef {
  id: string
  owner: EffectOwner
  name: string
  /** Who receives it. */
  target: 'self' | 'team' | 'nextResonator'
  control: EffectControl
  modifiers: readonly EffectModifier[]
  /** One plain sentence saying when the effect is active, for the interface. */
  condition: string
  provenance: Provenance
}

export interface Catalog {
  gameVersion: string
  /** ISO date the data was fetched. */
  dataDate: string
  resonators: Readonly<Record<number, ResonatorDef>>
  weapons: Readonly<Record<number, WeaponDef>>
  echoes: Readonly<Record<number, EchoDef>>
  sonatas: Readonly<Record<number, SonataDef>>
  enemies: Readonly<Record<number, EnemyDef>>
  echoStats: EchoStatTables
  effects: readonly EffectDef[]
}
