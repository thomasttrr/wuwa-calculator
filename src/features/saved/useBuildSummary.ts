import { useEffect, useMemo, useState } from 'react'
import { useCatalog } from '../../app/context'
import { simulateRotation } from '../../engine/rotation/simulate'
import { gradeFor, percentFor, setupFingerprint } from '../../engine/score/score'
import type { Grade, ScoreAnchors } from '../../engine/score/score'
import type { Build } from '../../engine/types/build'
import { requestAnchors } from '../../workers/score-client'

export interface BuildSummary {
  damage: number
  fingerprint: string
  score: { percent: number; grade: Grade; anchors: ScoreAnchors } | null
  hasUnverified: boolean
}

/** Damage now, and the score once its reference builds are worked out (in the worker). */
export function useBuildSummary(build: Build | undefined): BuildSummary | null {
  const catalog = useCatalog()
  const simulation = useMemo(() => (build ? simulateRotation(build, catalog) : null), [build, catalog])
  const fingerprint = useMemo(() => (build ? setupFingerprint(build, catalog) : ''), [build, catalog])
  const [anchors, setAnchors] = useState<{ fingerprint: string; anchors: ScoreAnchors } | null>(null)

  useEffect(() => {
    if (!build || !fingerprint) return
    let live = true
    requestAnchors(fingerprint, build, catalog)
      .then((result) => live && setAnchors({ fingerprint, anchors: result }))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [build, fingerprint, catalog])

  if (!build || !simulation) return null
  const ready = anchors?.fingerprint === fingerprint ? anchors.anchors : null
  const percent = ready ? percentFor(simulation.total.average, ready) : null
  return {
    damage: simulation.total.average,
    fingerprint,
    score: ready && percent !== null ? { percent, grade: gradeFor(percent), anchors: ready } : null,
    hasUnverified: simulation.hasUnverified,
  }
}
