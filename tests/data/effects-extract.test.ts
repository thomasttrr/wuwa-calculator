import { describe, expect, it } from 'vitest'
import { CORE_RESONATOR_IDS } from '../../data/authored/core-set'
import { extractEffects } from '../../scripts/data/extract-effects'
import { loadCatalog } from '../../scripts/data/load-catalog'
import type { EffectDef } from '../../src/engine/types/catalog'

// The effect reader turns game descriptions into effects. It may only encode a sentence it
// fully understands; everything else is reported as not modelled. Spot checks below use
// descriptions copied from data/game/3.8.0 (weapons.json, sonatas.json).

const catalog = loadCatalog()
const { effects, unparsed } = extractEffects(catalog, { coreResonatorIds: [1402, 1503] })

const ofOwner = (kind: string, id: number, pieces?: number): EffectDef[] =>
  effects.filter(
    (e) => e.owner.kind === kind && e.owner.id === id && (pieces === undefined || (e.owner.kind === 'sonata' && e.owner.pieces === pieces)),
  )
const weaponId = (name: string) => Object.values(catalog.weapons).find((w) => w.name === name)?.id ?? -1
const sonataId = (name: string) => Object.values(catalog.sonatas).find((s) => s.name === name)?.id ?? -1

describe('effect reader: weapons', () => {
  it('Lustrous Razor: always-on Energy Regen, then a stacking Liberation bonus switched by its condition', () => {
    // "Increases Energy Regen by 12.8%/16%/19.2%/22.4%/25.6%. When Resonance Skill is cast, Resonance
    //  Liberation DMG Bonus is increased by 7%/8.75%/10.5%/12.25%/14%, stacking up to 3/3/3/3/3 times."
    const [first, second] = ofOwner('weapon', weaponId('Lustrous Razor'))
    expect(first).toMatchObject({ target: 'self', control: { kind: 'always' } })
    expect(first?.modifiers).toEqual([{ stat: 'energyRegen', values: [0.128, 0.16, 0.192, 0.224, 0.256], paramIndex: 0 }])
    expect(second?.control).toMatchObject({ kind: 'stacks', max: 3, default: 0 })
    expect(second?.modifiers).toEqual([
      { stat: 'dmgBonus', scope: { damageTypes: ['liberation'] }, values: [0.07, 0.0875, 0.105, 0.1225, 0.14], perStack: true, paramIndex: 1 },
    ])
    expect(second?.condition).toMatch(/^When Resonance Skill is cast/)
  })

  it('"Attribute DMG Bonus" means every element except Physical', () => {
    const [first] = ofOwner('weapon', weaponId('Verdant Summit'))
    expect(first?.modifiers[0]?.scope?.elements?.slice().sort()).toEqual(['aero', 'electro', 'fusion', 'glacio', 'havoc', 'spectro'])
  })

  it('a buff given "to all Resonators in the team" is team-wide', () => {
    const wildfire = ofOwner('weapon', weaponId('Wildfire Mark'))
    expect(wildfire.some((e) => e.target === 'team' && e.modifiers.some((m) => m.scope?.elements?.[0] === 'fusion'))).toBe(true)
  })

  it('a sentence with no buff it can read is reported, not guessed', () => {
    expect(ofOwner('weapon', weaponId('Discord'))).toEqual([])
    expect(unparsed.some((line) => line.owner.startsWith('Discord') && line.sentence.includes('Concerto Energy'))).toBe(true)
  })

  it('reads "X of all nearby Resonators in the team by N" as a team buff', () => {
    // Starfield Calibrator: "...increases Crit. DMG of all nearby Resonators in the team by 20%/25%/30%/35%/40% for 4/4/4/4/4s."
    const effect = ofOwner('weapon', weaponId('Starfield Calibrator')).find((e) => e.modifiers.some((m) => m.stat === 'critDmg'))
    expect(effect).toMatchObject({ target: 'team', control: { kind: 'toggle' } })
    expect(effect?.modifiers[0]?.values).toEqual([0.2, 0.25, 0.3, 0.35, 0.4])
  })

  it('reads "gives N additional X Bonus for up to K stacks" as stacks', () => {
    // Blazing Brilliance: "Each stack of Searing Feather gives 4%/5%/6%/7%/8% additional Resonance Skill DMG Bonus for up to 14 stacks."
    const effect = ofOwner('weapon', weaponId('Blazing Brilliance')).find((e) => e.control.kind === 'stacks')
    expect(effect?.control).toMatchObject({ kind: 'stacks', max: 14 })
    expect(effect?.modifiers[0]).toMatchObject({ stat: 'dmgBonus', scope: { damageTypes: ['skill'] }, perStack: true })
  })

  it('reads "Heavy Attack DMG ignores N of the target\'s DEF" as DEF ignore for Heavy Attacks', () => {
    const effect = ofOwner('weapon', weaponId('Thousandfold Deliverance')).find((e) => e.modifiers.some((m) => m.stat === 'defIgnore'))
    expect(effect?.modifiers.find((m) => m.stat === 'defIgnore')?.scope).toEqual({ damageTypes: ['heavy'] })
  })

  it('a bonus that lasts "for 30/30/30/30/30s" is a switch, not always on', () => {
    // Wildfire Mark: "Each successful extension gives 24%/... Fusion DMG Bonus to all Resonators in the team for 30/30/30/30/30s."
    const fusion = ofOwner('weapon', weaponId('Wildfire Mark')).find((e) => e.modifiers.some((m) => m.scope?.elements?.[0] === 'fusion'))
    expect(fusion?.control.kind).toBe('toggle')
  })

  it('"X is increased by N, up to M" stacks to M / N', () => {
    // Thousandfold Deliverance: "Nature's Order: Crit. DMG is increased by 4%/5%/6%/7%/8%, up to 24%/30%/36%/42%/48%."
    const critDmg = ofOwner('weapon', weaponId('Thousandfold Deliverance')).find((e) => e.modifiers.some((m) => m.stat === 'critDmg'))
    expect(critDmg?.control).toMatchObject({ kind: 'stacks', max: 6 })
    expect(critDmg?.modifiers[0]).toMatchObject({ values: [0.04, 0.05, 0.06, 0.07, 0.08], perStack: true })
  })

  it('"the Crit. Rate of Heavy Attack DMG" applies to Heavy Attacks only', () => {
    const critRate = ofOwner('weapon', weaponId('Thousandfold Deliverance')).find((e) => e.modifiers.some((m) => m.stat === 'critRate'))
    expect(critRate?.modifiers[0]?.scope).toEqual({ damageTypes: ['heavy'] })
  })

  it('every always-on effect keeps the sentence it was read from', () => {
    for (const effect of effects.filter((e) => e.control.kind === 'always')) {
      expect(effect.provenance.note, effect.id).toMatch(/^From: /)
    }
  })

  it('leaves hand-encoded weapons alone', () => {
    expect(ofOwner('weapon', 21010074)).toEqual([])
  })
})

