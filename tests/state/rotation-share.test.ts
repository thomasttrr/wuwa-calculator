import { describe, expect, it } from 'vitest'
import { createSampleBuild } from '../../src/data/sample-build'
import { exportRotation, importRotation } from '../../src/state/rotation-share'
import { catalog } from '../engine/fixtures/builds'

const sample = createSampleBuild(catalog)
const jiyan = sample.resonator.id
const withExtras = {
  ...sample.rotation,
  items: [
    ...sample.rotation.items,
    {
      kind: 'loop' as const,
      id: 'L',
      count: 3,
      enabled: false,
      steps: [{ kind: 'step' as const, id: 'x', actionId: (sample.rotation.items[0] as { actionId: number }).actionId, enabled: true, seconds: 1.2, note: 'Cancel', effectChanges: [{ effectId: 'e', on: true, lasts: 'thisStep' as const }] }],
    },
  ],
}

describe('rotation sharing', () => {
  it('imports exactly what it exported', () => {
    const text = exportRotation(withExtras, jiyan, catalog)
    expect(importRotation(text, catalog, jiyan)).toEqual({ rotation: withExtras, resonatorId: jiyan })
  })

  it('says plainly when the text is not a rotation', () => {
    expect(() => importRotation('hello', catalog)).toThrow('This is not a rotation file: it could not be read.')
    expect(() => importRotation('{"a":1}', catalog)).toThrow('This is not a theWuthering rotation.')
  })

  it("refuses another Resonator's rotation, naming both", () => {
    const text = exportRotation(withExtras, jiyan, catalog)
    expect(() => importRotation(text, catalog, 1402)).toThrow(`This rotation is for Jiyan, not ${catalog.resonators[1402]!.name}.`)
  })

  it('refuses actions the Resonator does not have', () => {
    const bad = { ...withExtras, items: [{ kind: 'step' as const, id: 'z', actionId: 1, enabled: true }] }
    expect(() => importRotation(exportRotation(bad, jiyan, catalog), catalog)).toThrow('1 step uses an action Jiyan does not have.')
  })
})
