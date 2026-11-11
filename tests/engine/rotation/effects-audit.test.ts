import { describe, expect, it } from 'vitest'
import { auditEffects } from '../../../src/engine/rotation/effects-audit'
import type { Build } from '../../../src/engine/types/build'
import type { Catalog, EffectDef } from '../../../src/engine/types/catalog'
import { bareBuild, catalog } from '../fixtures/builds'

// The effects view states which effects touch the current rotation and which do nothing, and why.

const base: Omit<EffectDef, 'id' | 'name' | 'modifiers'> = {
  owner: { kind: 'resonator', id: 1402 },
  target: 'self',
  control: { kind: 'toggle', default: true },
  condition: 'Test effect.',
  provenance: { source: 'authored', sourceId: 'test', verified: true },
}
const effects: EffectDef[] = [
  { ...base, id: 't:basic', name: 'Basic bonus', modifiers: [{ stat: 'dmgBonus', scope: { damageTypes: ['basic'] }, values: [0.1], paramIndex: 0 }] },
  { ...base, id: 't:lib', name: 'Liberation bonus', modifiers: [{ stat: 'dmgBonus', scope: { damageTypes: ['liberation'] }, values: [0.1], paramIndex: 0 }] },
  { ...base, id: 't:heal', name: 'Healing bonus', modifiers: [{ stat: 'healingBonus', values: [0.1], paramIndex: 0 }] },
  { ...base, id: 't:hp', name: 'HP bonus', modifiers: [{ stat: 'hpPct', values: [0.1], paramIndex: 0 }] },
  { ...base, id: 't:off', name: 'Switched off', control: { kind: 'toggle', default: false }, modifiers: [{ stat: 'atkPct', values: [0.1], paramIndex: 0 }] },
]
const testCatalog: Catalog = { ...catalog, effects }

const build: Build = bareBuild(1402, {
  rotation: {
    id: 'r',
    name: 'Basics',
    items: [
      { kind: 'step', id: 'a', actionId: 1402001, enabled: true },
      { kind: 'step', id: 'b', actionId: 1402002, enabled: true },
    ],
  },
})

const audit = auditEffects(build, testCatalog)
const row = (id: string) => {
  const found = audit.find((entry) => entry.effectId === id)
  if (!found) throw new Error(`No audit row for ${id}`)
  return found
}

describe('auditEffects', () => {
  it('lists every effect the build owns', () => {
    expect(audit.map((entry) => entry.effectId).sort()).toEqual(effects.map((effect) => effect.id).sort())
  })

  it('an active effect that changes rotation hits says how many', () => {
    expect(row('t:basic')).toMatchObject({ active: true, touches: true, hitCount: 2, reason: 'Changes 2 hits in this rotation.' })
  })

  it('an effect for hits the rotation does not have says so', () => {
    expect(row('t:lib')).toMatchObject({ touches: false, reason: 'Only affects Resonance Liberation hits, and this rotation has none.' })
  })

  it('an effect on a stat that does not change damage says so', () => {
    expect(row('t:heal')).toMatchObject({ touches: false, reason: 'Raises Healing Bonus, which does not change damage.' })
  })

  it('an effect on a stat no hit scales with says so', () => {
    expect(row('t:hp')).toMatchObject({ touches: false, reason: 'Raises HP, but no hit in this rotation scales with HP.' })
  })

  it('a switched-off effect says so', () => {
    expect(row('t:off')).toMatchObject({ active: false, touches: false, reason: 'Switched off.' })
  })
})
