import type { Build } from '../engine/types/build'
import type { ScoreAnchors } from '../engine/score/score'

export interface ScoreRequest {
  id: number
  build: Build
}

export type ScoreResponse =
  | { id: number; ok: true; fingerprint: string; anchors: ScoreAnchors }
  | { id: number; ok: false; error: string }
