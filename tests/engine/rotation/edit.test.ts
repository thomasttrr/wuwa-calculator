import { describe, expect, it } from 'vitest'
import {
  addStep,
  duplicateItem,
  findItem,
  moveItem,
  moveStepIntoLoop,
  moveStepOutOfLoop,
  removeItem,
  unwrapLoop,
  updateLoop,
  updateStep,
  wrapInLoop,
} from '../../../src/engine/rotation/edit'
import type { Rotation, RotationLoop, RotationStep } from '../../../src/engine/types/build'

const step = (id: string, actionId = 1): RotationStep => ({ kind: 'step', id, actionId, enabled: true })
const loop = (id: string, steps: RotationStep[], count = 2): RotationLoop => ({ kind: 'loop', id, count, enabled: true, steps })
const rotation = (...items: Rotation['items']): Rotation => ({ id: 'r', name: 'R', items })
const ids = (r: Rotation) => r.items.map((item) => (item.kind === 'loop' ? `${item.id}[${item.steps.map((s) => s.id).join(',')}]` : item.id))

describe('rotation edits', () => {
  const base = rotation(step('a'), step('b'), loop('L', [step('c'), step('d')]), step('e'))

  it('adds a step at the end, or at the end of a loop', () => {
    expect(ids(addStep(base, { actionId: 9, id: 'n' }))).toEqual(['a', 'b', 'L[c,d]', 'e', 'n'])
    expect(ids(addStep(base, { actionId: 9, id: 'n' }, 'L'))).toEqual(['a', 'b', 'L[c,d,n]', 'e'])
  })

  it('removes a step anywhere, or a whole loop', () => {
    expect(ids(removeItem(base, 'c'))).toEqual(['a', 'b', 'L[d]', 'e'])
    expect(ids(removeItem(base, 'L'))).toEqual(['a', 'b', 'e'])
  })

  it('duplicates a step or a loop right after itself, with new ids', () => {
    let n = 0
    const next = () => `x${++n}`
    expect(ids(duplicateItem(base, 'b', next))).toEqual(['a', 'b', 'x1', 'L[c,d]', 'e'])
    n = 0
    expect(ids(duplicateItem(base, 'L', next))).toEqual(['a', 'b', 'L[c,d]', 'x1[x2,x3]', 'e'])
    n = 0
    expect(ids(duplicateItem(base, 'c', next))).toEqual(['a', 'b', 'L[c,x1,d]', 'e'])
  })

  it('moves an item within its own list', () => {
    expect(ids(moveItem(base, 'e', 0))).toEqual(['e', 'a', 'b', 'L[c,d]'])
    expect(ids(moveItem(base, 'a', 3))).toEqual(['b', 'L[c,d]', 'e', 'a'])
    expect(ids(moveItem(base, 'd', 0))).toEqual(['a', 'b', 'L[d,c]', 'e'])
  })

  it('updates a step or a loop, leaving the rest untouched', () => {
    const next = updateStep(base, 'c', { seconds: 1.5, note: 'Cancel early' })
    expect(findItem(next, 'c')).toMatchObject({ seconds: 1.5, note: 'Cancel early', actionId: 1 })
    expect(next.items[0]).toBe(base.items[0])
    expect((updateLoop(base, 'L', { count: 3 }).items[2] as RotationLoop).count).toBe(3)
  })

  it('puts a step in a new loop of two passes, and takes a loop apart in place', () => {
    expect(ids(wrapInLoop(base, 'b', 'M'))).toEqual(['a', 'M[b]', 'L[c,d]', 'e'])
    expect((wrapInLoop(base, 'b', 'M').items[1] as RotationLoop).count).toBe(2)
    expect(ids(unwrapLoop(base, 'L'))).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('moves a top-level step into the loop before or after it, and a loop step out after its loop', () => {
    expect(ids(moveStepIntoLoop(base, 'b', 'L'))).toEqual(['a', 'L[b,c,d]', 'e'])
    expect(ids(moveStepIntoLoop(base, 'e', 'L'))).toEqual(['a', 'b', 'L[c,d,e]'])
    expect(ids(moveStepOutOfLoop(base, 'c'))).toEqual(['a', 'b', 'L[d]', 'c', 'e'])
  })

  it('never nests a loop inside a loop', () => {
    expect(() => wrapInLoop(base, 'c', 'M')).toThrow(/one level/)
  })

  it('leaves the rotation untouched when the id is unknown', () => {
    expect(removeItem(base, 'zz')).toBe(base)
    expect(moveItem(base, 'zz', 0)).toBe(base)
  })
})
