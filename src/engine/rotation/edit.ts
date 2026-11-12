// Pure edits to a rotation. Each returns a new rotation and leaves untouched items as they were,
// so React and the undo history only see what changed. Loops are one level deep.
import type { Rotation, RotationItem, RotationLoop, RotationStep } from '../types/build'

type StepFields = Partial<Pick<RotationStep, 'actionId' | 'enabled' | 'note' | 'seconds' | 'effectChanges'>>
type LoopFields = Partial<Pick<RotationLoop, 'count' | 'enabled'>>

/** The step or loop with this id, wherever it is. */
export function findItem(rotation: Rotation, id: string): RotationItem | undefined {
  for (const item of rotation.items) {
    if (item.id === id) return item
    if (item.kind === 'loop') {
      const inner = item.steps.find((s) => s.id === id)
      if (inner) return inner
    }
  }
  return undefined
}

/** The loop that holds this step, if any. */
export function loopOf(rotation: Rotation, stepId: string): RotationLoop | undefined {
  return rotation.items.find((item): item is RotationLoop => item.kind === 'loop' && item.steps.some((s) => s.id === stepId))
}

const withItems = (rotation: Rotation, items: readonly RotationItem[]): Rotation => ({ ...rotation, items })
const mapLoop = (rotation: Rotation, loopId: string, change: (loop: RotationLoop) => RotationLoop): Rotation =>
  withItems(
    rotation,
    rotation.items.map((item) => (item.kind === 'loop' && item.id === loopId ? change(item) : item)),
  )

export function addStep(rotation: Rotation, step: { actionId: number; id: string }, loopId?: string): Rotation {
  const fresh: RotationStep = { kind: 'step', id: step.id, actionId: step.actionId, enabled: true }
  if (loopId) return mapLoop(rotation, loopId, (loop) => ({ ...loop, steps: [...loop.steps, fresh] }))
  return withItems(rotation, [...rotation.items, fresh])
}

export function removeItem(rotation: Rotation, id: string): Rotation {
  if (!findItem(rotation, id)) return rotation
  const loop = loopOf(rotation, id)
  if (loop) return mapLoop(rotation, loop.id, (l) => ({ ...l, steps: l.steps.filter((s) => s.id !== id) }))
  return withItems(
    rotation,
    rotation.items.filter((item) => item.id !== id),
  )
}

function copyStep(step: RotationStep, newId: () => string): RotationStep {
  return { ...step, id: newId() }
}

export function duplicateItem(rotation: Rotation, id: string, newId: () => string): Rotation {
  const item = findItem(rotation, id)
  if (!item) return rotation
  const loop = item.kind === 'step' ? loopOf(rotation, id) : undefined
  if (loop) {
    return mapLoop(rotation, loop.id, (l) => {
      const at = l.steps.findIndex((s) => s.id === id)
      return { ...l, steps: [...l.steps.slice(0, at + 1), copyStep(item as RotationStep, newId), ...l.steps.slice(at + 1)] }
    })
  }
  const copy: RotationItem = item.kind === 'step' ? copyStep(item, newId) : { ...item, id: newId(), steps: item.steps.map((s) => copyStep(s, newId)) }
  const at = rotation.items.findIndex((i) => i.id === id)
  return withItems(rotation, [...rotation.items.slice(0, at + 1), copy, ...rotation.items.slice(at + 1)])
}

function moveIn<T extends { id: string }>(list: readonly T[], id: string, to: number): T[] {
  const from = list.findIndex((x) => x.id === id)
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved!)
  return next
}

/** Moves an item to a new position within the list it is in (the top level, or its loop). */
export function moveItem(rotation: Rotation, id: string, to: number): Rotation {
  if (!findItem(rotation, id)) return rotation
  const loop = loopOf(rotation, id)
  if (loop) return mapLoop(rotation, loop.id, (l) => ({ ...l, steps: moveIn(l.steps, id, to) }))
  return withItems(rotation, moveIn(rotation.items, id, to))
}

export function updateStep(rotation: Rotation, id: string, fields: StepFields): Rotation {
  const change = (s: RotationStep): RotationStep => ({ ...s, ...fields })
  return withItems(
    rotation,
    rotation.items.map((item) => {
      if (item.kind === 'step') return item.id === id ? change(item) : item
      return item.steps.some((s) => s.id === id) ? { ...item, steps: item.steps.map((s) => (s.id === id ? change(s) : s)) } : item
    }),
  )
}

export function updateLoop(rotation: Rotation, id: string, fields: LoopFields): Rotation {
  return mapLoop(rotation, id, (loop) => ({ ...loop, ...fields }))
}

/** Puts a top-level step in a new loop of two passes, in the same place. */
export function wrapInLoop(rotation: Rotation, stepId: string, loopId: string): Rotation {
  if (loopOf(rotation, stepId)) throw new Error('Loops go one level deep: this step is already in a loop.')
  return withItems(
    rotation,
    rotation.items.map((item) => (item.kind === 'step' && item.id === stepId ? { kind: 'loop', id: loopId, count: 2, enabled: true, steps: [item] } : item)),
  )
}

/** Replaces a loop with its steps, played once, in the same place. */
export function unwrapLoop(rotation: Rotation, loopId: string): Rotation {
  return withItems(
    rotation,
    rotation.items.flatMap((item): readonly RotationItem[] => (item.kind === 'loop' && item.id === loopId ? item.steps : [item])),
  )
}

/** A top-level step joins a loop: at its start when the loop comes after the step, at its end when before. */
export function moveStepIntoLoop(rotation: Rotation, stepId: string, loopId: string): Rotation {
  const stepAt = rotation.items.findIndex((i) => i.kind === 'step' && i.id === stepId)
  const loopAt = rotation.items.findIndex((i) => i.kind === 'loop' && i.id === loopId)
  if (stepAt < 0 || loopAt < 0) return rotation
  const step = rotation.items[stepAt] as RotationStep
  const rest = rotation.items.filter((i) => i.id !== stepId)
  return withItems(
    rotation,
    rest.map((item) =>
      item.kind === 'loop' && item.id === loopId ? { ...item, steps: stepAt < loopAt ? [step, ...item.steps] : [...item.steps, step] } : item,
    ),
  )
}

/** A step leaves its loop and is played once, right after the loop. */
export function moveStepOutOfLoop(rotation: Rotation, stepId: string): Rotation {
  const loop = loopOf(rotation, stepId)
  if (!loop) return rotation
  const step = loop.steps.find((s) => s.id === stepId)!
  return withItems(
    rotation,
    rotation.items.flatMap((item) => (item.id === loop.id ? [{ ...loop, steps: loop.steps.filter((s) => s.id !== stepId) }, step] : [item])),
  )
}
