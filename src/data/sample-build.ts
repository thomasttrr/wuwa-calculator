// The build loaded on first run: Jiyan with Verdant Summit, a full Sierra Gale set and ordinary
// mid-range substats, so there is something real to improve. Every stat is a legal value from
// the Echo stat tables (tests/data/sample-build.test.ts checks this).
import type { Build, EchoInstance, EchoSubstat } from '../engine/types/build'
import type { Catalog, EchoCost } from '../engine/types/catalog'
import { defaultBuildFor } from './defaults'

const JIYAN = 1404
const VERDANT_SUMMIT = 21010016
const VERINA = 1503
const SIERRA_GALE = 4

function echoNamed(catalog: Catalog, name: string, cost: EchoCost): number {
  const found = Object.values(catalog.echoes).find((echo) => echo.name === name && echo.cost === cost)
  if (!found) throw new Error(`No ${cost}-cost Echo named ${name}`)
  return found.id
}

/** A substat by its game label, at a roll tier (0 is the lowest roll). */
function sub(catalog: Catalog, label: string, tier: number): EchoSubstat {
  const table = catalog.echoStats.substats.find((row) => row.label === label)
  const value = table?.rolls[tier]
  if (!table || value === undefined) throw new Error(`No ${label} roll at tier ${tier}`)
  return { stat: table.stat, ...(table.scope ? { scope: table.scope } : {}), value }
}

function main(catalog: Catalog, cost: EchoCost, label: string) {
  const row = catalog.echoStats.mainStats[cost].find((entry) => entry.label === label)
  if (!row) throw new Error(`No ${label} main stat on a ${cost}-cost Echo`)
  return { stat: row.stat, ...(row.scope ? { scope: row.scope } : {}), value: row.value }
}

export function createSampleBuild(catalog: Catalog): Build {
  const fixed = (cost: EchoCost) => ({ stat: catalog.echoStats.fixedStats[cost].stat, value: catalog.echoStats.fixedStats[cost].value })
  const echo = (uid: string, name: string, cost: EchoCost, mainLabel: string, subs: EchoSubstat[]): EchoInstance => ({
    uid,
    echoId: echoNamed(catalog, name, cost),
    cost,
    sonataId: SIERRA_GALE,
    mainStat: main(catalog, cost, mainLabel),
    fixedStat: fixed(cost),
    substats: subs,
  })

  const echoes: EchoInstance[] = [
    echo('sample-1', 'Feilian Beringal', 4, 'Crit. Rate', [
      sub(catalog, 'Crit. DMG', 3),
      sub(catalog, 'ATK%', 4),
      sub(catalog, 'Heavy Attack DMG Bonus', 3),
      sub(catalog, 'Energy Regen', 2),
      sub(catalog, 'ATK', 1),
    ]),
    echo('sample-2', 'Hoochief', 3, 'Aero DMG Bonus', [
      sub(catalog, 'Crit. Rate', 2),
      sub(catalog, 'Crit. DMG', 4),
      sub(catalog, 'ATK%', 3),
      sub(catalog, 'HP', 2),
      sub(catalog, 'DEF%', 1),
    ]),
    echo('sample-3', 'Carapace', 3, 'Aero DMG Bonus', [
      sub(catalog, 'Crit. Rate', 4),
      sub(catalog, 'ATK%', 2),
      sub(catalog, 'Resonance Liberation DMG Bonus', 3),
      sub(catalog, 'DEF', 1),
      sub(catalog, 'Crit. DMG', 2),
    ]),
    echo('sample-4', 'Hooscamp', 1, 'ATK%', [
      sub(catalog, 'Crit. Rate', 1),
      sub(catalog, 'Crit. DMG', 3),
      sub(catalog, 'Heavy Attack DMG Bonus', 2),
      sub(catalog, 'HP%', 2),
      sub(catalog, 'ATK', 2),
    ]),
    echo('sample-5', 'Chirpuff', 1, 'ATK%', [
      sub(catalog, 'Crit. DMG', 5),
      sub(catalog, 'ATK%', 1),
      sub(catalog, 'Energy Regen', 3),
      sub(catalog, 'Basic Attack DMG Bonus', 2),
      sub(catalog, 'DEF', 2),
    ]),
  ]

  const base = defaultBuildFor(JIYAN, catalog, 'Sample build: Jiyan')
  return {
    ...base,
    weapon: { id: VERDANT_SUMMIT, level: 90, ascended: false, rank: 1 },
    echoes,
    teammates: [{ resonatorId: VERINA, sequence: 0, sonatas: [] }, null],
    effects: {
      'sonata:4:5p:1': { on: true },
      'echo:6000043:1': { on: true },
      'weapon:21010016:2': { on: true, stacks: 2 },
      'teammate0:resonator:1503:k1000305:1': { on: true },
      'teammate0:resonator:1503:k1000309:1': { on: true },
    },
  }
}
