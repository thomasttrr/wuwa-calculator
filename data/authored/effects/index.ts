import type { EffectDef } from '../../../src/engine/types/catalog'
import { WEAPON_EFFECTS } from './weapons'

/** Every hand-encoded effect. Passed to the catalog loader. */
export const AUTHORED_EFFECTS: readonly EffectDef[] = [...WEAPON_EFFECTS]
