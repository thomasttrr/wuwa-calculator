// Writes data/authored/effects/generated.json (effects read from game descriptions) and
// data/authored/effects/not-modelled.json (sentences that were not read, shown in the app).
// Run after data:build. Part of `npm run data:build`.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CORE_RESONATOR_IDS } from '../../data/authored/core-set'
import { extractEffects } from './extract-effects'
import { loadCatalog, loadManifest } from './load-catalog'

const catalog = loadCatalog()
const { effects, unparsed } = extractEffects(catalog, { coreResonatorIds: CORE_RESONATOR_IDS })

const dir = resolve('data/authored/effects')
mkdirSync(dir, { recursive: true })
const header = { gameVersion: loadManifest().gameVersion, generatedBy: 'scripts/data/build-effects.ts' }
writeFileSync(resolve(dir, 'generated.json'), `${JSON.stringify({ ...header, effects }, null, 1)}\n`)
writeFileSync(resolve(dir, 'not-modelled.json'), `${JSON.stringify({ ...header, sentences: unparsed }, null, 1)}\n`)

const count = (kind: string) => effects.filter((effect) => effect.owner.kind === kind).length
const owners = (kind: string) => new Set(effects.filter((effect) => effect.owner.kind === kind).map((effect) => effect.owner.id)).size
console.log(
  JSON.stringify(
    {
      effects: effects.length,
      byOwner: { weapon: count('weapon'), sonata: count('sonata'), resonator: count('resonator'), echo: count('echo') },
      weaponsCovered: `${owners('weapon')} of ${Object.values(catalog.weapons).filter((w) => w.rarity >= 4).length}`,
      sentencesNotModelled: unparsed.length,
    },
    null,
    2,
  ),
)
