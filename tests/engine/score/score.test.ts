import { describe, expect, it } from 'vitest'
import { compileRotation, echoStatVector, stripEchoStats } from '../../../src/engine/compiled/compile'
import { bestSubstatCounts, frameCosts, searchIdealLoadout } from '../../../src/engine/score/ideal'
import { GRADE_BANDS, gradeFor, percentFor, scoreBuild } from '../../../src/engine/score/score'
import { simulateRotation } from '../../../src/engine/rotation/simulate'
import type { Build, EchoInstance } from '../../../src/engine/types/build'
import type { EchoCost } from '../../../src/engine/types/catalog'
import { createSampleBuild } from '../../../src/data/sample-build'
import { catalog } from '../fixtures/builds'

describe('score scale', () => {
  it('maps baseline to 0, reference to 100 and maximum to 200, linearly between', () => {
    const anchors = { baseline: 1000, reference: 2000, maximum: 2500 }
    expect(percentFor(1000, anchors)).toBe(0)
    expect(percentFor(1500, anchors)).toBe(50)
    expect(percentFor(2000, anchors)).toBe(100)
    expect(percentFor(2250, anchors)).toBe(150)
    expect(percentFor(2500, anchors)).toBe(200)
  })

  it('keeps going past the maximum and below the baseline instead of hiding it', () => {
    const anchors = { baseline: 1000, reference: 2000, maximum: 2500 }
    expect(percentFor(2750, anchors)).toBe(250)
    expect(percentFor(500, anchors)).toBe(-50)
  })

  it('grades by fixed bands', () => {
    expect(gradeFor(-10)).toBe('F')
    expect(gradeFor(0)).toBe('F')
    expect(gradeFor(99.9)).toBe('B')
    expect(gradeFor(100)).toBe('A')
    expect(gradeFor(150)).toBe('SS')
    expect(gradeFor(200)).toBe('SSS+')
    expect(GRADE_BANDS.map((band) => band.grade)).toEqual(['F', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'SSS+'])
  })
})

describe('bestSubstatCounts', () => {
  // A small stand-in damage function with diminishing and interacting returns.
  const evaluate = (v: Float64Array) => (1 + v[0]!) * (1 + 2 * v[1]!) * (1 + 0.5 * v[2]!) + v[3]!
  const candidates = [
    { index: 0, value: 0.3 },
    { index: 1, value: 0.1 },
    { index: 2, value: 0.5 },
    { index: 3, value: 0.05 },
  ]

  function exhaustive(picks: number, perStatMax: number): number {
    let best = -Infinity
    const counts = [0, 0, 0, 0]
    const walk = (i: number, left: number) => {
      if (i === counts.length) {
        if (left !== 0) return
        const v = new Float64Array(4)
        counts.forEach((c, k) => (v[candidates[k]!.index]! += c * candidates[k]!.value))
        best = Math.max(best, evaluate(v))
        return
      }
      for (let c = 0; c <= Math.min(perStatMax, left); c += 1) {
        counts[i] = c
        walk(i + 1, left - c)
      }
      counts[i] = 0
    }
    walk(0, picks)
    return best
  }

  for (const [picks, max] of [
    [4, 2],
    [6, 3],
    [8, 5],
    [5, 5],
  ] as const) {
    it(`matches exhaustive search for ${picks} picks with at most ${max} of each`, () => {
      const result = bestSubstatCounts(evaluate, new Float64Array(4), picks, max, candidates)
      expect(result.damage).toBeCloseTo(exhaustive(picks, max), 12)
      expect(result.counts.reduce((a, b) => a + b, 0)).toBe(picks)
      expect(Math.max(...result.counts)).toBeLessThanOrEqual(max)
    })
  }
})

describe('frameCosts', () => {
  const echo = (cost: EchoCost): EchoInstance => ({
    uid: 'x',
    echoId: 1,
    cost,
    sonataId: 1,
    mainStat: { stat: 'atkPct', value: 0 },
    fixedStat: { stat: 'atkFlat', value: 0 },
    substats: [],
  })
  it('uses the build\'s own Echo costs and fills empty slots within the budget of 12', () => {
    expect(frameCosts([null, null, null, null, null])).toEqual([4, 3, 3, 1, 1])
    expect(frameCosts([echo(4), echo(4), null, null, null])).toEqual([4, 4, 1, 1, 1])
    expect(frameCosts([echo(3), null, null, null, echo(1)])).toEqual([3, 4, 3, 1, 1])
    expect(frameCosts([echo(4), echo(3), echo(3), echo(1), echo(1)])).toEqual([4, 3, 3, 1, 1])
  })
})