describe('effect reader: Sonata sets', () => {
  it('Lingering Tunes 5 pieces: ATK stacking to 4 (stated in the next sentence) and an always-on Outro bonus', () => {
    // "While on the field, ATK increases by 5% every 1.5s. This effect stacks up to 4 times. Outro Skill DMG + 60%."
    const set = ofOwner('sonata', sonataId('Lingering Tunes'), 5)
    const atk = set.find((e) => e.modifiers.some((m) => m.stat === 'atkPct'))
    expect(atk?.control).toMatchObject({ kind: 'stacks', max: 4 })
    expect(atk?.modifiers[0]).toMatchObject({ values: [0.05], perStack: true })
    const outro = set.find((e) => e.modifiers.some((m) => m.scope?.damageTypes?.[0] === 'outro'))
    expect(outro).toMatchObject({ control: { kind: 'always' } })
    expect(outro?.modifiers[0]?.values).toEqual([0.6])
  })

  it('Midnight Veil 5 pieces: the bonus for "the incoming Resonator" goes to the next Resonator', () => {
    const set = ofOwner('sonata', sonataId('Midnight Veil'), 5)
    expect(set.find((e) => e.target === 'nextResonator')?.modifiers).toEqual([
      expect.objectContaining({ stat: 'dmgBonus', scope: { elements: ['havoc'] }, values: [0.15] }),
    ])
  })

  it('never encodes a set piece whose bonus already arrives as structured data (it would count twice)', () => {
    for (const sonata of Object.values(catalog.sonatas)) {
      for (const piece of sonata.effects) {
        if (piece.fixed.length === 0) continue
        expect(ofOwner('sonata', sonata.id, piece.pieces), `${sonata.name} ${piece.pieces}`).toEqual([])
      }
    }
  })
})

