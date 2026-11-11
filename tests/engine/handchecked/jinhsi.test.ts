import { describe, expect, it } from 'vitest'
import { computeAction } from '../../../src/engine/rotation/action'
import { allTraceNodeIds, bareBuild, catalog, echo, echoIdIn, enemy, maxSkills } from '../fixtures/builds'

// HAND-CHECKED CASE 3: Jinhsi (id 1304): a two-part hit with element and attack-type bonuses,
// a 2-piece set bonus, and a stacking weapon passive.
//
// Formula: Wuthering Waves Wiki (Fandom, CC-BY-SA), "Damage".
// Inputs: data/snapshots/encore/3.8.0/character/1304.json, .../weapons.json, and
//         data/game/3.8.0/echo-stat-tables.json, sonatas.json
//   Properties[ATK].GrowthValues[level 90].value                    = 412.5
//   Resonance Liberation "Skill DMG" (attribute 1304016)             level 1  = 251.40% + 586.60%
//                                                                    level 10 = 499.81% + 1166.22%
//     matched to DamageList rows 1304300001 and 1304300003: Type "Resonance Liberation", element 5 (Spectro), ATK
//   SkillTree: Crit. Rate +1.2%, +1.2%, +2.8%, +2.8% (= 8%); ATK +1.8%, +1.8%, +4.2%, +4.2% (= 12%)
//   Weapon 21010074 "Autumntrace": level 90 ATK 412.50, secondary Crit. Rate 20.25%;
//     passive parameter 0 at rank 1 = "4%" ATK per stack, parameter 1 = "5" stacks at most
//   Echo tables: 3-cost main Spectro DMG Bonus 30%, fixed ATK 100; 1-cost main ATK 18%, fixed HP 2280;
//     substat rolls: Resonance Liberation DMG Bonus 11.6%, Crit. DMG 21%
//   Sonata "Celestial Light" 2 pieces: Spectro DMG + 10% (structured stat id 26, value 1000)
// The arithmetic below was done by hand, independently of the engine.

const JINHSI = 1304
const LIBERATION = 1304016
const AUTUMNTRACE = 21010074

describe('hand-checked: Jinhsi, Resonance Liberation', () => {
  it('bare: level 90, no weapon, skill level 1, level 90 target with 10% Spectro RES', () => {
    // multiplier = 2.514 + 5.866                 = 8.38
    // base       = 412.5 x 8.38                  = 3456.75
    // RES        = x 0.9                         = 3111.075
    // DEF        = x 1520 / 3032                 = 1559.641820...
    // average    = x 1.025                       = 1598.632866...
    const result = computeAction(bareBuild(JINHSI), catalog, LIBERATION)
    expect(result.parts).toHaveLength(2)
    expect(result.nonCrit).toBeCloseTo((3111.075 * 1520) / 3032, 6)
    expect(result.nonCrit).toBeCloseTo(1559.6418, 3)
    expect(result.average).toBeCloseTo(1598.6329, 3)
  })

  it('full: skill tree, weapon with 5 passive stacks, two Echoes with a 2-piece set, level 100 target', () => {
    // base ATK  = 412.5 + 412.5                                = 825
    // ATK%      = 0.12 (tree) + 5 x 0.04 (passive) + 0.18 (1-cost main) = 0.50
    // ATK       = 825 x 1.5 + 100 (3-cost fixed)               = 1337.5
    // multiplier = 4.9981 + 11.6622                            = 16.6603
    // base      = 1337.5 x 16.6603                             = 22283.15125
    // bonus     = 1 + 0.30 (Spectro main) + 0.10 (2-piece) + 0.116 (Liberation substat) = 1.516
    //           -> 22283.15125 x 1.516                         = 33781.257295
    // RES       = x 0.9                                        = 30403.1315655
    // DEF       = x 1520 / 3112                                = 14849.858605...
    // Crit. Rate = 0.05 + 0.08 (tree) + 0.2025 (weapon)        = 0.3325
    // Crit. DMG  = 1.5 + 0.21 (substat)                        = 1.71
    // crit      = x 1.71                                       = 25393.258215...
    // average   = x (1 + 0.3325 x 0.71) = x 1.236075           = 18355.538975...
    const three = echoIdIn('Celestial Light', 3)
    const one = echoIdIn('Celestial Light', 1)
    const build = bareBuild(JINHSI, {
      resonator: { ...bareBuild(JINHSI).resonator, skillLevels: maxSkills, traceNodeIds: allTraceNodeIds(JINHSI) },
      weapon: { id: AUTUMNTRACE, level: 90, ascended: false, rank: 1 },
      echoes: [
        echo({
          ...three,
          cost: 3,
          mainStat: { stat: 'dmgBonus', scope: { elements: ['spectro'] }, value: 0.3 },
          substats: [
            { stat: 'dmgBonus', scope: { damageTypes: ['liberation'] }, value: 0.116 },
            { stat: 'critDmg', value: 0.21 },
          ],
        }),
        echo({ ...one, cost: 1, mainStat: { stat: 'atkPct', value: 0.18 }, substats: [] }),
        null,
        null,
        null,
      ],
      effects: { 'weapon:21010074:edge-direction': { on: true, stacks: 5 } },
      enemy: enemy(100),
    })
    const result = computeAction(build, catalog, LIBERATION)
    const sheet = result.parts[0]?.sheet
    expect(sheet?.atk.total).toBeCloseTo(1337.5, 6)
    expect(sheet?.dmgBonus.total).toBeCloseTo(0.516, 9)
    expect(sheet?.critRate.total).toBeCloseTo(0.3325, 9)
    expect(sheet?.critDmg.total).toBeCloseTo(1.71, 9)
    expect(result.nonCrit).toBeCloseTo((30403.1315655 * 1520) / 3112, 5)
    expect(result.nonCrit).toBeCloseTo(14849.8586, 3)
    expect(result.crit).toBeCloseTo(25393.2582, 3)
    expect(result.average).toBeCloseTo(18355.539, 2)
  })

  it('the set bonus needs two different Echoes of the set', () => {
    const three = echoIdIn('Celestial Light', 3)
    const single = bareBuild(JINHSI, {
      echoes: [echo({ ...three, cost: 3, mainStat: { stat: 'atkPct', value: 0.3 }, substats: [] }), null, null, null, null],
    })
    const doubled = bareBuild(JINHSI, {
      echoes: [
        echo({ ...three, cost: 3, mainStat: { stat: 'atkPct', value: 0.3 }, substats: [] }),
        echo({ ...three, cost: 3, mainStat: { stat: 'atkPct', value: 0.3 }, substats: [] }),
        null,
        null,
        null,
      ],
    })
    expect(computeAction(single, catalog, LIBERATION).parts[0]?.sheet.dmgBonus.total).toBe(0)
    // The same Echo twice counts once towards a set.
    expect(computeAction(doubled, catalog, LIBERATION).parts[0]?.sheet.dmgBonus.total).toBe(0)
  })

  it('passive stacks are capped at the limit the weapon states', () => {
    const at = (stacks: number) =>
      computeAction(
        bareBuild(JINHSI, {
          weapon: { id: AUTUMNTRACE, level: 90, ascended: false, rank: 1 },
          effects: { 'weapon:21010074:edge-direction': { on: true, stacks } },
        }),
        catalog,
        LIBERATION,
      ).parts[0]?.sheet.atk.percent.total
    expect(at(5)).toBeCloseTo(0.2, 9)
    expect(at(9)).toBeCloseTo(0.2, 9)
    expect(at(0)).toBe(0)
  })
})
