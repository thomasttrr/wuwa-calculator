import { describe, expect, it } from 'vitest'
import { computeAction } from '../../../src/engine/rotation/action'
import { allTraceNodeIds, bareBuild, catalog, enemy, maxSkills } from '../fixtures/builds'

// HAND-CHECKED CASE 2: Taoqi (id 1601), a hit that scales on DEF instead of ATK.
//
// Formula: Wuthering Waves Wiki (Fandom, CC-BY-SA), "Damage" ("Abilities scale with ATK unless
// specifically mentioned in skill attributes").
// Inputs: data/snapshots/encore/3.8.0/character/1601.json and .../weapons.json
//   Properties[DEF].GrowthValues[level 90].value                 = 1564.4416
//   Resonance Skill "Skill DMG" (attribute 6500015)               level 1 = 67.86%, level 10 = 134.92%
//     matched to DamageList row 1601030001: Type "Resonance Skill", element 6 (Havoc), scales on DEF
//   SkillTree: DEF +2.28%, +2.28%, +5.32%, +5.32% (= 15.2%); Havoc DMG Bonus +1.8%, +1.8%, +4.2%, +4.2% (= 12%)
//   Weapon 21010074 "Autumntrace": level 90 ATK 412.50, secondary Crit. Rate 20.25%
// The arithmetic below was done by hand, independently of the engine.

const TAOQI = 1601
const SKILL_DMG = 6500015
const AUTUMNTRACE = 21010074

describe('hand-checked: Taoqi, Resonance Skill (scales on DEF)', () => {
  it('bare: level 90, no weapon, skill level 1, level 90 target with 10% Havoc RES', () => {
    // base     = 1564.4416 x 0.6786              = 1061.63006976
    // RES      = x 0.9                           = 955.467062784
    // DEF mult = x 1520 / 3032                   = 478.994042...
    // average  = x 1.025                         = 490.968893...
    const result = computeAction(bareBuild(TAOQI), catalog, SKILL_DMG)
    expect(result.parts[0]?.formula.scalingStat).toBe('def')
    expect(result.nonCrit).toBeCloseTo((955.467062784 * 1520) / 3032, 6)
    expect(result.nonCrit).toBeCloseTo(478.994, 3)
    expect(result.average).toBeCloseTo(490.9689, 3)
  })

  it('with skill tree and weapon: skill level 10, level 100 target', () => {
    // DEF      = 1564.4416 x (1 + 0.152)         = 1802.2367232
    // base     = 1802.2367232 x 1.3492           = 2431.57778694...
    // bonus    = x (1 + 0.12 Havoc)              = 2723.36712137...
    // RES      = x 0.9                           = 2451.03040924...
    // DEF mult = x 1520 / (1520 + 1592)          = 1197.161382...
    // Crit. Rate = 0.05 + 0.2025 = 0.2525;  Crit. DMG = 1.5
    // crit     = x 1.5                           = 1795.742073...
    // average  = x (1 + 0.2525 x 0.5) = x 1.12625 = 1348.303007...
    const build = bareBuild(TAOQI, {
      resonator: { ...bareBuild(TAOQI).resonator, skillLevels: maxSkills, traceNodeIds: allTraceNodeIds(TAOQI) },
      weapon: { id: AUTUMNTRACE, level: 90, ascended: false, rank: 1 },
      enemy: enemy(100),
    })
    const result = computeAction(build, catalog, SKILL_DMG)
    expect(result.parts[0]?.sheet.def.total).toBeCloseTo(1802.2367232, 6)
    expect(result.nonCrit).toBeCloseTo((1564.4416 * 1.152 * 1.3492 * 1.12 * 0.9 * 1520) / 3112, 6)
    expect(result.nonCrit).toBeCloseTo(1197.1614, 3)
    expect(result.crit).toBeCloseTo(1795.7421, 3)
    expect(result.average).toBeCloseTo(1348.303, 3)
  })

  it('ATK from the weapon does not change a DEF-scaling hit', () => {
    const without = computeAction(bareBuild(TAOQI), catalog, SKILL_DMG)
    const withWeapon = computeAction(
      bareBuild(TAOQI, { weapon: { id: AUTUMNTRACE, level: 90, ascended: false, rank: 1 } }),
      catalog,
      SKILL_DMG,
    )
    expect(withWeapon.nonCrit).toBeCloseTo(without.nonCrit, 9)
  })
})
