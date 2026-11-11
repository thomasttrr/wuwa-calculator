// Loads the game catalog in the browser (and in the score worker) from the committed JSON in
// data/game/<version>. Files are split so the first screen does not wait for all of them twice.
import { AUTHORED_EFFECTS } from '../../data/authored/effects'
import notModelled from '../../data/authored/effects/not-modelled.json'
import manifestJson from '../../data/game/manifest.json'
import type {
  Catalog,
  EchoDef,
  EchoStatTables,
  EnemyDef,
  ResonatorDef,
  SonataDef,
  WeaponDef,
} from '../engine/types/catalog'

export interface Manifest {
  gameVersion: string
  dataDate: string
  fetchedAt: string
  sources: { name: string; url: string; role: string }[]
  counts: Record<string, number>
}

export const manifest = manifestJson as unknown as Manifest

export interface NotModelledSentence {
  owner: string
  ownerKind: string
  sentence: string
}

export const NOT_MODELLED = (notModelled as { sentences: NotModelledSentence[] }).sentences

const resonatorFiles = import.meta.glob<ResonatorDef>('../../data/game/*/resonators/*.json', { import: 'default' })
const tableFiles = import.meta.glob('../../data/game/*/*.json', { import: 'default' })

const byId = <T extends { id: number }>(items: readonly T[]): Record<number, T> =>
  Object.fromEntries(items.map((item) => [item.id, item]))

async function table<T>(name: string): Promise<T> {
  const load = tableFiles[`../../data/game/${manifest.gameVersion}/${name}`]
  if (!load) throw new Error(`Missing data file ${name} for patch ${manifest.gameVersion}`)
  return (await load()) as T
}

let cached: Promise<Catalog> | null = null

export function loadCatalog(): Promise<Catalog> {
  cached ??= (async () => {
    const prefix = `../../data/game/${manifest.gameVersion}/resonators/`
    const resonatorLoads = Object.entries(resonatorFiles)
      .filter(([path]) => path.startsWith(prefix))
      .map(([, load]) => load())
    const [resonators, weapons, echoes, sonatas, enemies, echoStats] = await Promise.all([
      Promise.all(resonatorLoads),
      table<WeaponDef[]>('weapons.json'),
      table<EchoDef[]>('echoes.json'),
      table<SonataDef[]>('sonatas.json'),
      table<EnemyDef[]>('enemies.json'),
      table<EchoStatTables>('echo-stat-tables.json'),
    ])
    return {
      gameVersion: manifest.gameVersion,
      dataDate: manifest.dataDate,
      resonators: byId(resonators),
      weapons: byId(weapons),
      echoes: byId(echoes),
      sonatas: byId(sonatas),
      enemies: byId(enemies),
      echoStats,
      effects: AUTHORED_EFFECTS,
    }
  })()
  return cached
}

/** "11 Nov 2026" */
export function formatDataDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}
