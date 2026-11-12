// Generated Echoes: what to aim for, rather than what you own. For each allowed set, Echoes of each
// cost with each useful main stat and no substats; your current substats are kept as one fixed total.
// The main Echo stays the kind you have. Two kinds per cost and set, so five pieces are possible.
import { compileRotation, echoStatIndex, stripEchoStats } from '../compiled/compile'
import type { Build, EchoInstance, EchoSubstat } from '../types/build'
import type { Catalog, EchoCost } from '../types/catalog'

export interface Generated {
  candidates: EchoInstance[]
  extraSubstats: EchoSubstat[]
  /** The main Echo's kind, which every result keeps. */
  mainEchoId: number | null
}

const COSTS: readonly EchoCost[] = [4, 3, 1]

export function generateCandidates(build: Build, catalog: Catalog, sonataIds: readonly number[]): Generated {
  const tables = catalog.echoStats
  const touched = compileRotation(stripEchoStats(build), catalog).touchedKeys
  const usefulMains = (cost: EchoCost) => {
    const all = tables.mainStats[cost].map((main, option) => ({
      main,
      option,
    }))
    const useful = all.filter(({ main }) => touched.has(echoStatIndex(main.stat, main.scope)))
    return useful.length > 0 ? useful : all.slice(0, 1)
  }
  const make = (echoId: number, cost: EchoCost, sonataId: number, option: number): EchoInstance => {
    const main = tables.mainStats[cost][option]!
    return {
      uid: `gen-${echoId}-${sonataId}-${option}`,
      echoId,
      cost,
      sonataId,
      mainStat: {
        stat: main.stat,
        ...(main.scope ? { scope: main.scope } : {}),
        value: main.value,
      },
      fixedStat: {
        stat: tables.fixedStats[cost].stat,
        value: tables.fixedStats[cost].value,
      },
      substats: [],
    }
  }

  const candidates: EchoInstance[] = []
  const mainEcho = build.echoes[0]
  const mainDef = mainEcho ? catalog.echoes[mainEcho.echoId] : undefined
  if (mainDef) {
    for (const sonataId of mainDef.sonataIds.filter((id) => sonataIds.includes(id))) {
      for (const { option } of usefulMains(mainDef.cost)) candidates.push(make(mainDef.id, mainDef.cost, sonataId, option))
    }
  }
  for (const sonataId of sonataIds) {
    for (const cost of COSTS) {
      const kinds = Object.values(catalog.echoes)
        .filter((e) => e.cost === cost && e.sonataIds.includes(sonataId) && e.id !== mainDef?.id)
        .sort((a, b) => a.id - b.id)
        .slice(0, 2)
      for (const kind of kinds) for (const { option } of usefulMains(cost)) candidates.push(make(kind.id, cost, sonataId, option))
    }
  }

  const extraSubstats = build.echoes.flatMap((echo) => echo?.substats ?? [])
  return { candidates, extraSubstats, mainEchoId: mainDef?.id ?? null }
}
