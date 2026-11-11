// Shared helpers for engine tests that run against the real catalog.
import { AUTHORED_EFFECTS } from '../../../data/authored/effects'
import { loadCatalog } from '../../../scripts/data/load-catalog'
import type { Build, EchoInstance, EnemyConfig } from '../../../src/engine/types/build'
import type { Element } from '../../../src/engine/types/stats'

export const catalog = loadCatalog(AUTHORED_EFFECTS)

export function enemy(level: number, resistance = 0.1): EnemyConfig {
  const all = Object.fromEntries(
    (['physical', 'glacio', 'fusion', 'electro', 'aero', 'spectro', 'havoc'] as Element[]).map((e) => [e, resistance]),
  ) as Record<Element, number>
  return { name: `Level ${level} target`, level, resistance: all }
}

/** A level 90 build with nothing equipped and every skill at level 1. Override what a test needs. */
export function bareBuild(resonatorId: number, overrides: Partial<Build> = {}): Build {
  return {
    id: 'test',
    name: 'Test build',
    resonator: {
      id: resonatorId,
      level: 90,
      ascended: false,
      sequence: 0,
      skillLevels: { normal: 1, skill: 1, forte: 1, liberation: 1, intro: 1 },
      traceNodeIds: [],
    },
    weapon: null,
    echoes: [null, null, null, null, null],
    teammates: [null, null],
    effects: {},
    customModifiers: [],
    enemy: enemy(90),
    rotation: { id: 'r', name: 'Rotation', items: [] },
    ...overrides,
  }
}

export const allTraceNodeIds = (resonatorId: number): number[] =>
  (catalog.resonators[resonatorId]?.traceNodes ?? []).map((node) => node.id)

export const maxSkills = { normal: 10, skill: 10, forte: 10, liberation: 10, intro: 10 } as const

let echoCounter = 0
/** An Echo with the legal fixed stat for its cost filled in from the catalog. */
export function echo(partial: Omit<EchoInstance, 'uid' | 'fixedStat'>): EchoInstance {
  const fixed = catalog.echoStats.fixedStats[partial.cost]
  echoCounter += 1
  return { uid: `echo-${echoCounter}`, fixedStat: { stat: fixed.stat, value: fixed.value }, ...partial }
}

/** First Echo of the given cost that can belong to the given Sonata set. */
export function echoIdIn(sonataName: string, cost: 1 | 3 | 4): { echoId: number; sonataId: number } {
  const sonata = Object.values(catalog.sonatas).find((s) => s.name === sonataName)
  if (!sonata) throw new Error(`No Sonata set named ${sonataName}`)
  const found = Object.values(catalog.echoes).find((e) => e.cost === cost && e.sonataIds.includes(sonata.id))
  if (!found) throw new Error(`No ${cost}-cost Echo in ${sonataName}`)
  return { echoId: found.id, sonataId: sonata.id }
}
