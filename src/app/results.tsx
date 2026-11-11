// One calculation of the shown build, shared by the header and every tool.
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { simulateRotation } from '../engine/rotation/simulate'
import type { RotationResult } from '../engine/rotation/simulate'
import { gradeFor, percentFor, setupFingerprint } from '../engine/score/score'
import type { Grade, ScoreAnchors } from '../engine/score/score'
import type { Build } from '../engine/types/build'
import { requestAnchors } from '../workers/score-client'
import { useBuildView, useCatalog } from './context'

export interface BuildResults {
  build: Build
  simulation: RotationResult
  fingerprint: string
  /** Null while the reference builds are being worked out. */
  score: { anchors: ScoreAnchors; percent: number; grade: Grade } | null
  scoreError: string | null
}

const ResultsContext = createContext<BuildResults | null>(null)

export function ResultsProvider({ children }: { children: ReactNode }) {
  const catalog = useCatalog()
  const build = useBuildView()
  const [anchors, setAnchors] = useState<{ fingerprint: string; anchors: ScoreAnchors } | null>(null)
  const [scoreError, setScoreError] = useState<string | null>(null)

  const simulation = useMemo(() => (build ? simulateRotation(build, catalog) : null), [build, catalog])
  const fingerprint = useMemo(() => (build ? setupFingerprint(build, catalog) : null), [build, catalog])

  useEffect(() => {
    if (!build || !fingerprint) return
    let live = true
    requestAnchors(fingerprint, build, catalog)
      .then((result) => {
        if (!live) return
        setAnchors({ fingerprint, anchors: result })
        setScoreError(null)
      })
      .catch((error: Error) => live && setScoreError(error.message))
    return () => {
      live = false
    }
  }, [build, fingerprint, catalog])

  const value = useMemo<BuildResults | null>(() => {
    if (!build || !simulation || !fingerprint) return null
    const ready = anchors?.fingerprint === fingerprint ? anchors.anchors : null
    const percent = ready ? percentFor(simulation.total.average, ready) : null
    return {
      build,
      simulation,
      fingerprint,
      score: ready && percent !== null ? { anchors: ready, percent, grade: gradeFor(percent) } : null,
      scoreError,
    }
  }, [build, simulation, fingerprint, anchors, scoreError])

  return <ResultsContext.Provider value={value}>{children}</ResultsContext.Provider>
}

/** Results for the shown build, or null when there is no build. */
export function useResults(): BuildResults | null {
  return useContext(ResultsContext)
}
