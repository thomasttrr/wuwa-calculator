// The Optimizer: the best Echoes for a build, from a list of candidates. Exact: branch and bound,
// checked against trying every combination (tests/engine/optimize/search.test.ts).
//
// A result is a main Echo plus up to four more, total cost at most 12. Its damage is the compiled
// evaluator for its main Echo and set bonuses, applied to the sum of its Echo stats.
import { compileRotation, echoStatIndex, echoStatVector, stripEchoStats } from '../compiled/compile'
import type { CompiledRotation, CompileTarget } from '../compiled/compile'
import { COST_BUDGET } from '../score/ideal'
import { resolveBaseStats } from '../stats/base'
import { collectModifiers } from '../stats/collect'
import { computeStatSheet } from '../stats/sheet'
import { mainStatOption } from '../suggest/change'
import type { Build, EchoInstance, EchoSubstat, EffectStates } from '../types/build'
import type { Catalog, EchoCost } from '../types/catalog'
import type { StatSheet } from '../types/stats'

export type LimitStat = 'energyRegen' | 'critRate' | 'critDmg' | 'atk'

export interface StatLimit {
  stat: LimitStat
  /** Fractions for rates (1.2 is 120%), plain numbers for ATK. */
  min?: number
  max?: number
}

export interface OptimizerSettings {
  target: CompileTarget
  /** How many results to keep, best first. */
  keep: number
  /** When set, the main Echo must be this kind of Echo. */
  lockMainEchoId: number | null
  allowedSonataIds: readonly number[] | null
  /** Allowed main stats per cost, as rows of the main stat table. Absent cost: all allowed. */
  allowedMains: Partial<Record<EchoCost, readonly number[]>> | null
  limits: readonly StatLimit[]
  /** Switch every set and Echo effect fully on, instead of the build's own switches. */
  assumeConditionsMet: boolean
}

export function defaultSettings(): OptimizerSettings {
  return {
    target: { kind: 'rotation' },
    keep: 10,
    lockMainEchoId: null,
    allowedSonataIds: null,
    allowedMains: null,
    limits: [],
    assumeConditionsMet: false,
  }
}

export interface OptimizerProblem {
  build: Build
  candidates: readonly EchoInstance[]
  /** Stats added to every result, for generated Echoes that carry none of their own. */
  extraSubstats?: readonly EchoSubstat[]
  settings: OptimizerSettings
}

export interface OptimizerResult {
  /** Indices into problem.candidates; the first is the main Echo. */
  echoes: number[]
  damage: number
}

interface Entry {
  compiled: CompiledRotation
  sheet: StatSheet
}

const SLOT = {
  energyRegen: echoStatIndex('energyRegen'),
  critRate: echoStatIndex('critRate'),
  critDmg: echoStatIndex('critDmg'),
  atkPct: echoStatIndex('atkPct'),
  atkFlat: echoStatIndex('atkFlat'),
}

function limitValue(sheet: StatSheet, v: Float64Array, stat: LimitStat): number {
  switch (stat) {
    case 'energyRegen':
      return sheet.energyRegen.total + v[SLOT.energyRegen]!
    case 'critRate':
      return sheet.critRate.total + v[SLOT.critRate]!
    case 'critDmg':
      return sheet.critDmg.total + v[SLOT.critDmg]!
    case 'atk':
      return sheet.atk.base * (1 + sheet.atk.percent.total + v[SLOT.atkPct]!) + sheet.atk.flat.total + v[SLOT.atkFlat]!
  }
}

/** Every set and Echo effect fully on, everything else as the build has it. */
function conditionsMet(build: Build, catalog: Catalog): EffectStates {
  const next: Record<string, { on: boolean; stacks?: number }> = {
    ...build.effects,
  }
  for (const effect of catalog.effects) {
    if (effect.owner.kind !== 'sonata' && effect.owner.kind !== 'echo') continue
    if (effect.control.kind === 'toggle') next[effect.id] = { on: true }
    else if (effect.control.kind === 'stacks') next[effect.id] = { on: true, stacks: effect.control.max }
  }
  return next
}

export interface Prepared {
  problem: OptimizerProblem
  /** Candidates allowed as the main Echo, best first. */
  mains: number[]
  /** Candidates allowed in the other slots, in search order (best first). */
  order: number[]
  vectors: Float64Array[]
  extra: Float64Array
  costs: number[]
  /** Dense index of each candidate's set. */
  setOf: number[]
  setCount: number
  /**
   * For each cost (0: 1-cost, 1: 3-cost, 2: 4-cost) and position p, the sum of the r largest values
   * of each stat among order[p..] of that cost: index (r - 1) * width + stat.
   */
  tops: Float64Array[][]
  /** Dense sets present among order[p..], per cost class. */
  suffixSets: number[][][]
  evaluator(mainEchoId: number, counts: Int32Array): Entry
}

