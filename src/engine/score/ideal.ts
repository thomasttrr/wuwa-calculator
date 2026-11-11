// Finds the best Echo stats for a build's own Echo frame (which Echoes, their costs and sets stay
// as they are). Used for the score's 100% and 200% anchors.
import type { CompiledRotation } from '../compiled/compile'
import { ECHO_STAT_KEYS, echoStatIndex } from '../compiled/compile'
import type { EchoInstance } from '../types/build'
import type { EchoCost, EchoStatTables } from '../types/catalog'

export const COST_BUDGET = 12
const DEFAULT_PATTERN: readonly EchoCost[] = [4, 3, 3, 1, 1]

/**
 * The cost of each of the five slots: the build's own Echoes where it has them; empty slots are
 * filled from the usual 4-3-3-1-1 pattern, never going over the budget of 12.
 */
export function frameCosts(echoes: readonly (EchoInstance | null)[]): EchoCost[] {
  const slots = Array.from({ length: 5 }, (_, i) => echoes[i] ?? null)
  const remaining = [...DEFAULT_PATTERN]
  for (const echo of slots) {
    if (!echo) continue
    const at = remaining.indexOf(echo.cost)
    if (at >= 0) remaining.splice(at, 1)
  }
  let left = COST_BUDGET - slots.reduce((total, echo) => total + (echo?.cost ?? 0), 0)
  let empties = slots.filter((echo) => !echo).length
  return slots.map((echo) => {
    if (echo) return echo.cost
    const fits = remaining.findIndex((cost) => cost <= left - (empties - 1))
    const cost: EchoCost = fits >= 0 ? (remaining.splice(fits, 1)[0] ?? 1) : 1
    left -= cost
    empties -= 1
    return cost
  })
}

export interface SubstatCandidate {
  /** Slot in the Echo stat vector. */
  index: number
  /** Value one copy adds. */
  value: number
}

export interface SubstatResult {
  damage: number
  /** Copies of each candidate, parallel to the candidates given. */
  counts: number[]
  vector: Float64Array
}

/**
 * Chooses how many copies of each substat to take (at most `perStatMax` of each, `picks` in all)
 * to maximise damage. Greedy by best next copy, then repeated single swaps until none helps.
 * tests/engine/score/score.test.ts checks it against exhaustive search.
 */
export function bestSubstatCounts(
  evaluate: (vector: Float64Array) => number,
  base: Float64Array,
  picks: number,
  perStatMax: number,
  candidates: readonly SubstatCandidate[],
): SubstatResult {
  const counts = candidates.map(() => 0)
  const vector = Float64Array.from(base)
  const take = Math.min(picks, candidates.length * perStatMax)

  for (let pick = 0; pick < take; pick += 1) {
    let best = -1
    let bestDamage = -Infinity
    candidates.forEach((candidate, i) => {
      if ((counts[i] ?? 0) >= perStatMax) return
      vector[candidate.index]! += candidate.value
      const damage = evaluate(vector)
      vector[candidate.index]! -= candidate.value
      if (damage > bestDamage) {
        bestDamage = damage
        best = i
      }
    })
    if (best < 0) break
    counts[best]! += 1
    vector[candidates[best]!.index]! += candidates[best]!.value
  }

  let damage = evaluate(vector)
  for (let round = 0; round < 500; round += 1) {
    let improved = false
    for (let from = 0; from < candidates.length; from += 1) {
      if ((counts[from] ?? 0) === 0) continue
      for (let to = 0; to < candidates.length; to += 1) {
        if (to === from || (counts[to] ?? 0) >= perStatMax) continue
        const a = candidates[from]!
        const b = candidates[to]!
        vector[a.index]! -= a.value
        vector[b.index]! += b.value
        const trial = evaluate(vector)
        if (trial > damage + 1e-12) {
          damage = trial
          counts[from]! -= 1
          counts[to]! += 1
          improved = true
        } else {
          vector[a.index]! += a.value
          vector[b.index]! -= b.value
        }
      }
    }
    if (!improved) break
  }
  return { damage, counts, vector }
}

export interface IdealRules {
  substatsPerEcho: number
  /** "max": every substat at its highest roll. "mean": at its average roll, weighted by the published chances. */
  roll: 'max' | 'mean'
}

export interface IdealLoadout {
  damage: number
  vector: Float64Array
  /** Chosen main stat per slot, as listed in the Echo stat tables. */
  mainStats: EchoStatTables['mainStats'][EchoCost][number][]
  /** Copies of each substat, parallel to EchoStatTables.substats. */
  substatCounts: number[]
  /** Value of one copy of each substat under the rules, parallel to EchoStatTables.substats. */
  substatValues: number[]
}

const MAX_COMBINATIONS = 5000

/** Best main stats and substats for the given slot costs, under the rules. */
export function searchIdealLoadout(
  compiled: CompiledRotation,
  costs: readonly EchoCost[],
  tables: EchoStatTables,
  rules: IdealRules,
): IdealLoadout {
  const useful = compiled.touchedKeys
  const fixed = new Float64Array(ECHO_STAT_KEYS.length)
  for (const cost of costs) fixed[echoStatIndex(tables.fixedStats[cost].stat)]! += tables.fixedStats[cost].value

  // Main stat options per slot: only those that can change damage (or the first, when none can).
  const options = costs.map((cost) => {
    const all = tables.mainStats[cost]
    const helpful = all.filter((main) => useful.has(echoStatIndex(main.stat, main.scope)))
    return helpful.length > 0 ? helpful : all.slice(0, 1)
  })

  const substatValues = tables.substats.map((row) =>
    rules.roll === 'max' ? Math.max(...row.rolls) : row.rolls.reduce((sum, roll, i) => sum + roll * (row.chances[i] ?? 0), 0),
  )
  const candidates: (SubstatCandidate & { row: number })[] = tables.substats
    .map((row, i) => ({ row: i, index: echoStatIndex(row.stat, row.scope), value: substatValues[i] ?? 0 }))
    .filter((candidate) => useful.has(candidate.index) && candidate.index !== echoStatIndex('energyRegen'))

  // Every combination of main stats, treating slots of the same cost as interchangeable.
  const combos: number[][] = [[]]
  for (let slot = 0; slot < costs.length; slot += 1) {
    const next: number[][] = []
    for (const combo of combos) {
      const previousSame = costs.slice(0, slot).lastIndexOf(costs[slot]!)
      const start = previousSame >= 0 ? (combo[previousSame] ?? 0) : 0
      for (let option = start; option < (options[slot]?.length ?? 0); option += 1) next.push([...combo, option])
    }
    combos.splice(0, combos.length, ...next)
    if (combos.length > MAX_COMBINATIONS) throw new Error('Too many main stat combinations to search')
  }

  let best: IdealLoadout | null = null
  for (const combo of combos) {
    const base = Float64Array.from(fixed)
    const mains = combo.map((option, slot) => options[slot]![option]!)
    for (const main of mains) base[echoStatIndex(main.stat, main.scope)]! += main.value
    const picks = costs.length * rules.substatsPerEcho
    const result = bestSubstatCounts((v) => compiled.evaluate(v), base, picks, costs.length, candidates)
    if (!best || result.damage > best.damage) {
      const substatCounts = tables.substats.map(() => 0)
      candidates.forEach((candidate, i) => (substatCounts[candidate.row] = result.counts[i] ?? 0))
      best = { damage: result.damage, vector: result.vector, mainStats: mains, substatCounts, substatValues }
    }
  }
  if (!best) throw new Error('No Echo layout to search')
  return best
}
