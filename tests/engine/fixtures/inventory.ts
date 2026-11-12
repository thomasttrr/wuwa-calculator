// Random Echo inventories for optimizer tests, reproducible by seed.
import { createSampleBuild } from '../../../src/data/sample-build'
import type { EchoInstance } from '../../../src/engine/types/build'
import { catalog } from './builds'
import { randomInventory } from './inventory-core'

const sample = createSampleBuild(catalog)

/** A random inventory drawn from three sets, the sample's own among them. */
export function inventory(seed: number, size: number): EchoInstance[] {
  return randomInventory(catalog, sample, seed, size)
}
