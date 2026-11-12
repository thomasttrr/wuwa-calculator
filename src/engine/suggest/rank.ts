// Suggestions: every alternative is re-simulated with the full engine. Nothing is estimated.
import { compileRotation, ECHO_STAT_KEYS, echoStatIndex, stripEchoStats } from '../compiled/compile'
import { simulateRotation } from '../rotation/simulate'
import type { Build } from '../types/build'
import type { Catalog } from '../types/catalog'
import { applyChange, changeKey, mainStatOption } from './change'
import type { Change, SuggestOptions } from './change'

export interface Suggestion {
  change: Change
  /** The build with the change made. */
  build: Build
  /** Rotation average damage with the change. */
  damage: number
  /** Damage gained, as a fraction of the build it was measured against. */
  gain: number
}

const damageOf = (build: Build, catalog: Catalog) => simulateRotation(build, catalog).total.average

function measure(base: Build, baseDamage: number, changes: readonly Change[], catalog: Catalog, options: SuggestOptions): Suggestion[] {
  return changes
    .map((change) => {
      const build = applyChange(base, change, catalog, options)
      const damage = damageOf(build, catalog)
      return { change, build, damage, gain: baseDamage > 0 ? damage / baseDamage - 1 : 0 }
    })
    .sort((a, b) => b.gain - a.gain)
}

export function rankWeapons(build: Build, catalog: Catalog, options: SuggestOptions = {}): Suggestion[] {
  const type = catalog.resonators[build.resonator.id]?.weaponType
  const owned = options.ownedWeaponIds ? new Set(options.ownedWeaponIds) : null
  const changes: Change[] = Object.values(catalog.weapons)
    .filter((w) => w.weaponType === type && w.id !== build.weapon?.id && (!owned || owned.has(w.id)))
    .map((w) => ({ kind: 'weapon', weaponId: w.id, rank: 1 }))
  return measure(build, damageOf(build, catalog), changes, catalog, options)
}

export function rankMainStats(build: Build, catalog: Catalog, options: SuggestOptions = {}): Suggestion[] {
  const changes: Change[] = []
  build.echoes.forEach((echo, slot) => {
    if (!echo) return
    const current = mainStatOption(echo, catalog)
    catalog.echoStats.mainStats[echo.cost].forEach((_, option) => {
      if (option !== current) changes.push({ kind: 'mainStat', slot, option })
    })
  })
  return measure(build, damageOf(build, catalog), changes, catalog, options)
}

/** The set five Echoes share now, if they all share one. */
function wholeSet(build: Build): number | null {
  const ids = new Set(build.echoes.filter((e) => e !== null).map((e) => e.sonataId))
  return ids.size === 1 && build.echoes.every((e) => e !== null) ? ([...ids][0] ?? null) : null
}

export function rankSets(build: Build, catalog: Catalog, options: SuggestOptions = {}): Suggestion[] {
  if (build.echoes.every((e) => e === null)) return []
  const current = wholeSet(build)
  const changes: Change[] = Object.values(catalog.sonatas)
    .filter((s) => s.id !== current)
    .map((s) => ({ kind: 'set', sonataId: s.id }))
  return measure(build, damageOf(build, catalog), changes, catalog, options)
}

export interface SubstatValue {
  /** Row of `catalog.echoStats.substats`. */
  row: number
  /** Damage gained by one more roll at the published average value, as a fraction. */
  perRoll: number
  /** Share of current damage that this stat on your Echoes gives, measured by taking it all away. */
  share: number
  /** How many of your Echoes carry it. */
  count: number
}

export function rankSubstats(build: Build, catalog: Catalog): SubstatValue[] {
  const now = damageOf(build, catalog)
  const first = build.echoes.findIndex((e) => e !== null)
  if (first < 0 || now <= 0) return []
  const same = (row: (typeof catalog.echoStats.substats)[number], sub: { stat: string; scope?: unknown }) =>
    row.stat === sub.stat && JSON.stringify(row.scope ?? null) === JSON.stringify(sub.scope ?? null)

  return catalog.echoStats.substats
    .map((row, index) => {
      const mean = row.rolls.reduce((sum, roll, i) => sum + roll * (row.chances[i] ?? 0), 0)
      const added: Build = {
        ...build,
        echoes: build.echoes.map((e, slot) =>
          e && slot === first ? { ...e, substats: [...e.substats, { stat: row.stat, ...(row.scope ? { scope: row.scope } : {}), value: mean }] } : e,
        ),
      }
      const without: Build = { ...build, echoes: build.echoes.map((e) => (e ? { ...e, substats: e.substats.filter((s) => !same(row, s)) } : e)) }
      const count = build.echoes.filter((e) => e?.substats.some((s) => same(row, s))).length
      const perRoll = Math.max(0, damageOf(added, catalog) / now - 1)
      return { row: index, perRoll: perRoll < 1e-12 ? 0 : perRoll, share: count > 0 ? 1 - damageOf(without, catalog) / now : 0, count }
    })
    .sort((a, b) => b.perRoll - a.perRoll)
}

