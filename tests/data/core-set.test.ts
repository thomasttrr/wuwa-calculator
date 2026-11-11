import { describe, expect, it } from 'vitest'
import { CORE_RESONATORS } from '../../data/authored/core-set'
import { loadCatalog } from '../../scripts/data/load-catalog'

// The core set may only contain Resonators whose every damage value is computable and verified.
// If a data update breaks that, this fails and the Resonator must leave the set (and the report says so).

const catalog = loadCatalog()

describe('core set', () => {
  it('has 12 distinct Resonators', () => {
    expect(new Set(CORE_RESONATORS.map((r) => r.id)).size).toBe(12)
  })

  for (const { id, name } of CORE_RESONATORS) {
    it(`${name} exists under that id and every damage value is modelled and verified`, () => {
      const resonator = catalog.resonators[id]
      expect(resonator?.name).toBe(name)
      const damage = resonator?.actions.filter((action) => action.kind === 'damage') ?? []
      expect(damage.length).toBeGreaterThan(0)
      expect(damage.filter((action) => !action.modelled).map((action) => action.name)).toEqual([])
      expect(damage.filter((action) => !action.provenance.verified).map((action) => action.name)).toEqual([])
    })
  }
})
