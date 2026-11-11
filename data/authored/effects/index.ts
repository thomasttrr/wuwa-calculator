import type { EffectDef } from '../../../src/engine/types/catalog'
import generated from './generated.json'
import { WEAPON_EFFECTS } from './weapons'

/** Effects read from game descriptions by scripts/data/build-effects.ts. */
export const GENERATED_EFFECTS = generated.effects as unknown as readonly EffectDef[]

/** Every effect the app knows: hand-encoded ones first, then the ones read from descriptions. */
export const AUTHORED_EFFECTS: readonly EffectDef[] = [...WEAPON_EFFECTS, ...GENERATED_EFFECTS]
