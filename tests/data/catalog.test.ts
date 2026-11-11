import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadCatalog, loadManifest } from '../../scripts/data/load-catalog'
import {
  echoSchema,
  echoStatTablesSchema,
  enemySchema,
  manifestSchema,
  resonatorSchema,
  sonataSchema,
  weaponSchema,
} from '../../src/data/schema'

const manifest = loadManifest()
const catalog = loadCatalog()
const report = JSON.parse(
  readFileSync(new URL(`../../data/game/${manifest.gameVersion}/crosscheck-report.json`, import.meta.url), 'utf8'),
) as { summary: Record<string, Record<string, number>>; mismatches: string[] }

describe('catalog files match their schemas', () => {
  it('manifest', () => {
    expect(() => manifestSchema.parse(manifest)).not.toThrow()
    expect(manifest.warnings).toEqual([])
  })

  it('every Resonator', () => {
    for (const resonator of Object.values(catalog.resonators)) {
      const result = resonatorSchema.safeParse(resonator)
      expect(result.success, `${resonator.name}: ${result.error?.issues[0]?.path.join('.')} ${result.error?.issues[0]?.message}`).toBe(true)
    }
  })

  it('every weapon, Echo, Sonata set and enemy', () => {
    for (const weapon of Object.values(catalog.weapons)) expect(weaponSchema.safeParse(weapon).success, weapon.name).toBe(true)
    for (const echo of Object.values(catalog.echoes)) expect(echoSchema.safeParse(echo).success, echo.name).toBe(true)
    for (const sonata of Object.values(catalog.sonatas)) expect(sonataSchema.safeParse(sonata).success, sonata.name).toBe(true)
    for (const enemy of Object.values(catalog.enemies)) expect(enemySchema.safeParse(enemy).success, enemy.name).toBe(true)
  })

  it('Echo stat tables', () => {
    expect(() => echoStatTablesSchema.parse(catalog.echoStats)).not.toThrow()
  })
})

describe('catalog contents are sane', () => {
  it('counts match the manifest', () => {
    expect(Object.keys(catalog.resonators)).toHaveLength(manifest.counts.resonators ?? -1)
    expect(Object.keys(catalog.weapons)).toHaveLength(manifest.counts.weapons ?? -1)
    expect(Object.keys(catalog.echoes)).toHaveLength(manifest.counts.echoes ?? -1)
  })

  it('every Resonator has 96 growth points ending at level 90', () => {
    for (const resonator of Object.values(catalog.resonators)) {
      expect(resonator.growth, resonator.name).toHaveLength(96)
      expect(resonator.growth.at(-1)?.level).toBe(90)
      expect(resonator.growth.filter((point) => point.ascended)).toHaveLength(6)
    }
  })

  it('every action part has one multiplier per skill level (10), or a single fixed one', () => {
    for (const resonator of Object.values(catalog.resonators)) {
      for (const action of resonator.actions) {
        for (const part of action.parts) {
          expect([1, 10], `${resonator.name} / ${action.name}`).toContain(part.multipliers.length)
          expect(part.flats).toHaveLength(part.multipliers.length)
        }
      }
    }
  })

  it('a value with no matching damage entry in the game data is never counted as a hit', () => {
    // Skill tables also list shields, speed changes and per-stack bonuses. Only values that
    // match a raw damage entry are hits.
    for (const resonator of Object.values(catalog.resonators)) {
      for (const action of resonator.actions) {
        if (action.kind !== 'damage' || !action.modelled) continue
        expect(action.parts.some((part) => part.matched), `${resonator.name} / ${action.name}`).toBe(true)
      }
    }
    const byName = (resonator: string, action: string) =>
      Object.values(catalog.resonators)
        .find((r) => r.name === resonator)
        ?.actions.find((a) => a.name === action)
    expect(byName('Aalto', 'Movement Speed Increase')?.modelled).toBe(false)
    expect(byName('Jianxin', 'Minor Zhoutian Final Shield')?.modelled).toBe(false)
  })

  it('Tune Rupture hits are marked unverified, since no public formula describes them', () => {
    for (const resonator of Object.values(catalog.resonators)) {
      for (const action of resonator.actions) {
        if (action.parts.some((part) => part.damageType === 'tuneRupture')) {
          expect(action.provenance.verified, `${resonator.name} / ${action.name}`).toBe(false)
          expect(action.provenance.note).toMatch(/Tune Rupture/)
        }
      }
    }
  })

  it('an action that is not modelled says why', () => {
    for (const resonator of Object.values(catalog.resonators)) {
      for (const action of resonator.actions) {
        if (!action.modelled) expect(action.notModelledReason, `${resonator.name} / ${action.name}`).toBeTruthy()
      }
    }
  })

  it('every Echo belongs to Sonata sets that exist', () => {
    for (const echo of Object.values(catalog.echoes)) {
      for (const id of echo.sonataIds) expect(catalog.sonatas[id], `${echo.name} -> set ${id}`).toBeDefined()
    }
  })

  it('substat roll chances add up to 100% for every substat', () => {
    for (const substat of catalog.echoStats.substats) {
      const total = substat.chances.reduce((sum, chance) => sum + chance, 0)
      expect(total, substat.label).toBeCloseTo(1, 3)
      expect(substat.rolls).toHaveLength(substat.chances.length)
    }
  })

  it('Echo main stats computed from the raw game tables agree with the wiki', () => {
    expect(catalog.echoStats.provenance.verified).toBe(true)
    // Spot values, from the wiki "Echo/Stats" Mainstats table (5-star, level 25).
    expect(catalog.echoStats.mainStats[4].find((m) => m.label === 'Crit. Rate')?.value).toBeCloseTo(0.22, 9)
    expect(catalog.echoStats.mainStats[3].find((m) => m.label === 'Energy Regen')?.value).toBeCloseTo(0.32, 9)
    expect(catalog.echoStats.fixedStats[1]).toMatchObject({ stat: 'hpFlat', value: 2280 })
  })
})

describe('cross-check against the second source', () => {
  it('every Resonator and weapon agrees with nanoka.cc', () => {
    expect(report.summary.resonators?.verified).toBe(report.summary.resonators?.checked)
    expect(report.summary.weapons?.verified).toBe(report.summary.weapons?.checked)
  })

  it('Sonata sets agree with the raw game tables, except two where the shown text and the table differ', () => {
    // Found 11 Nov 2026: the text says "+7.5% per stack, up to 4" (Havoc Eclipse) and "+10% per stack,
    // up to 3" (Freezing Frost) while the raw table holds 6% / 5 and 30%. They stay unverified and their
    // 5-piece effects are not encoded until the sources agree.
    const unverified = Object.values(catalog.sonatas).filter((s) => !s.provenance.verified).map((s) => s.name).sort()
    expect(unverified).toEqual(['Freezing Frost', 'Havoc Eclipse'])
  })

  it('no skill value disagrees between the sources', () => {
    expect(report.mismatches.filter((line) => line.includes('damage row'))).toEqual([])
  })

  it('an action is verified exactly when it has no recorded ambiguity', () => {
    for (const resonator of Object.values(catalog.resonators)) {
      for (const action of resonator.actions) {
        if (action.parts.length === 0) continue
        expect(action.provenance.verified, `${resonator.name} / ${action.name}`).toBe(action.provenance.note === undefined)
      }
    }
  })
})
