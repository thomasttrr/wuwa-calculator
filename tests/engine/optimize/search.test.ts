import { describe, expect, it } from 'vitest'
import { createSampleBuild } from '../../../src/data/sample-build'
import { generateCandidates } from '../../../src/engine/optimize/generate'
import { bruteForce, buildFromResult, defaultSettings, prepareProblem, searchAll } from '../../../src/engine/optimize/search'
import type { OptimizerProblem, OptimizerSettings } from '../../../src/engine/optimize/search'
import { simulateRotation } from '../../../src/engine/rotation/simulate'
import { resolveBaseStats } from '../../../src/engine/stats/base'
import { collectModifiers } from '../../../src/engine/stats/collect'
import { computeStatSheet } from '../../../src/engine/stats/sheet'
import type { EchoInstance } from '../../../src/engine/types/build'
import { catalog } from '../fixtures/builds'
import { inventory } from '../fixtures/inventory'

const sample = createSampleBuild(catalog)

const problem = (candidates: EchoInstance[], settings: Partial<OptimizerSettings> = {}): OptimizerProblem => ({
  build: sample,
  candidates,
  settings: { ...defaultSettings(), keep: 5, ...settings },
})

const key = (r: { echoes: readonly number[] }) => `${r.echoes[0]}|${[...r.echoes.slice(1)].sort((a, b) => a - b).join(',')}`

describe('optimizer search', () => {
  for (const seed of [1, 2, 3]) {
    it(`finds exactly what checking every combination finds (inventory ${seed})`, () => {
      const p = problem(inventory(seed, 24))
      const fast = searchAll(p, catalog)
      const slow = bruteForce(p, catalog)
      expect(fast.results).toHaveLength(5)
      fast.results.forEach((r, i) => expect(r.damage).toBeCloseTo(slow[i]!.damage, 6))
      expect(fast.results.map(key)).toEqual(slow.map(key))
      expect(fast.stopped).toBe(false)
    })
  }

  it('reports the damage a full simulation of the result gives', () => {
    const p = problem(inventory(4, 20))
    for (const result of searchAll(p, catalog).results.slice(0, 3)) {
      const build = buildFromResult(p, result)
      expect(build.echoes.filter(Boolean).reduce((n, e) => n + e!.cost, 0)).toBeLessThanOrEqual(12)
      expect(result.damage).toBeCloseTo(simulateRotation(build, catalog).total.average, 6)
    }
  })

  it('keeps to stat limits, and still matches checking every combination', () => {
    const limits = [
      { stat: 'energyRegen' as const, min: 1.1 },
      { stat: 'critRate' as const, max: 0.7 },
    ]
    const p = problem(inventory(5, 22), { limits })
    const fast = searchAll(p, catalog).results
    expect(fast.map(key)).toEqual(bruteForce(p, catalog).map(key))
    for (const result of fast) {
      const b = buildFromResult(p, result)
      const sheet = computeStatSheet(resolveBaseStats(b, catalog), collectModifiers(b, catalog))
      expect(sheet.energyRegen.total).toBeGreaterThanOrEqual(1.1 - 1e-9)
      expect(sheet.critRate.total).toBeLessThanOrEqual(0.7 + 1e-9)
    }
  })

  it('locks the main Echo when asked', () => {
    const candidates = [...inventory(6, 18), { ...sample.echoes[0]!, uid: 'main-copy' }]
    const p = problem(candidates, { lockMainEchoId: sample.echoes[0]!.echoId })
    const results = searchAll(p, catalog).results
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) expect(candidates[r.echoes[0]!]!.echoId).toBe(sample.echoes[0]!.echoId)
  })

  it('uses only the allowed sets', () => {
    const allowed = [sample.echoes[0]!.sonataId]
    const p = problem(inventory(7, 24), { allowedSonataIds: allowed })
    for (const r of searchAll(p, catalog).results) for (const i of r.echoes) expect(allowed).toContain(p.candidates[i]!.sonataId)
  })

  it('plans from generated Echoes: your main Echo kind, your substats as a fixed total, exact damage', () => {
    const sets = [sample.echoes[0]!.sonataId, ...Object.keys(catalog.sonatas).map(Number).filter((id) => id !== sample.echoes[0]!.sonataId).slice(0, 2)]
    const generated = generateCandidates(sample, catalog, sets)
    expect(generated.candidates.every((e) => e.substats.length === 0 && sets.includes(e.sonataId))).toBe(true)
    const p: OptimizerProblem = {
      build: sample,
      candidates: generated.candidates,
      extraSubstats: generated.extraSubstats,
      settings: { ...defaultSettings(), keep: 3, lockMainEchoId: generated.mainEchoId },
    }
    const results = searchAll(p, catalog).results
    expect(results.map(key)).toEqual(bruteForce(p, catalog).map(key))
    for (const r of results) {
      expect(p.candidates[r.echoes[0]!]!.echoId).toBe(sample.echoes[0]!.echoId)
      expect(r.damage).toBeCloseTo(simulateRotation(buildFromResult(p, r), catalog).total.average, 6)
    }
    // The sample is five pieces of its set with the best main stats, so the plan should match or beat it.
    expect(results[0]!.damage).toBeGreaterThanOrEqual(simulateRotation(sample, catalog).total.average - 1e-6)
  })

  it('stops promptly when asked, saying so', () => {
    const p = problem(inventory(8, 30))
    let checks = 0
    const run = searchAll(p, catalog, { shouldStop: () => ++checks > 2 })
    expect(run.stopped).toBe(true)
    expect(checks).toBeLessThan(10)
  })

  it('skips Echoes beaten on every stat by enough others of their kind, and still matches checking every combination', () => {
    const base = inventory(9, 14)
    const strong = base[0]!
    // Ten weaker copies of the first Echo: same kind and set, fewer substats.
    const weak = Array.from({ length: 10 }, (_, i) => ({ ...strong, uid: `weak-${i}`, substats: strong.substats.slice(0, i % 3) }))
    const p = problem([...base, ...weak], { keep: 3 })
    expect(prepareProblem(p, catalog).order.length).toBeLessThan(p.candidates.length)
    expect(searchAll(p, catalog).results.map(key)).toEqual(bruteForce(p, catalog).map(key))
  })
})
