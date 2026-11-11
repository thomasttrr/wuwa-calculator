import { describe, expect, it } from 'vitest'
import { CORE_RESONATOR_IDS } from '../../data/authored/core-set'
import { DEFAULT_ENEMY, defaultBuildFor, startingRotation } from '../../src/data/defaults'
import { createSampleBuild } from '../../src/data/sample-build'
import { simulateRotation } from '../../src/engine/rotation/simulate'
import type { RotationStep } from '../../src/engine/types/build'
import { catalog } from '../engine/fixtures/builds'

const steps = (items: readonly unknown[]) => items as RotationStep[]

describe('default target', () => {
  it('is a level 100 enemy with the 10% base resistance the wiki states for most enemies', () => {
    expect(DEFAULT_ENEMY.level).toBe(100)
    expect(Object.values(DEFAULT_ENEMY.resistance).every((value) => value === 0.1)).toBe(true)
  })
})

describe('starting rotation', () => {
  for (const id of CORE_RESONATOR_IDS) {
    const resonator = catalog.resonators[id]
    it(`${resonator?.name}: at least 5 counted damage steps, including the Liberation when it deals damage`, () => {
      if (!resonator) throw new Error('missing')
      const rotation = startingRotation(resonator)
      const actions = steps(rotation.items).map((step) => resonator.actions.find((a) => a.id === step.actionId))
      expect(actions.length).toBeGreaterThanOrEqual(5)
      for (const action of actions) expect(action?.kind === 'damage' && action.modelled, action?.name).toBe(true)
      // Some Liberations deal no damage (Shorekeeper's creates a field).
      const liberationHits = resonator.actions.some((a) => a.skillType === 'liberation' && a.kind === 'damage' && a.modelled)
      expect(actions.some((action) => action?.skillType === 'liberation')).toBe(liberationHits)
      expect(new Set(steps(rotation.items).map((s) => s.id)).size).toBe(rotation.items.length)
    })
  }

  it('every Resonator gets a build whose rotation deals damage', () => {
    for (const resonator of Object.values(catalog.resonators)) {
      const build = defaultBuildFor(resonator.id, catalog)
      expect(build.rotation.items.length, resonator.name).toBeGreaterThan(0)
      expect(simulateRotation(build, catalog).total.average, resonator.name).toBeGreaterThan(0)
    }
  })
})

describe('sample build', () => {
  const sample = createSampleBuild(catalog)
  const tables = catalog.echoStats

  it('is a core Resonator at level 90 with a weapon of the right type', () => {
    expect(CORE_RESONATOR_IDS).toContain(sample.resonator.id)
    expect(sample.resonator.level).toBe(90)
    const weapon = sample.weapon ? catalog.weapons[sample.weapon.id] : undefined
    expect(weapon?.weaponType).toBe(catalog.resonators[sample.resonator.id]?.weaponType)
  })

  it('has five Echoes within the cost budget of 12', () => {
    expect(sample.echoes.every((echo) => echo !== null)).toBe(true)
    expect(sample.echoes.reduce((total, echo) => total + (echo?.cost ?? 0), 0)).toBeLessThanOrEqual(12)
  })

  it('uses only legal Echo stats', () => {
    for (const echo of sample.echoes) {
      if (!echo) continue
      const def = catalog.echoes[echo.echoId]
      expect(def?.cost).toBe(echo.cost)
      expect(def?.sonataIds).toContain(echo.sonataId)
      expect(tables.mainStats[echo.cost]).toContainEqual(expect.objectContaining({ stat: echo.mainStat.stat, value: echo.mainStat.value }))
      expect(echo.fixedStat).toEqual({ stat: tables.fixedStats[echo.cost].stat, value: tables.fixedStats[echo.cost].value })
      expect(echo.substats.length).toBeLessThanOrEqual(5)
      const labels = echo.substats.map((sub) => tables.substats.find((t) => t.stat === sub.stat && JSON.stringify(t.scope) === JSON.stringify(sub.scope))?.label)
      expect(new Set(labels).size, 'no substat twice on one Echo').toBe(labels.length)
      for (const sub of echo.substats) {
        const table = tables.substats.find((t) => t.stat === sub.stat && JSON.stringify(t.scope) === JSON.stringify(sub.scope))
        expect(table?.rolls, `${sub.stat} ${sub.value}`).toContain(sub.value)
      }
    }
  })

  it('deals damage, uses only verified inputs, and every effect it switches on exists', () => {
    const result = simulateRotation(sample, catalog)
    expect(result.total.average).toBeGreaterThan(0)
    expect(result.hasUnverified).toBe(false)
    for (const key of Object.keys(sample.effects)) {
      const effectId = key.replace(/^teammate\d:/, '')
      expect(catalog.effects.some((effect) => effect.id === effectId), key).toBe(true)
    }
  })
})