const MAX_COUNT = 10
/** Echo costs, one table per cost so the bound can respect the cost budget. */
const CLASS_COST = [1, 3, 4] as const

export function prepareProblem(problem: OptimizerProblem, catalog: Catalog, options: { dominance?: boolean } = {}): Prepared {
  const { settings, candidates } = problem
  const effects = settings.assumeConditionsMet ? conditionsMet(problem.build, catalog) : problem.build.effects
  const base = stripEchoStats({
    ...problem.build,
    effects,
    echoes: [null, null, null, null, null],
  })

  const vectors = candidates.map((echo) => echoStatVector([echo]))
  const extra = echoStatVector([
    problem.extraSubstats?.length
      ? {
          uid: 'extra',
          echoId: 0,
          cost: 1,
          sonataId: 0,
          mainStat: { stat: 'atkFlat', value: 0 },
          fixedStat: { stat: 'atkFlat', value: 0 },
          substats: problem.extraSubstats,
        }
      : null,
  ])
  const width = extra.length
  const costs = candidates.map((echo) => echo.cost)

  // Sets in play, densely numbered, and which piece counts change anything for each.
  const setIds = [...new Set(candidates.map((e) => e.sonataId))]
  const dense = new Map(setIds.map((id, d) => [id, d]))
  const setOf = candidates.map((e) => dense.get(e.sonataId)!)
  const thresholds = setIds.map((id) => {
    const t = new Set<number>()
    for (const effect of catalog.sonatas[id]?.effects ?? []) t.add(effect.pieces)
    for (const effect of catalog.effects) if (effect.owner.kind === 'sonata' && effect.owner.id === id) t.add(effect.owner.pieces)
    return [...t].sort((a, b) => a - b)
  })
  const capTable = thresholds.map((t) => Array.from({ length: MAX_COUNT + 1 }, (_, n) => t.filter((x) => x <= n).at(-1) ?? 0))

  // Evaluators by (main Echo, active thresholds). Looked up by a numeric hash, then confirmed
  // against the stored thresholds, because building a text key for every check is slow.
  const cache = new Map<number, { main: number; caps: Uint8Array; entry: Entry }[]>()
  const caps = new Uint8Array(setIds.length)
  const evaluator = (mainEchoId: number, counts: Int32Array): Entry => {
    let hash = mainEchoId | 0
    for (let d = 0; d < counts.length; d += 1) {
      const t = capTable[d]![Math.min(counts[d]!, MAX_COUNT)]!
      caps[d] = t
      hash = (Math.imul(hash, 31) + t) | 0
    }
    const bucket = cache.get(hash)
    let entry = bucket?.find((b) => b.main === mainEchoId && b.caps.every((t, d) => t === caps[d]))?.entry
    if (!entry) {
      const override: Record<number, number> = {}
      for (let d = 0; d < counts.length; d += 1) {
        const t = capTable[d]![Math.min(counts[d]!, MAX_COUNT)]!
        if (t > 0) override[setIds[d]!] = t
      }
      const mainDef = catalog.echoes[mainEchoId]
      const frame: Build = {
        ...base,
        piecesOverride: override,
        echoes: [
          mainDef
            ? {
                uid: 'frame',
                echoId: mainEchoId,
                cost: mainDef.cost,
                sonataId: 0,
                mainStat: { stat: 'atkPct', value: 0 },
                fixedStat: { stat: 'atkFlat', value: 0 },
                substats: [],
              }
            : null,
          null,
          null,
          null,
          null,
        ],
      }
      entry = {
        compiled: compileRotation(frame, catalog, settings.target),
        sheet: computeStatSheet(resolveBaseStats(frame, catalog), collectModifiers(frame, catalog)),
      }
      const list = bucket ?? []
      list.push({ main: mainEchoId, caps: Uint8Array.from(caps), entry })
      cache.set(hash, list)
    }
    return entry
  }

  const allowed = candidates
    .map((echo, i) => ({ echo, i }))
    .filter(({ echo }) => {
      if (settings.allowedSonataIds && !settings.allowedSonataIds.includes(echo.sonataId)) return false
      const mains = settings.allowedMains?.[echo.cost]
      return !mains || mains.includes(mainStatOption(echo, catalog))
    })
    .map(({ i }) => i)

  // Search order: best alone first, so good results are found early and the cut-off rises fast.
  const plain = evaluator(problem.build.echoes[0]?.echoId ?? 0, new Int32Array(setIds.length))
  const alone = vectors.map((v) => {
    const w = Float64Array.from(v)
    for (let k = 0; k < width; k += 1) w[k]! += extra[k]!
    return plain.compiled.evaluate(w)
  })
  const byValue = (a: number, b: number) => alone[b]! - alone[a]! || a - b

  // An Echo beaten on every stat that matters by enough others of the same kind and set can never
  // be needed: any result using it can swap in one of them that is not already used.
  let kept = allowed
  const hasMax = settings.limits.some((l) => l.max !== undefined)
  if ((options.dominance ?? true) && !hasMax) {
    const slots = [...new Set([...plain.compiled.touchedKeys, ...Object.values(SLOT)])]
    const need = settings.keep + 5
    kept = allowed.filter((a) => {
      let beaten = 0
      for (const b of allowed) {
        if (a === b || candidates[a]!.echoId !== candidates[b]!.echoId || candidates[a]!.sonataId !== candidates[b]!.sonataId) continue
        const va = vectors[a]!
        const vb = vectors[b]!
        let ge = true
        let gt = false
        for (const s of slots) {
          if (vb[s]! < va[s]!) ge = false
          else if (vb[s]! > va[s]!) gt = true
        }
        if (ge && (gt || b < a)) beaten += 1
        if (beaten >= need) return false
      }
      return true
    })
  }

  const order = [...kept].sort(byValue)
  const mains = order.filter((i) => settings.lockMainEchoId === null || candidates[i]!.echoId === settings.lockMainEchoId)

  // Suffix tables, built from the end: per cost class, the four best values of each stat.
  const n = order.length
  const tops: Float64Array[][] = CLASS_COST.map(() => Array.from({ length: n + 1 }, () => new Float64Array(4 * width)))
  const suffixSets: number[][][] = CLASS_COST.map(() => Array.from({ length: n + 1 }, () => []))
  CLASS_COST.forEach((cost, c) => {
    const best = new Float64Array(4 * width) // best[j * width + k]: j-th largest value of stat k
    const sets = new Set<number>()
    for (let p = n - 1; p >= 0; p -= 1) {
      const idx = order[p]!
      if (costs[idx]! === cost) {
        const v = vectors[idx]!
        for (let k = 0; k < width; k += 1) {
          let x = v[k]!
          for (let j = 0; j < 4; j += 1) {
            const at = j * width + k
            if (x > best[at]!) {
              const keep = best[at]!
              best[at] = x
              x = keep
            }
          }
        }
        sets.add(setOf[idx]!)
      }
      const sums = tops[c]![p]!
      for (let k = 0; k < width; k += 1) {
        let running = 0
        for (let r = 0; r < 4; r += 1) {
          running += best[r * width + k]!
          sums[r * width + k] = running
        }
      }
      suffixSets[c]![p] = [...sets]
    }
  })

  return {
    problem,
    mains,
    order,
    vectors,
    extra,
    costs,
    setOf,
    setCount: setIds.length,
    tops,
    suffixSets,
    evaluator,
  }
}

