// Validates every catalog file against its schema. Exits non-zero on the first problem list.
import { loadCatalog, loadManifest } from './load-catalog'
import {
  echoSchema,
  echoStatTablesSchema,
  enemySchema,
  manifestSchema,
  resonatorSchema,
  sonataSchema,
  weaponSchema,
} from '../../src/data/schema'

const problems: string[] = []
const check = (label: string, schema: { safeParse: (value: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown) => {
  const result = schema.safeParse(value)
  if (!result.success) {
    const issue = result.error?.issues[0]
    problems.push(`${label}: ${issue?.path.join('.')} ${issue?.message}`)
  }
}

const manifest = loadManifest()
const catalog = loadCatalog()
check('manifest', manifestSchema, manifest)
for (const r of Object.values(catalog.resonators)) check(`resonator ${r.name}`, resonatorSchema, r)
for (const w of Object.values(catalog.weapons)) check(`weapon ${w.name}`, weaponSchema, w)
for (const e of Object.values(catalog.echoes)) check(`echo ${e.name}`, echoSchema, e)
for (const s of Object.values(catalog.sonatas)) check(`sonata ${s.name}`, sonataSchema, s)
for (const e of Object.values(catalog.enemies)) check(`enemy ${e.name}`, enemySchema, e)
check('echo stat tables', echoStatTablesSchema, catalog.echoStats)

if (problems.length > 0) {
  console.error(problems.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Catalog ${manifest.gameVersion} (data ${manifest.dataDate}) is valid.`)
}
