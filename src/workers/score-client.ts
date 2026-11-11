// Asks the score worker for a setup's anchors, once per setup. Without worker support (tests,
// very old browsers) it computes on the main thread instead.
import { computeAnchors } from '../engine/score/score'
import type { ScoreAnchors } from '../engine/score/score'
import type { Build } from '../engine/types/build'
import type { Catalog } from '../engine/types/catalog'
import type { ScoreRequest, ScoreResponse } from './score-protocol'

const anchorsByFingerprint = new Map<string, Promise<ScoreAnchors>>()
const pending = new Map<number, { resolve: (anchors: ScoreAnchors) => void; reject: (error: Error) => void }>()
let worker: Worker | null = null
let nextId = 1

function getWorker(): Worker | null {
  if (worker || typeof Worker === 'undefined') return worker
  worker = new Worker(new URL('./score.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<ScoreResponse>) => {
    const request = pending.get(event.data.id)
    if (!request) return
    pending.delete(event.data.id)
    if (event.data.ok) request.resolve(event.data.anchors)
    else request.reject(new Error(event.data.error))
  }
  return worker
}

/** Anchors already worked out for this setup, if any. */
export function cachedAnchors(fingerprint: string): Promise<ScoreAnchors> | undefined {
  return anchorsByFingerprint.get(fingerprint)
}

export function requestAnchors(fingerprint: string, build: Build, catalog: Catalog): Promise<ScoreAnchors> {
  const existing = anchorsByFingerprint.get(fingerprint)
  if (existing) return existing
  const target = getWorker()
  const promise: Promise<ScoreAnchors> = target
    ? new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, { resolve, reject })
        const request: ScoreRequest = { id, build }
        target.postMessage(request)
      })
    : Promise.resolve().then(() => computeAnchors(build, catalog))
  anchorsByFingerprint.set(fingerprint, promise)
  promise.catch(() => anchorsByFingerprint.delete(fingerprint))
  return promise
}
