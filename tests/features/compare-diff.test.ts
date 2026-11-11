import { describe, expect, it } from 'vitest'
import { setupDifferences } from '../../src/features/compare/diff'
import { createSampleBuild } from '../../src/data/sample-build'
import type { Build } from '../../src/engine/types/build'
import { catalog } from '../engine/fixtures/builds'

const a = createSampleBuild(catalog)

describe('setupDifferences', () => {
  it('two builds that differ only in Echo stats have the same setup', () => {
    const b: Build = { ...a, id: 'b', name: 'Other', echoes: a.echoes.map((e) => (e ? { ...e, substats: [] } : null)) }
    expect(setupDifferences(a, b, catalog)).toEqual([])
  })

  it('names each kind of difference in plain words', () => {
    const b: Build = {
      ...a,
      enemy: { ...a.enemy, level: 90 },
      teammates: [null, null],
      weapon: a.weapon ? { ...a.weapon, rank: 5 } : null,
      rotation: { ...a.rotation, items: a.rotation.items.slice(1) },
    }
    expect(setupDifferences(a, b, catalog)).toEqual([
      'Different weapon or refinement: Verdant Summit rank 1, and Verdant Summit rank 5.',
      'Different team.',
      'Different target: Level 100 target at level 100, and Level 100 target at level 90.',
      'Different rotation.',
    ])
  })

  it('different Resonators are called out first', () => {
    const b: Build = { ...a, resonator: { ...a.resonator, id: 1402 } }
    expect(setupDifferences(a, b, catalog)[0]).toBe('Different Resonators: Jiyan, and Yangyang.')
  })

  it('switched effects and different Echoes or sets count as setup differences', () => {
    const b: Build = { ...a, effects: {}, echoes: [null, ...a.echoes.slice(1)] }
    const lines = setupDifferences(a, b, catalog)
    expect(lines).toContain('Different Echoes or Sonata sets.')
    expect(lines).toContain('Different effects switched on.')
  })
})