describe('reference and maximum on a real build', () => {
  const sample = createSampleBuild(catalog)
  const frame = stripEchoStats(sample)
  const compiled = compileRotation(frame, catalog)
  const costs = frameCosts(sample.echoes)
  const maximum = searchIdealLoadout(compiled, costs, catalog.echoStats, { substatsPerEcho: 5, roll: 'max' })
  const reference = searchIdealLoadout(compiled, costs, catalog.echoStats, { substatsPerEcho: 3, roll: 'mean' })

  it('the maximum beats every random legal loadout with the same Echoes', () => {
    let seed = 99
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
    for (let trial = 0; trial < 60; trial += 1) {
      const echoes = sample.echoes.map((echo) => {
        if (!echo) return null
        const mains = catalog.echoStats.mainStats[echo.cost]
        const main = mains[Math.floor(random() * mains.length)]!
        const pool = [...catalog.echoStats.substats]
        const substats = Array.from({ length: 5 }, () => {
          const s = pool.splice(Math.floor(random() * pool.length), 1)[0]!
          return { stat: s.stat, scope: s.scope, value: s.rolls[Math.floor(random() * s.rolls.length)]! }
        })
        return { ...echo, mainStat: { stat: main.stat, scope: main.scope, value: main.value }, substats }
      })
      expect(compiled.evaluate(echoStatVector(echoes))).toBeLessThanOrEqual(maximum.damage + 1e-6)
    }
  })

  it('baseline < reference < maximum, and the reference uses at most 3 substats per Echo', () => {
    const baseline = simulateRotation({ ...sample, echoes: [null, null, null, null, null] }, catalog).total.average
    expect(baseline).toBeLessThan(reference.damage)
    expect(reference.damage).toBeLessThan(maximum.damage)
    expect(reference.substatCounts.reduce((a, b) => a + b, 0)).toBe(15)
    expect(maximum.substatCounts.reduce((a, b) => a + b, 0)).toBe(25)
    expect(Math.max(...maximum.substatCounts)).toBeLessThanOrEqual(5)
  })

  it('the best main stats are legal for each cost', () => {
    maximum.mainStats.forEach((main, slot) => {
      expect(catalog.echoStats.mainStats[costs[slot]!]).toContainEqual(main)
    })
  })
})

describe('scoreBuild', () => {
  const sample = createSampleBuild(catalog)
  const score = scoreBuild(sample, catalog)

  it('scores the sample build between baseline and maximum', () => {
    expect(score.current).toBeCloseTo(simulateRotation(sample, catalog).total.average, 6)
    expect(score.percent).toBeGreaterThan(0)
    expect(score.percent).toBeLessThan(200)
    expect(score.grade).toBe(gradeFor(score.percent))
  })

  it('the fingerprint ignores Echo stats but not the setup', () => {
    const otherStats: Build = {
      ...sample,
      echoes: sample.echoes.map((echo, slot) => (echo && slot === 0 ? { ...echo, substats: echo.substats.slice(0, 2) } : echo)),
    }
    const otherEnemy: Build = { ...sample, enemy: { ...sample.enemy, level: 90 } }
    expect(scoreBuild(otherStats, catalog).fingerprint).toBe(score.fingerprint)
    expect(scoreBuild(otherEnemy, catalog).fingerprint).not.toBe(score.fingerprint)
  })

  it('reuses cached references when only Echo stats change', () => {
    const cache = new Map()
    const first = scoreBuild(sample, catalog, cache)
    const changed: Build = {
      ...sample,
      echoes: sample.echoes.map((echo, slot) => (echo && slot === 1 ? { ...echo, substats: [] } : echo)),
    }
    const second = scoreBuild(changed, catalog, cache)
    expect(cache.size).toBe(1)
    expect(second.reference).toBe(first.reference)
    expect(second.current).toBeLessThan(first.current)
  })
})
