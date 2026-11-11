import { describe, expect, it } from 'vitest'
import { computeAction } from '../../../src/engine/rotation/action'
import { allTraceNodeIds, bareBuild, catalog, echo, echoIdIn, enemy, maxSkills } from '../fixtures/builds'

// HAND-CHECKED CASE 1: Yangyang (id 1402), the plain ATK path.
//
// Formula: Wuthering Waves Wiki (Fandom, CC-BY-SA), "Damage".
//   DMG = Stat x MV x (1 + DMG Bonus) x DEF mult x RES mult;  crit multiplies by Crit. DMG
//   DEF mult = (800 + 8 x Lv) / (800 + 8 x Lv + 8 x enemy Lv + 792);  RES mult = 1 - RES
// Inputs: data/snapshots/encore/3.8.0/character/1402.json and .../weapons.json
//   Properties[ATK].GrowthValues[level 90].value              = 250
//   Properties[Crit. Rate].BaseValue = 500 (5%), [Crit. DMG].BaseValue = 15000 (150%)
//   Skills[1000101].SkillAttributes[1402001] "Stage 1 DMG"     level 1 = 22.50%, level 10 = 44.73%
//     matched to DamageList row 1402001001: Type "Basic Attack", element 4 (Aero), scales on ATK
//   SkillTree: ATK +1.80%, +4.20%, +4.20%, +1.80% (= 12%); Aero DMG Bonus +1.80%, +4.20%, +4.20%, +1.80% (= 12%)
//   Weapon 21020044 "Commando of Conviction": level 90 ATK 412.50, secondary ATK 30.38%,
//     passive parameter 0 at rank 1 = "15%" (ATK, after Intro Skill)
// The arithmetic below was done by hand, independently of the engine.

const YANGYANG = 1402
const STAGE_1 = 1402001
const COMMANDO = 21020044

describe('hand-checked: Yangyang, Basic Attack Stage 1', () => {
  it('bare: level 90, no weapon, skill level 1, level 90 target with 10% Aero RES', () => {
    // base     = 250 x 0.225                     = 56.25
    // RES      = x 0.9                           = 50.625
    // DEF      = x 1520 / (1520 + 1512)          = 50.625 x 1520 / 3032 = 76950 / 3032
    // non-crit                                   = 25.379288...
    // crit     = x 1.5                           = 38.068931...
    // average  = x (1 + 0.05 x 0.5) = x 1.025    = 26.013770...
    const result = computeAction(bareBuild(YANGYANG), catalog, STAGE_1)
    expect(result.nonCrit).toBeCloseTo(76950 / 3032, 9)
    expect(result.nonCrit).toBeCloseTo(25.3793, 4)
    expect(result.crit).toBeCloseTo(38.0689, 4)
    expect(result.average).toBeCloseTo(26.0138, 4)
    expect(result.hasUnverified).toBe(false)
  })

  it('with weapon and skill tree: skill level 10', () => {
    // base ATK = 250 + 412.5                     = 662.5
    // ATK%     = 0.12 (tree) + 0.3038 (weapon)   = 0.4238
    // ATK      = 662.5 x 1.4238                  = 943.2675
    // base     = 943.2675 x 0.4473               = 421.92355275
    // bonus    = x (1 + 0.12 Aero)               = 472.55437908
    // RES      = x 0.9                           = 425.298941172
    // DEF      = x 1520 / 3032                   = 213.210551...
    // crit     = x 1.5                           = 319.815826...
    // average  = x 1.025                         = 218.540815...
    const build = bareBuild(YANGYANG, {
      resonator: { ...bareBuild(YANGYANG).resonator, skillLevels: maxSkills, traceNodeIds: allTraceNodeIds(YANGYANG) },
      weapon: { id: COMMANDO, level: 90, ascended: false, rank: 1 },
    })
    const result = computeAction(build, catalog, STAGE_1)
    expect(result.parts[0]?.sheet.atk.total).toBeCloseTo(943.2675, 6)
    expect(result.nonCrit).toBeCloseTo((425.298941172 * 1520) / 3032, 6)
    expect(result.nonCrit).toBeCloseTo(213.2106, 3)
    expect(result.crit).toBeCloseTo(319.8158, 3)
    expect(result.average).toBeCloseTo(218.5408, 3)
  })

  it('with weapon, skill tree, one Echo and the weapon passive switched on', () => {
    // Echo: 4-cost, main Crit. Rate 22%, fixed ATK 150, substats Crit. DMG 21% and ATK 11.6%
    //   (legal values: echo-stat-tables.json mainStats[4], fixedStats[4], substats rolls)
    // ATK%     = 0.12 + 0.3038 + 0.116 + 0.15 (passive)  = 0.6898
    // ATK      = 662.5 x 1.6898 + 150                    = 1269.4925
    // base     = 1269.4925 x 0.4473                      = 567.84399525
    // bonus    = x 1.12                                  = 635.98527468
    // RES      = x 0.9                                   = 572.386747212
    // DEF      = x 1520 / 3032                           = 286.948501...
    // Crit. Rate = 0.05 + 0.22 = 0.27;  Crit. DMG = 1.5 + 0.21 = 1.71
    // crit     = x 1.71                                  = 490.681937...
    // average  = x (1 + 0.27 x 0.71) = x 1.1917          = 341.956529...
    const { echoId, sonataId } = echoIdIn('Sierra Gale', 4)
    const build = bareBuild(YANGYANG, {
      resonator: { ...bareBuild(YANGYANG).resonator, skillLevels: maxSkills, traceNodeIds: allTraceNodeIds(YANGYANG) },
      weapon: { id: COMMANDO, level: 90, ascended: false, rank: 1 },
      echoes: [
        echo({
          echoId,
          sonataId,
          cost: 4,
          mainStat: { stat: 'critRate', value: 0.22 },
          substats: [
            { stat: 'critDmg', value: 0.21 },
            { stat: 'atkPct', value: 0.116 },
          ],
        }),
        null,
        null,
        null,
        null,
      ],
      effects: { 'weapon:21020044:unyielding': { on: true } },
    })
    const result = computeAction(build, catalog, STAGE_1)
    expect(result.parts[0]?.sheet.atk.total).toBeCloseTo(1269.4925, 6)
    expect(result.nonCrit).toBeCloseTo((572.386747212 * 1520) / 3032, 6)
    expect(result.nonCrit).toBeCloseTo(286.9485, 3)
    expect(result.crit).toBeCloseTo(490.6819, 3)
    expect(result.average).toBeCloseTo(341.9565, 3)
  })

  it('a different enemy level changes only the defence term', () => {
    // level 100 target: DEF mult = 1520 / (1520 + 1592) = 1520 / 3112; 50.625 x 1520 / 3112
    const result = computeAction(bareBuild(YANGYANG, { enemy: enemy(100) }), catalog, STAGE_1)
    expect(result.nonCrit).toBeCloseTo(76950 / 3112, 9)
  })
})