export type Unit = readonly [main: number, second: number]

/** The work, cut into pieces: each main Echo alone, then each main Echo with each possible second Echo. */
export function planUnits(prepared: Prepared): Unit[] {
  const units: Unit[] = []
  for (const m of prepared.mains) {
    units.push([m, -1])
    prepared.order.forEach((idx, p) => {
      if (idx !== m && prepared.costs[m]! + prepared.costs[idx]! <= COST_BUDGET) units.push([m, p])
    })
  }
  return units
}

export interface SearchOptions {
  shouldStop?: () => boolean
  /** A cut-off found elsewhere (other workers): results below it are not wanted. */
  getCutoff?: () => number
  onProgress?: (unitsDone: number) => void
  onResult?: (result: OptimizerResult) => void
}

export interface SearchRun {
  results: OptimizerResult[]
  stopped: boolean
  nodes: number
}

const keyOf = (echoes: readonly number[]) =>
  `${echoes[0]}|${echoes
    .slice(1)
    .sort((a, b) => a - b)
    .join(',')}`

/** Damage equal to this relative tolerance is a tie: the order of additions can differ in the last bits. */
const TIE = 1e-9
export const below = (value: number, cutoff: number) => value < cutoff - Math.abs(cutoff) * TIE

export class TopResults {
  readonly list: (OptimizerResult & { key: string })[] = []
  constructor(readonly keep: number) {}
  get cutoff(): number {
    return this.list.length >= this.keep ? this.list[this.keep - 1]!.damage : -Infinity
  }
  offer(echoes: readonly number[], damage: number): boolean {
    if (below(damage, this.cutoff)) return false
    const key = keyOf(echoes)
    if (this.list.some((r) => r.key === key)) return false
    this.list.push({ echoes: [...echoes], damage, key })
    this.list.sort((a, b) => (Math.abs(a.damage - b.damage) <= Math.abs(a.damage) * TIE ? a.key.localeCompare(b.key) : b.damage - a.damage))
    if (this.list.length > this.keep) this.list.length = this.keep
    return this.list.some((r) => r.key === key)
  }
  results(): OptimizerResult[] {
    return this.list.map(({ echoes, damage }) => ({ echoes, damage }))
  }
}

