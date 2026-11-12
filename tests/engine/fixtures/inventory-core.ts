// Random Echo inventories, reproducible by seed. No Node imports, so the browser timing script can use it too.
import type { Build, EchoInstance } from '../../../src/engine/types/build'
import type { Catalog, EchoCost } from '../../../src/engine/types/catalog'

/** Small deterministic generator, so a failing inventory can be reproduced. */
function random(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

/** A random inventory drawn from three sets, the sample's own among them. */
export function randomInventory(catalog: Catalog, sample: Build, seed: number, size: number): EchoInstance[] {
  const rnd = random(seed)
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!
  const own = sample.echoes[0]!.sonataId
  const sets = [own, ...Object.values(catalog.sonatas).map((s) => s.id).filter((id) => id !== own).slice(0, 2)]
  const species = Object.values(catalog.echoes).filter((e) => e.sonataIds.some((id) => sets.includes(id)))
  const tables = catalog.echoStats
  return Array.from({ length: size }, (_, i) => {
    const def = pick(species)
    const cost = def.cost as EchoCost
    const main = pick(tables.mainStats[cost])
    // Fisher-Yates, not sort with a random comparator: that depends on the engine's sort and
    // gave Node and the browser different inventories for the same seed.
    const shuffled = [...tables.substats.keys()]
    for (let j = shuffled.length - 1; j > 0; j -= 1) {
      const k = Math.floor(rnd() * (j + 1))
      ;[shuffled[j], shuffled[k]] = [shuffled[k]!, shuffled[j]!]
    }
    const rows = shuffled.slice(0, Math.floor(rnd() * 6))
    return {
      uid: `inv-${seed}-${i}`,
      echoId: def.id,
      cost,
      sonataId: pick(def.sonataIds.filter((id) => sets.includes(id))),
      mainStat: { stat: main.stat, ...(main.scope ? { scope: main.scope } : {}), value: main.value },
      fixedStat: { stat: tables.fixedStats[cost].stat, value: tables.fixedStats[cost].value },
      substats: rows.map((r) => {
        const row = tables.substats[r]!
        return { stat: row.stat, ...(row.scope ? { scope: row.scope } : {}), value: pick(row.rolls) }
      }),
    }
  })
}
