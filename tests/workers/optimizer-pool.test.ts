import { describe, expect, it } from 'vitest'
import { createSampleBuild } from '../../src/data/sample-build'
import { defaultSettings, searchAll } from '../../src/engine/optimize/search'
import { runOptimizer } from '../../src/workers/optimizer-pool'
import type { OptimizerProgress } from '../../src/workers/optimizer-pool'
import { catalog } from '../engine/fixtures/builds'
import { inventory } from '../engine/fixtures/inventory'

// Node has no Web Workers, so these run the pool's main-thread path: the same plan, in slices.
const problem = (n: number) => ({ build: createSampleBuild(catalog), candidates: inventory(11, n), settings: { ...defaultSettings(), keep: 5 } })

describe('optimizer pool (main-thread path)', () => {
  it('finds the same results as one uninterrupted search, reporting progress to the end', async () => {
    const p = problem(30)
    const seen: OptimizerProgress[] = []
    const run = await runOptimizer(p, catalog, { onProgress: (x) => seen.push(x) }).finished
    expect(run.cancelled).toBe(false)
    expect(run.results.map((r) => r.damage)).toEqual(searchAll(p, catalog).results.map((r) => r.damage))
    expect(seen.at(-1)?.done).toBe(seen.at(-1)?.total)
  })

  it('stops when cancelled and says so, keeping what it found', async () => {
    const handle = runOptimizer(problem(120), catalog)
    const started = performance.now()
    setTimeout(() => handle.cancel(), 50)
    const run = await handle.finished
    expect(run.cancelled).toBe(true)
    expect(performance.now() - started).toBeLessThan(1000)
  })
})