export function searchUnits(prepared: Prepared, units: readonly Unit[], options: SearchOptions = {}): SearchRun {
  const { problem, order, vectors, costs, tops, suffixSets, evaluator, extra, setOf, setCount } = prepared
  const candidates = problem.candidates
  const limits = problem.settings.limits
  const top = new TopResults(problem.settings.keep)
  const width = extra.length
  const vec = new Float64Array(width)
  const tmp = new Float64Array(width)
  const chosen: number[] = []
  const counts = new Int32Array(setCount)
  const optimistic = new Int32Array(setCount)
  const kinds = new Map<number, number>() // set * 1e8 + echoId -> copies chosen
  let nodes = 0
  let stopped = false
  let mainEchoId = 0
  let costLeft = 0

  const cutoff = () => Math.max(top.cutoff, options.getCutoff?.() ?? -Infinity)

  const add = (i: number, sign: 1 | -1) => {
    const v = vectors[i]!
    for (let k = 0; k < width; k += 1) vec[k]! += sign * v[k]!
    const d = setOf[i]!
    const kind = d * 1e8 + candidates[i]!.echoId
    const before = kinds.get(kind) ?? 0
    const after = before + sign
    if (after === 0) kinds.delete(kind)
    else kinds.set(kind, after)
    if (before === 0 && after === 1) counts[d]! += 1
    else if (before === 1 && after === 0) counts[d]! -= 1
    costLeft -= sign * costs[i]!
    if (sign > 0) chosen.push(i)
    else chosen.pop()
  }

  const breaksMax = (entry: Entry) => limits.some((l) => l.max !== undefined && limitValue(entry.sheet, vec, l.stat) > l.max + 1e-12)

  /** Evaluate the current selection as a result. False when it breaks a maximum (so must every extension). */
  const visit = (): boolean => {
    nodes += 1
    const entry = evaluator(mainEchoId, counts)
    if (breaksMax(entry)) return false
    if (limits.every((l) => l.min === undefined || limitValue(entry.sheet, vec, l.stat) >= l.min - 1e-12)) {
      const damage = entry.compiled.evaluate(vec)
      if (!below(damage, cutoff()) && top.offer(chosen, damage)) options.onResult?.({ echoes: [...chosen], damage })
    }
    return true
  }

  /**
   * Best damage any extension can reach by taking up to `r` more Echoes from order[p..]: for every
   * mix of 4-, 3- and 1-cost Echoes that fits the cost left, the best few values of each stat in
   * each cost, with every set bonus those Echoes could still complete. The highest of these.
   */
  const bound = (p: number, r: number): number => {
    let best = -Infinity
    const one = tops[0]![p]!
    const three = tops[1]![p]!
    const four = tops[2]![p]!
    for (let a = Math.min(r, Math.floor(costLeft / 4)); a >= 0; a -= 1) {
      for (let b = Math.min(r - a, Math.floor((costLeft - 4 * a) / 3)); b >= 0; b -= 1) {
        const c = Math.min(r - a - b, costLeft - 4 * a - 3 * b)
        if (a + b + c === 0) continue
        for (let k = 0; k < width; k += 1) {
          tmp[k] = vec[k]! + (a > 0 ? four[(a - 1) * width + k]! : 0) + (b > 0 ? three[(b - 1) * width + k]! : 0) + (c > 0 ? one[(c - 1) * width + k]! : 0)
        }
        optimistic.set(counts)
        const take = a + b + c
        for (const [cls, used] of [
          [2, a],
          [1, b],
          [0, c],
        ] as const)
          if (used > 0) for (const d of suffixSets[cls]![p]!) optimistic[d]! += take
        const entry = evaluator(mainEchoId, optimistic)
        if (limits.some((l) => l.min !== undefined && limitValue(entry.sheet, tmp, l.stat) < l.min - 1e-12)) continue
        const value = entry.compiled.evaluate(tmp)
        if (value > best) best = value
      }
    }
    return best
  }

  const dfs = (from: number) => {
    const r = 5 - chosen.length
    if (r === 0 || costLeft <= 0) return
    for (let q = from; q < order.length; q += 1) {
      if ((nodes & 4095) === 0 && options.shouldStop?.()) {
        stopped = true
        return
      }
      const idx = order[q]!
      if (idx === chosen[0] || costs[idx]! > costLeft) continue
      if (below(bound(q, r), cutoff())) break
      add(idx, 1)
      if (visit()) dfs(q + 1)
      add(idx, -1)
      if (stopped) return
    }
  }

  let done = 0
  for (const [m, second] of units) {
    if (options.shouldStop?.()) {
      stopped = true
      break
    }
    mainEchoId = candidates[m]!.echoId
    vec.set(extra)
    counts.fill(0)
    kinds.clear()
    chosen.length = 0
    costLeft = COST_BUDGET
    add(m, 1)
    if (second < 0) visit()
    else if (!below(bound(second, 4), cutoff())) {
      add(order[second]!, 1)
      if (visit()) dfs(second + 1)
    }
    done += 1
    options.onProgress?.(done)
    if (stopped) break
  }
  return { results: top.results(), stopped, nodes }
}

