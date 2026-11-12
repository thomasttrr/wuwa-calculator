import type { OptimizerProblem, OptimizerResult } from '../engine/optimize/search'

/** Main thread to worker. Units are indices into planUnits(prepareProblem(problem)), the same on both sides. */
export type OptimizerRequest = { type: 'start'; problem: OptimizerProblem } | { type: 'run'; from: number; to: number; cutoff: number }

/** Worker to main thread. */
export type OptimizerResponse =
  | { type: 'ready'; units: number }
  | {
      type: 'done'
      from: number
      to: number
      results: OptimizerResult[]
      nodes: number
    }
  | { type: 'error'; message: string }
