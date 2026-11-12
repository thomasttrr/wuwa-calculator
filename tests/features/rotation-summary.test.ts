import { describe, expect, it } from 'vitest'
import { summariseRotation } from '../../src/features/rotation/summary'
import type { Rotation, RotationStep } from '../../src/engine/types/build'
import { catalog } from '../engine/fixtures/builds'

const yangyang = catalog.resonators[1402]!
const [first, second] = yangyang.actions.filter((a) => a.kind === 'damage')
const step = (id: string, actionId: number, extra: Partial<RotationStep> = {}): RotationStep => ({ kind: 'step', id, actionId, enabled: true, ...extra })
const name = (id: number) => yangyang.actions.find((a) => a.id === id)!.name

describe('summariseRotation: the plain list to follow in game', () => {
  it('numbers the steps, joins repeats of the same action, and skips switched-off steps', () => {
    const rotation: Rotation = {
      id: 'r',
      name: 'R',
      items: [step('a', first!.id), step('b', first!.id), step('c', second!.id, { enabled: false }), step('d', second!.id, { note: 'Cancel early' })],
    }
    expect(summariseRotation(rotation, yangyang)).toEqual([`1. ${name(first!.id)}, 2 times`, `2. ${name(second!.id)} (Cancel early)`])
  })

  it('writes a loop as "Repeat N times" with its steps beneath', () => {
    const rotation: Rotation = {
      id: 'r',
      name: 'R',
      items: [{ kind: 'loop', id: 'L', count: 3, enabled: true, steps: [step('a', first!.id), step('b', second!.id)] }, step('c', first!.id)],
    }
    expect(summariseRotation(rotation, yangyang)).toEqual([
      '1. Repeat 3 times:',
      `   ${name(first!.id)}`,
      `   ${name(second!.id)}`,
      `2. ${name(first!.id)}`,
    ])
  })

  it('says so when nothing is switched on', () => {
    expect(summariseRotation({ id: 'r', name: 'R', items: [] }, yangyang)).toEqual(['No steps are switched on.'])
  })
})
