/// <reference lib="webworker" />
// Works out the score's reference and maximum builds off the main thread, so typing and
// dragging never stall while the search runs.
import { loadCatalog } from '../data/catalog'
import { computeAnchors, setupFingerprint } from '../engine/score/score'
import type { ScoreRequest, ScoreResponse } from './score-protocol'

const catalogReady = loadCatalog()

self.onmessage = async (event: MessageEvent<ScoreRequest>) => {
  const { id, build } = event.data
  const catalog = await catalogReady
  let response: ScoreResponse
  try {
    response = { id, ok: true, fingerprint: setupFingerprint(build, catalog), anchors: computeAnchors(build, catalog) }
  } catch (error) {
    response = { id, ok: false, error: (error as Error).message }
  }
  self.postMessage(response)
}
