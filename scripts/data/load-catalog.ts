// Loads the whole catalog from disk, for scripts and tests (Node only).
// The browser app has its own loader in src/data that imports the same files lazily.
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type {
  Catalog,
  EchoDef,
  EchoStatTables,
  EffectDef,
  EnemyDef,
  ResonatorDef,
  SonataDef,
  WeaponDef,
} from '../../src/engine/types/catalog'

const read = <T>(path: string): T => JSON.parse(readFileSync(resolve(path), 'utf8')) as T
const byId = <T extends { id: number }>(items: readonly T[]): Record<number, T> =>
  Object.fromEntries(items.map((item) => [item.id, item]))

export interface Manifest {
  gameVersion: string
  dataDate: string
  sources: { name: string; url: string; role: string }[]
  counts: Record<string, number>
  warnings: string[]
}

export function loadManifest(): Manifest {
  return read<Manifest>('data/game/manifest.json')
}

export function loadCatalog(effects: readonly EffectDef[] = []): Catalog {
  const manifest = loadManifest()
  const dir = `data/game/${manifest.gameVersion}`
  const resonators = readdirSync(resolve(dir, 'resonators')).map((file) => read<ResonatorDef>(`${dir}/resonators/${file}`))
  return {
    gameVersion: manifest.gameVersion,
    dataDate: manifest.dataDate,
    resonators: byId(resonators),
    weapons: byId(read<WeaponDef[]>(`${dir}/weapons.json`)),
    echoes: byId(read<EchoDef[]>(`${dir}/echoes.json`)),
    sonatas: byId(read<SonataDef[]>(`${dir}/sonatas.json`)),
    enemies: byId(read<EnemyDef[]>(`${dir}/enemies.json`)),
    echoStats: read<EchoStatTables>(`${dir}/echo-stat-tables.json`),
    effects,
  }
}