/** Search everything on this thread. */
export function searchAll(problem: OptimizerProblem, catalog: Catalog, options: SearchOptions = {}): SearchRun {
  const prepared = prepareProblem(problem, catalog)
  return searchUnits(prepared, planUnits(prepared), options)
}

/** Every combination, no pruning. The test oracle. */
export function bruteForce(problem: OptimizerProblem, catalog: Catalog): OptimizerResult[] {
  const prepared = prepareProblem(problem, catalog, { dominance: false })
  const { order, mains, vectors, costs, extra, evaluator, setOf, setCount } = prepared
  const candidates = problem.candidates
  const top = new TopResults(problem.settings.keep)
  const others = [...order].sort((a, b) => a - b)
  const check = (picked: number[]) => {
    const v = Float64Array.from(extra)
    const distinct = new Map<number, Set<number>>()
    for (const i of picked) {
      vectors[i]!.forEach((x, k) => (v[k]! += x))
      const set = distinct.get(setOf[i]!) ?? new Set<number>()
      set.add(candidates[i]!.echoId)
      distinct.set(setOf[i]!, set)
    }
    const counts = new Int32Array(setCount)
    for (const [d, s] of distinct) counts[d] = s.size
    const entry = evaluator(candidates[picked[0]!]!.echoId, counts)
    for (const l of problem.settings.limits) {
      const value = limitValue(entry.sheet, v, l.stat)
      if ((l.min !== undefined && value < l.min - 1e-12) || (l.max !== undefined && value > l.max + 1e-12)) return
    }
    top.offer(picked, entry.compiled.evaluate(v))
  }
  const walk = (picked: number[], from: number, cost: number) => {
    check(picked)
    if (picked.length === 5) return
    for (let q = from; q < others.length; q += 1) {
      const idx = others[q]!
      if (idx === picked[0] || cost + costs[idx]! > COST_BUDGET) continue
      walk([...picked, idx], q + 1, cost + costs[idx]!)
    }
  }
  for (const m of mains) walk([m], 0, costs[m]!)
  return top.results()
}

/** Damage of a build's own Echoes under the same settings (target, conditions) as a search, to compare results with. */
export function damageUnderSettings(build: Build, catalog: Catalog, settings: OptimizerSettings): number {
  const effects = settings.assumeConditionsMet ? conditionsMet(build, catalog) : build.effects
  const own = { ...build, effects }
  return compileRotation(stripEchoStats(own), catalog, settings.target).evaluate(echoStatVector(build.echoes))
}

/** The build a result describes: main Echo in slot 1, the rest after it. Extra substats ride on the main Echo. */
export function buildFromResult(problem: OptimizerProblem, result: OptimizerResult, catalog?: Catalog): Build {
  const echoes = result.echoes.map((i, slot) => {
    const echo = problem.candidates[i]!
    return slot === 0 && problem.extraSubstats?.length ? { ...echo, substats: [...echo.substats, ...problem.extraSubstats] } : echo
  })
  const effects = problem.settings.assumeConditionsMet && catalog ? conditionsMet(problem.build, catalog) : problem.build.effects
  return {
    ...problem.build,
    effects,
    echoes: [...echoes, ...Array.from({ length: 5 - echoes.length }, () => null)],
  }
}
