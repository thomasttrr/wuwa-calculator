import { describe, expect, it } from 'vitest'
import { computeAction } from '../../../src/engine/rotation/action'
import { collectModifiers, teammateEffectKey } from '../../../src/engine/stats/collect'
import type { Build } from '../../../src/engine/types/build'
import type { Catalog, EffectDef } from '../../../src/engine/types/catalog'
import { bareBuild, catalog } from '../fixtures/builds'

// Teammates are modelled as buff providers. These effects are test-only stand-ins; the real
// ones are authored with provenance in data/authored.

const VERINA = 1503
const team: EffectDef = {
  id: 'test:verina:team-atk',
  owner: { kind: 'resonator', id: VERINA },
  name: 'Team ATK',
  target: 'team',
  control: { kind: 'toggle', default: true },
  modifiers: [{ stat: 'atkPct', values: [0.2], paramIndex: 0 }],
  condition: 'Test effect.',
  provenance: { source: 'authored', sourceId: 'test', verified: true },
}
const outro: EffectDef = {
  ...team,
  id: 'test:verina:outro',
  name: 'Outro amplify',
  target: 'nextResonator',
  control: { kind: 'toggle', default: false },
  modifiers: [{ stat: 'amplify', values: [0.15], paramIndex: 0 }],
}
const seqOnly: EffectDef = { ...team, id: 'test:verina:s2', name: 'Sequence 2', owner: { kind: 'resonator', id: VERINA, sequence: 2 } }
const selfOnly: EffectDef = { ...team, id: 'test:verina:self', name: 'Self only', target: 'self' }

const testCatalog: Catalog = { ...catalog, effects: [...catalog.effects, team, outro, seqOnly, selfOnly] }

const withTeammate = (sequence: number, effects: Build['effects'] = {}): Build =>
  bareBuild(1402, { teammates: [{ resonatorId: VERINA, sequence, sonatas: [] }, null], effects })

const names = (build: Build) => collectModifiers(build, testCatalog).map((m) => m.source.name)

describe('teammate buffs', () => {
  it("a teammate's team-wide effect reaches the active Resonator, named after the teammate", () => {
    expect(names(withTeammate(0))).toContain('Verina: Team ATK')
    expect(collectModifiers(withTeammate(0), testCatalog).find((m) => m.source.name === 'Verina: Team ATK')?.source.kind).toBe('teammate')
  })

  it("a teammate's self-only effect does not", () => {
    expect(names(withTeammate(0))).not.toContain('Verina: Self only')
  })

  it("a teammate's Sequence effect needs that Sequence", () => {
    expect(names(withTeammate(1))).not.toContain('Verina: Sequence 2')
    expect(names(withTeammate(2))).toContain('Verina: Sequence 2')
  })

  it('an Outro effect is off until switched on, keyed by teammate slot', () => {
    expect(names(withTeammate(0))).not.toContain('Verina: Outro amplify')
    const on = withTeammate(0, { [teammateEffectKey(0, outro.id)]: { on: true } })
    expect(names(on)).toContain('Verina: Outro amplify')
  })

  it('the buff changes damage by exactly its value', () => {
    const solo = computeAction(bareBuild(1402), testCatalog, 1402001)
    const buffed = computeAction(withTeammate(0, { [teammateEffectKey(0, outro.id)]: { on: true } }), testCatalog, 1402001)
    // ATK +20% (no other ATK bonus) and Amplify +15%: 1.2 x 1.15
    expect(buffed.nonCrit / solo.nonCrit).toBeCloseTo(1.2 * 1.15, 9)
  })

  it("the build's own 'next Resonator' effects do not apply to itself", () => {
    const own = bareBuild(VERINA, { effects: { [outro.id]: { on: true } } })
    expect(collectModifiers(own, testCatalog).map((m) => m.source.name)).not.toContain('Outro amplify')
  })
})
