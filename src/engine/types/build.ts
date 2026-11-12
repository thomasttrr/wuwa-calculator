// The shared build: the one object every tool reads and edits.
import type { EchoCost, LevelledSkillType } from './catalog'
import type { Element, Scope, StatKey } from './stats'

/** Whether an effect is on, and with how many stacks. Keyed by EffectDef id. */
export type EffectStates = Readonly<Record<string, { on: boolean; stacks?: number }>>

export interface ResonatorConfig {
  id: number
  /** 1 to 90. */
  level: number
  /** True when the Resonator has ascended at a level where ascension happens (20, 40, 50, 60, 70, 80). */
  ascended: boolean
  /** Sequence nodes unlocked: 0 to 6. */
  sequence: number
  skillLevels: Readonly<Record<LevelledSkillType, number>>
  /** Ids of unlocked stat nodes in the skill tree. */
  traceNodeIds: readonly number[]
}

export interface WeaponConfig {
  id: number
  /** 1 to 90. */
  level: number
  ascended: boolean
  /** Refinement rank: 1 to 5. */
  rank: number
}

export interface EchoSubstat {
  stat: StatKey
  scope?: Scope
  value: number
}

/** One Echo the player owns or has drafted. */
export interface EchoInstance {
  uid: string
  echoId: number
  cost: EchoCost
  /** The Sonata set this copy belongs to. */
  sonataId: number
  mainStat: { stat: StatKey; scope?: Scope; value: number }
  /** The fixed second stat for this cost. */
  fixedStat: { stat: StatKey; value: number }
  substats: readonly EchoSubstat[]
}

/** A teammate, modelled as a provider of buffs rather than a simulated attacker. */
export interface TeammateConfig {
  resonatorId: number
  sequence: number
  weaponId?: number
  weaponRank?: number
  /** Sonata sets the teammate has complete, as [sonataId, pieces]. */
  sonatas: readonly (readonly [number, number])[]
}

/** A modifier the user typed in by hand. */
export interface CustomModifier {
  id: string
  label: string
  stat: StatKey
  scope?: Scope
  value: number
  on: boolean
}

export interface EnemyConfig {
  /** Catalog enemy this was taken from, when it was. */
  enemyId?: number
  name: string
  level: number
  resistance: Record<Element, number>
}

/** One step of a rotation: one action, once or several times. */
export interface RotationStep {
  kind: 'step'
  id: string
  actionId: number
  enabled: boolean
  note?: string
  /** Seconds this step takes, when the user has entered it. */
  seconds?: number
  /** Effect changes that take hold at this step. */
  effectChanges?: readonly {
    effectId: string
    on: boolean
    stacks?: number
    /** "onward": stays until changed. "thisStep": reverts after this step. */
    lasts: 'onward' | 'thisStep'
  }[]
}

/** A run of steps repeated `count` times. One level deep in v1. */
export interface RotationLoop {
  kind: 'loop'
  id: string
  count: number
  enabled: boolean
  steps: readonly RotationStep[]
}

export type RotationItem = RotationStep | RotationLoop

export interface Rotation {
  id: string
  name: string
  items: readonly RotationItem[]
}

export interface Build {
  id: string
  name: string
  resonator: ResonatorConfig
  weapon: WeaponConfig | null
  /** Five slots. Slot 0 is the main Echo, whose effect is active. */
  echoes: readonly (EchoInstance | null)[]
  teammates: readonly (TeammateConfig | null)[]
  /** On/off and stack state for every effect, the build's own and teammates'. */
  effects: EffectStates
  customModifiers: readonly CustomModifier[]
  enemy: EnemyConfig
  rotation: Rotation
  /**
   * Engine-internal, never saved: replaces the counted set pieces. The optimizer uses it to
   * evaluate set bonuses for a group of Echoes it has not fully chosen yet.
   */
  piecesOverride?: Readonly<Record<number, number>>
}