describe('effect reader: Echoes', () => {
  it('reads both halves of "increase X by N and Y by M"', () => {
    // Tempest Mephis: "After the claw hit, increase the current character's Electro DMG by 12.00% and Heavy Attack DMG by 12.00% for 15s."
    const id = Object.values(catalog.echoes).find((e) => e.name === 'Tempest Mephis')?.id ?? -1
    const [effect] = ofOwner('echo', id)
    expect(effect?.modifiers.map((m) => m.scope)).toEqual([{ elements: ['electro'] }, { damageTypes: ['heavy'] }])
  })
})

describe('effect reader: things it must not misread', () => {
  const all = extractEffects(catalog, { coreResonatorIds: CORE_RESONATOR_IDS }).effects
  const fromSentence = (text: string) => all.filter((e) => e.provenance.note?.includes(text))
  const anySentence = (text: string) =>
    Object.values(catalog.resonators).some((r) => r.sequences.some((s) => s.description.includes(text)) || r.skills.some((s) => s.description.includes(text)))

  it('the misread sentences below really exist in the core set data', () => {
    expect(anySentence('Radiance of Fealty DMG is increased')).toBe(true)
    expect(anySentence('Crit. DMG of Forte Circuit Ice Burst')).toBe(true)
  })

  it('reads both halves of "gains N X Bonus and M Y Bonus"', () => {
    const effect = all.find((e) => e.owner.kind === 'echo' && /Havoc DMG Bonus and 12.00% Basic Attack DMG Bonus/.test(e.provenance.note ?? ''))
    expect(effect?.modifiers.map((m) => m.scope)).toEqual([{ elements: ['havoc'] }, { damageTypes: ['basic'] }])
  })

  it('a negative-status amplification is not read as an element bonus', () => {
    // Phoebe Outro: "...reducing the Spectro RES of nearby targets by 10% and granting 100% Spectro Frazzle DMG Amplification."
    const phoebe = all.filter((e) => e.owner.kind === 'resonator' && e.owner.id === 1506)
    expect(phoebe.flatMap((e) => e.modifiers).some((m) => m.values[0] === 1)).toBe(false)
    const res = phoebe.flatMap((e) => e.modifiers).find((m) => m.stat === 'resReduction')
    expect(res).toMatchObject({ scope: { elements: ['spectro'] }, values: [0.1] })
  })

  it('a bonus to one named skill is not read as a bonus to every hit', () => {
    expect(fromSentence('Radiance of Fealty DMG is increased')).toEqual([])
    expect(fromSentence('Crit. DMG of Forte Circuit Ice Burst')).toEqual([])
  })

  it('"With N times:" and "Gaining N stacks" are conditions', () => {
    for (const effect of all.filter((e) => /^From: (With [\d/]+ times:|Gaining )/.test(e.provenance.note ?? ''))) {
      expect(effect.control.kind, effect.id).not.toBe('always')
    }
  })

  it('a Resonator effect is always on only when its whole sentence is a plain stat increase', () => {
    for (const effect of all.filter((e) => e.owner.kind === 'resonator' && e.control.kind === 'always')) {
      expect(effect.provenance.note, effect.id).toMatch(/^From: [\w .']+ (?:is|are) increased by \d+(?:\.\d+)?%\.$/)
    }
  })

  it('"party members" are the team', () => {
    const stellarealm = fromSentence('increases the ATK of all nearby party members')
    expect(stellarealm.map((e) => e.target)).toEqual(['team'])
  })
})

describe('effect reader: Resonators', () => {
  it('reads Sequence nodes only for the core Resonators asked for', () => {
    const owners = new Set(effects.filter((e) => e.owner.kind === 'resonator').map((e) => e.owner.id))
    for (const id of owners) expect([1402, 1503]).toContain(id)
  })

  it("Yangyang's first Sequence: Aero DMG Bonus +15% after the Intro Skill, from the node's own parameters", () => {
    const s1 = effects.find((e) => e.owner.kind === 'resonator' && e.owner.id === 1402 && e.owner.sequence === 1)
    expect(s1?.modifiers).toEqual([{ stat: 'dmgBonus', scope: { elements: ['aero'] }, values: [0.15], paramIndex: 0 }])
    expect(s1?.control.kind).toBe('toggle')
  })
})

describe('effect reader: output shape', () => {
  it('every effect id is unique and every effect has at least one modifier', () => {
    const ids = effects.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const effect of effects) expect(effect.modifiers.length, effect.id).toBeGreaterThan(0)
  })
})
