// Runs an optimizer search across a pool of workers, with progress, a time estimate and a cancel
// that really stops (the workers are terminated). Without worker support it runs on the main
// thread in short slices, so the page stays responsive.
import { planUnits, prepareProblem, searchUnits, TopResults } from '../engine/optimize/search'
import type { OptimizerProblem, OptimizerResult } from '../engine/optimize/search'
import type { Catalog } from '../engine/types/catalog'
import type { OptimizerRequest, OptimizerResponse } from './optimizer-protocol'

export interface OptimizerProgress {
  done: number
  total: number
  elapsedMs: number
  /** Null until enough work is done to say. */
  remainingMs: number | null
  workers: number
}

export interface OptimizerHandle {
  /** Resolves with the kept results, best first; also when cancelled (with what was found so far). */
  finished: Promise<{
    results: OptimizerResult[]
    cancelled: boolean
    elapsedMs: number
  }>
  cancel(): void
}

export interface OptimizerCallbacks {
  onProgress?(progress: OptimizerProgress): void
  onResults?(results: OptimizerResult[]): void
}

/** How many workers this device should use: cores less one, at most 8; 2 on small or low-memory devices. */
export function poolSize(): number {
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 2) : 2
  const memory = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined
  const small = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 767px)').matches
  const size = Math.max(1, Math.min(8, cores - 1))
  return small || (memory !== undefined && memory <= 4) ? Math.min(2, size) : size
}

/** Seconds until the estimate is offered, and how much of the work must be done. */
const ESTIMATE_AFTER_MS = 800
const ESTIMATE_AFTER_SHARE = 0.01

function estimate(done: number, total: number, elapsedMs: number): number | null {
  if (done === 0 || (elapsedMs < ESTIMATE_AFTER_MS && done / total < ESTIMATE_AFTER_SHARE)) return null
  return (elapsedMs / done) * (total - done)
}

export function runOptimizer(problem: OptimizerProblem, catalog: Catalog, callbacks: OptimizerCallbacks = {}): OptimizerHandle {
  const started = performance.now()
  const top = new TopResults(problem.settings.keep)
  let cancelled = false
  let finish: (value: { results: OptimizerResult[]; cancelled: boolean; elapsedMs: number }) => void = () => {}
  let fail: (error: Error) => void = () => {}
  const finished = new Promise<{
    results: OptimizerResult[]
    cancelled: boolean
    elapsedMs: number
  }>((resolve, reject) => {
    finish = resolve
    fail = reject
  })
  const merge = (results: readonly OptimizerResult[]) => {
    let changed = false
    for (const r of results) changed = top.offer(r.echoes, r.damage) || changed
    if (changed) callbacks.onResults?.(top.results())
  }

  if (typeof Worker === 'undefined') {
    // Main-thread fallback: slices of work between frames.
    const prepared = prepareProblem(problem, catalog)
    const units = planUnits(prepared)
    let next = 0
    const step = () => {
      if (cancelled) return
      const sliceStart = performance.now()
      while (next < units.length && performance.now() - sliceStart < 30) {
        const to = Math.min(units.length, next + 10)
        merge(
          searchUnits(prepared, units.slice(next, to), {
            getCutoff: () => top.cutoff,
          }).results,
        )
        next = to
      }
      const elapsedMs = performance.now() - started
      callbacks.onProgress?.({
        done: next,
        total: units.length,
        elapsedMs,
        remainingMs: estimate(next, units.length, elapsedMs),
        workers: 0,
      })
      if (next >= units.length) finish({ results: top.results(), cancelled: false, elapsedMs })
      else setTimeout(step, 0)
    }
    setTimeout(step, 0)
    return {
      finished,
      cancel() {
        if (cancelled) return
        cancelled = true
        finish({
          results: top.results(),
          cancelled: true,
          elapsedMs: performance.now() - started,
        })
      },
    }
  }

  const size = poolSize()
  const workers = Array.from(
    { length: size },
    () =>
      new Worker(new URL('./optimizer.worker.ts', import.meta.url), {
        type: 'module',
      }),
  )
  let total = 0
  let next = 0
  let done = 0
  let busy = 0
  const batchByWorker = new Map<Worker, { size: number; sentAt: number }>()
  const stopAll = () => workers.forEach((w) => w.terminate())

  const progress = () => {
    const elapsedMs = performance.now() - started
    callbacks.onProgress?.({
      done,
      total,
      elapsedMs,
      remainingMs: estimate(done, total, elapsedMs),
      workers: size,
    })
  }

  const hand = (worker: Worker) => {
    if (cancelled) return
    if (next >= total) {
      if (busy === 0) {
        stopAll()
        progress()
        finish({
          results: top.results(),
          cancelled: false,
          elapsedMs: performance.now() - started,
        })
      }
      return
    }
    // Aim for batches of about a fifth of a second, so the cut-off is shared often and cancel is quick.
    const last = batchByWorker.get(worker)
    const batch = last ? Math.max(1, Math.min(2000, Math.round(last.size * (200 / Math.max(1, performance.now() - last.sentAt))))) : 8
    const from = next
    const to = Math.min(total, next + batch)
    next = to
    busy += 1
    batchByWorker.set(worker, { size: to - from, sentAt: performance.now() })
    const request: OptimizerRequest = {
      type: 'run',
      from,
      to,
      cutoff: top.cutoff,
    }
    worker.postMessage(request)
  }

  workers.forEach((worker) => {
    worker.onmessage = (event: MessageEvent<OptimizerResponse>) => {
      if (cancelled) return
      const message = event.data
      if (message.type === 'error') {
        cancelled = true
        stopAll()
        fail(new Error(message.message))
        return
      }
      if (message.type === 'ready') {
        total = message.units
        hand(worker)
        return
      }
      busy -= 1
      done += message.to - message.from
      merge(message.results)
      progress()
      hand(worker)
    }
    const start: OptimizerRequest = { type: 'start', problem }
    worker.postMessage(start)
  })

  return {
    finished,
    cancel() {
      if (cancelled) return
      cancelled = true
      stopAll()
      finish({
        results: top.results(),
        cancelled: true,
        elapsedMs: performance.now() - started,
      })
    },
  }
}
