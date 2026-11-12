// A rotation as text, to copy or keep as a file, and back. Checked on the way in, with plain errors.
import { z } from 'zod'
import type { Rotation } from '../engine/types/build'
import type { Catalog } from '../engine/types/catalog'

const FORMAT = 'theWuthering.rotation'

const change = z.object({ effectId: z.string(), on: z.boolean(), stacks: z.number().optional(), lasts: z.enum(['onward', 'thisStep']) })
const step = z.object({
  kind: z.literal('step'),
  id: z.string(),
  actionId: z.number().int(),
  enabled: z.boolean(),
  note: z.string().optional(),
  seconds: z.number().nonnegative().optional(),
  effectChanges: z.array(change).optional(),
})
const loop = z.object({ kind: z.literal('loop'), id: z.string(), count: z.number().int().min(1).max(99), enabled: z.boolean(), steps: z.array(step) })
const file = z.object({
  format: z.literal(FORMAT),
  version: z.literal(1),
  resonatorId: z.number().int(),
  rotation: z.object({ id: z.string(), name: z.string(), items: z.array(z.union([step, loop])) }),
})

export function exportRotation(rotation: Rotation, resonatorId: number, catalog: Catalog): string {
  return JSON.stringify(
    { format: FORMAT, version: 1, gameVersion: catalog.gameVersion, resonatorId, resonator: catalog.resonators[resonatorId]?.name, rotation },
    null,
    2,
  )
}

/** Reads a rotation. With `forResonatorId`, refuses one made for someone else. */
export function importRotation(text: string, catalog: Catalog, forResonatorId?: number): { rotation: Rotation; resonatorId: number } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('This is not a rotation file: it could not be read.')
  }
  const parsed = file.safeParse(raw)
  if (!parsed.success) throw new Error('This is not a theWuthering rotation.')
  const { resonatorId, rotation } = parsed.data
  const resonator = catalog.resonators[resonatorId]
  if (!resonator) throw new Error('This rotation is for a Resonator this version does not have.')
  if (forResonatorId !== undefined && forResonatorId !== resonatorId) {
    throw new Error(`This rotation is for ${resonator.name}, not ${catalog.resonators[forResonatorId]?.name ?? 'this Resonator'}.`)
  }
  const known = new Set(resonator.actions.map((a) => a.id))
  const steps = rotation.items.flatMap((item) => (item.kind === 'loop' ? item.steps : [item]))
  const unknown = steps.filter((s) => !known.has(s.actionId)).length
  if (unknown > 0) throw new Error(`${unknown} ${unknown === 1 ? 'step uses an action' : 'steps use actions'} ${resonator.name} does not have.`)
  return { rotation: rotation as Rotation, resonatorId }
}
