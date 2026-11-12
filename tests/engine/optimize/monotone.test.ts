import { describe, expect, it } from 'vitest'
import { catalog } from '../fixtures/builds'

// The optimizer's bound assumes that adding an Echo, or another set bonus, never lowers damage
// or the stats it limits. That holds only if no set or Echo effect has a negative value.
// If this fails, the named effect breaks the bound: the optimizer must treat it exactly.

describe('optimizer bound: set and Echo effects only ever add', () => {
  it('every set bonus stored as data is zero or more', () => {
    const negative = Object.values(catalog.sonatas).flatMap((s) =>
      s.effects.flatMap((e) => e.fixed.filter((m) => m.value < 0).map((m) => `${s.name} ${e.pieces}: ${m.stat} ${m.value}`)),
    )
    expect(negative).toEqual([])
  })

  it('every encoded set and Echo effect is zero or more', () => {
    const negative = catalog.effects
      .filter((e) => e.owner.kind === 'sonata' || e.owner.kind === 'echo')
      .flatMap((e) => e.modifiers.filter((m) => m.values.some((v) => v < 0)).map((m) => `${e.name}: ${m.stat} ${m.values.join('/')}`))
    expect(negative).toEqual([])
  })
})
