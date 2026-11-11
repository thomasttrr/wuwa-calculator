// Runtime shape checks for the catalog files in data/game/<version>.
// The engine's TypeScript types say what the app expects; these schemas prove the files match.
import { z } from 'zod'
import { DAMAGE_TYPES, ELEMENTS, SCALING_STATS, STAT_KEYS } from '../engine/types/stats'
import { SKILL_TYPES, WEAPON_TYPES } from '../engine/types/catalog'

const element = z.enum(ELEMENTS)
const damageType = z.enum(DAMAGE_TYPES)
const statKey = z.enum(STAT_KEYS)
const fraction = z.number().finite()

export const scopeSchema = z.strictObject({
  elements: z.array(element).optional(),
  damageTypes: z.array(damageType).optional(),
  actionIds: z.array(z.number().int()).optional(),
  tags: z.array(z.string()).optional(),
})

export const provenanceSchema = z.strictObject({
  source: z.enum(['encore', 'nanoka', 'arikatsu', 'authored']),
  sourceId: z.string().min(1),
  verified: z.boolean(),
  beta: z.boolean().optional(),
  note: z.string().optional(),
})

const actionPartSchema = z.strictObject({
  multipliers: z.array(fraction.min(0)).min(1),
  flats: z.array(fraction.min(0)).min(1),
  count: z.number().int().min(1),
  damageType,
  element,
  scalingStat: z.enum(SCALING_STATS),
  tags: z.array(z.string()),
  energy: z.number().optional(),
  rowId: z.number().int().optional(),
  matched: z.boolean(),
})

const actionSchema = z.strictObject({
  id: z.number().int(),
  skillId: z.number().int(),
  skillType: z.enum(SKILL_TYPES),
  name: z.string().min(1),
  kind: z.enum(['damage', 'heal']),
  parts: z.array(actionPartSchema),
  modelled: z.boolean(),
  notModelledReason: z.string().optional(),
  provenance: provenanceSchema,
})

export const resonatorSchema = z.strictObject({
  id: z.number().int(),
  name: z.string().min(1),
  rarity: z.union([z.literal(4), z.literal(5)]),
  element,
  weaponType: z.enum(WEAPON_TYPES),
  growth: z
    .array(
      z.strictObject({
        level: z.number().int().min(1).max(90),
        ascended: z.boolean(),
        hp: z.number().positive(),
        atk: z.number().positive(),
        // Zero is real: both sources give Jingran a DEF of 0 at every level.
        def: z.number().min(0),
      }),
    )
    .min(90),
  baseCritRate: fraction.min(0).max(1),
  baseCritDmg: fraction.min(1),
  traceNodes: z.array(
    z.strictObject({ id: z.number().int(), stat: statKey, scope: scopeSchema.optional(), value: fraction.positive(), label: z.string() }),
  ),
  skills: z.array(
    z.strictObject({
      id: z.number().int(),
      type: z.enum(SKILL_TYPES),
      name: z.string(),
      description: z.string(),
      actionIds: z.array(z.number().int()),
    }),
  ),
  actions: z.array(actionSchema),
  sequences: z.array(
    z.strictObject({ index: z.number().int().min(1).max(6), name: z.string(), description: z.string(), params: z.array(z.string()) }),
  ),
  model: z.enum(['full', 'basic']),
  provenance: provenanceSchema,
})

export const weaponSchema = z.strictObject({
  id: z.number().int(),
  name: z.string().min(1),
  rarity: z.number().int().min(1).max(5),
  weaponType: z.enum(WEAPON_TYPES),
  growth: z
    .array(
      z.strictObject({
        level: z.number().int().min(1).max(90),
        ascended: z.boolean(),
        atk: z.number().positive(),
        secondary: fraction.min(0),
      }),
    )
    .min(90),
  secondaryStat: statKey,
  passive: z.strictObject({ name: z.string(), description: z.string(), params: z.array(z.array(z.string())) }),
  provenance: provenanceSchema,
})

export const echoSchema = z.strictObject({
  id: z.number().int(),
  name: z.string().min(1),
  cost: z.union([z.literal(1), z.literal(3), z.literal(4)]),
  sonataIds: z.array(z.number().int()).min(1),
  element: element.optional(),
  skill: z.strictObject({ description: z.string(), cooldown: z.number(), params: z.array(z.array(z.string())) }),
  provenance: provenanceSchema,
})

export const sonataSchema = z.strictObject({
  id: z.number().int(),
  name: z.string().min(1),
  effects: z
    .array(
      z.strictObject({
        pieces: z.number().int().min(1).max(5),
        description: z.string(),
        params: z.array(z.string()),
        fixed: z.array(z.strictObject({ stat: statKey, scope: scopeSchema.optional(), value: fraction.positive() })),
      }),
    )
    .min(1),
  provenance: provenanceSchema,
})

const resistanceSchema = z.strictObject({
  physical: fraction,
  glacio: fraction,
  fusion: fraction,
  electro: fraction,
  aero: fraction,
  spectro: fraction,
  havoc: fraction,
})

export const enemySchema = z.strictObject({
  id: z.number().int(),
  name: z.string().min(1),
  rank: z.string(),
  resistance: resistanceSchema,
  provenance: provenanceSchema,
})

const mainStatSchema = z.strictObject({ stat: statKey, scope: scopeSchema.optional(), value: fraction.positive(), label: z.string() })
const fixedStatSchema = z.strictObject({ stat: statKey, value: fraction.positive(), label: z.string() })

export const echoStatTablesSchema = z.strictObject({
  mainStats: z.strictObject({ 1: z.array(mainStatSchema).min(1), 3: z.array(mainStatSchema).min(1), 4: z.array(mainStatSchema).min(1) }),
  fixedStats: z.strictObject({ 1: fixedStatSchema, 3: fixedStatSchema, 4: fixedStatSchema }),
  substats: z
    .array(
      z.strictObject({
        stat: statKey,
        scope: scopeSchema.optional(),
        label: z.string(),
        rolls: z.array(fraction.positive()).min(1),
        chances: z.array(fraction.positive()).min(1),
      }),
    )
    .min(1),
  provenance: provenanceSchema,
})

export const manifestSchema = z.object({
  gameVersion: z.string().regex(/^\d+\.\d+(\.\d+)?$/),
  dataDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sources: z.array(z.object({ name: z.string(), url: z.string(), role: z.string() })).min(1),
  counts: z.record(z.string(), z.number()),
})