const MAX_MAIN_COMBOS = 20000

/** The best main stat in each slot for this build, keeping its substats. Exhaustive when small enough. */
export function bestMainStats(build: Build, catalog: Catalog): (number | null)[] {
  const compiled = compileRotation(stripEchoStats(build), catalog)
  const base = new Float64Array(ECHO_STAT_KEYS.length)
  for (const echo of build.echoes) {
    if (!echo) continue
    base[echoStatIndex(echo.fixedStat.stat)]! += echo.fixedStat.value
    for (const sub of echo.substats) base[echoStatIndex(sub.stat, sub.scope)]! += sub.value
  }
  const slots = build.echoes.map((echo) => {
    if (!echo) return null
    const all = catalog.echoStats.mainStats[echo.cost].map((main, option) => ({ option, index: echoStatIndex(main.stat, main.scope), value: main.value }))
    const helpful = all.filter((o) => compiled.touchedKeys.has(o.index))
    return helpful.length > 0 ? helpful : [all[Math.max(0, mainStatOption(echo, catalog))]!]
  })
  const total = slots.reduce((n, s) => n * (s?.length ?? 1), 1)
  const choice = slots.map(() => 0)
  const evaluate = () => {
    const v = Float64Array.from(base)
    slots.forEach((s, i) => {
      const o = s?.[choice[i] ?? 0]
      if (o) v[o.index]! += o.value
    })
    return compiled.evaluate(v)
  }

  let best = -Infinity
  let bestChoice = [...choice]
  if (total <= MAX_MAIN_COMBOS) {
    for (let n = 0; n < total; n += 1) {
      let rest = n
      slots.forEach((s, i) => {
        const len = s?.length ?? 1
        choice[i] = rest % len
        rest = Math.floor(rest / len)
      })
      const d = evaluate()
      if (d > best) {
        best = d
        bestChoice = [...choice]
      }
    }
  } else {
    best = evaluate()
    for (let improved = true; improved; ) {
      improved = false
      slots.forEach((s, i) => {
        for (let o = 0; o < (s?.length ?? 0); o += 1) {
          const keep = choice[i]!
          choice[i] = o
          const d = evaluate()
          if (d > best + 1e-12) {
            best = d
            improved = true
          } else choice[i] = keep
        }
      })
    }
    bestChoice = [...choice]
  }
  return slots.map((s, i) => (s ? (s[bestChoice[i] ?? 0]?.option ?? null) : null))
}

function mainChanges(build: Build, catalog: Catalog): Change[] {
  return bestMainStats(build, catalog).flatMap((option, slot): Change[] => {
    const echo = build.echoes[slot]
    return echo && option !== null && option !== mainStatOption(echo, catalog) ? [{ kind: 'mainStat', slot, option }] : []
  })
}

/** Weapon, set and main stats chosen together: the top few weapons and sets, each with its best main stats. */
export function rankWholeBuilds(build: Build, catalog: Catalog, options: SuggestOptions = {}, keep = 10): Suggestion[] {
  const weapons: (Change | null)[] = [null, ...rankWeapons(build, catalog, options).slice(0, 5).map((s) => s.change)]
  const sets: (Change | null)[] = [null, ...rankSets(build, catalog, options).slice(0, 5).map((s) => s.change)]
  const seen = new Set<string>()
  const changes: Change[] = []
  for (const weapon of weapons) {
    for (const set of sets) {
      const head = [weapon, set].filter((c): c is Change => c !== null)
      const partial = head.reduce((b, c) => applyChange(b, c, catalog, options), build)
      const all = [...head, ...mainChanges(partial, catalog)]
      if (all.length === 0) continue
      const change: Change = { kind: 'combo', changes: all }
      const key = changeKey(change)
      if (seen.has(key)) continue
      seen.add(key)
      changes.push(change)
    }
  }
  return measure(build, damageOf(build, catalog), changes, catalog, options).slice(0, keep)
}

export interface UpgradeStep extends Suggestion {
  /** Gain over the build before the first step, as a fraction. */
  totalGain: number
}

const MEANINGFUL = 0.001

/** Apply the single best change, re-rank, repeat. Each step's gain is over the step before it. */
export function upgradePath(build: Build, catalog: Catalog, options: SuggestOptions = {}, steps = 3): UpgradeStep[] {
  const start = damageOf(build, catalog)
  const used = new Set<string>()
  const path: UpgradeStep[] = []
  let current = build
  for (let step = 0; step < steps; step += 1) {
    const candidates = [...rankWeapons(current, catalog, options), ...rankSets(current, catalog, options), ...rankMainStats(current, catalog, options)]
      .filter((s) => !used.has(changeKey(s.change)) && s.gain >= MEANINGFUL)
      .sort((a, b) => b.gain - a.gain)
    const best = candidates[0]
    if (!best) break
    used.add(changeKey(best.change))
    path.push({ ...best, totalGain: start > 0 ? best.damage / start - 1 : 0 })
    current = best.build
  }
  return path
}
