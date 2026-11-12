// Builds and rotations as a file, and a whole-workspace backup. Everything that comes in is
// checked before it touches the saved workspace, and every refusal says what to do next.
import { z } from 'zod'
import type { Build, EchoInstance, Rotation, RotationItem } from '../engine/types/build'
import { DAMAGE_TYPES, ELEMENTS, STAT_KEYS } from '../engine/types/stats'
import type { Catalog } from '../engine/types/catalog'
import type { SavedRotation, Workspace } from './types'
import { migrate } from './persist/migrations'
import { newId } from './store'

export const LIBRARY_FORMAT = 'theWuthering.library'
export const BACKUP_FORMAT = 'theWuthering.backup'
export const FILE_VERSION = 1

const element = z.enum(ELEMENTS)
const statKey = z.enum(STAT_KEYS)
const scope = z
  .object({
    elements: z.array(element).optional(),
    damageTypes: z.array(z.enum(DAMAGE_TYPES)).optional(),
    actionIds: z.array(z.number().int()).optional(),
    tags: z.array(z.string()).optional(),
  })
  .optional()

const statValue = z.object({ stat: statKey, scope, value: z.number() })
const fixedStat = z.object({ stat: statKey, value: z.number() })

const echoSubstat = z.object({ stat: statKey, scope, value: z.number() })
const echoInstance: z.ZodType<EchoInstance> = z.object({
  uid: z.string(),
  echoId: z.number().int(),
  cost: z.union([z.literal(1), z.literal(3), z.literal(4)]),
  sonataId: z.number().int(),
  mainStat: statValue,
  fixedStat,
  substats: z.array(echoSubstat),
})

const teammate = z.object({
  resonatorId: z.number().int(),
  sequence: z.number().int().min(0).max(6),
  weaponId: z.number().int().optional(),
  weaponRank: z.number().int().min(1).max(5).optional(),
  sonatas: z.array(z.tuple([z.number().int(), z.number().int()])),
})

const customModifier = z.object({
  id: z.string(),
  label: z.string(),
  stat: statKey,
  scope,
  value: z.number(),
  on: z.boolean(),
})

const effectChange = z.object({
  effectId: z.string(),
  on: z.boolean(),
  stacks: z.number().int().optional(),
  lasts: z.enum(['onward', 'thisStep']),
})

const rotationStep = z.object({
  kind: z.literal('step'),
  id: z.string(),
  actionId: z.number().int(),
  enabled: z.boolean(),
  note: z.string().optional(),
  seconds: z.number().nonnegative().optional(),
  effectChanges: z.array(effectChange).optional(),
})

const rotationLoop: z.ZodType<Extract<RotationItem, { kind: 'loop' }>> = z.object({
  kind: z.literal('loop'),
  id: z.string(),
  count: z.number().int().min(1).max(99),
  enabled: z.boolean(),
  steps: z.array(rotationStep),
})

const rotation = z.object({
  id: z.string(),
  name: z.string(),
  items: z.array(z.union([rotationStep, rotationLoop])),
}) as z.ZodType<Rotation>

const enemy = z.object({
  enemyId: z.number().int().optional(),
  name: z.string(),
  level: z.number().int().min(1).max(120),
  resistance: z.object({
    physical: z.number(),
    glacio: z.number(),
    fusion: z.number(),
    electro: z.number(),
    aero: z.number(),
    spectro: z.number(),
    havoc: z.number(),
  }),
})

const build: z.ZodType<Build> = z.object({
  id: z.string(),
  name: z.string(),
  resonator: z.object({
    id: z.number().int(),
    level: z.number().int().min(1).max(90),
    ascended: z.boolean(),
    sequence: z.number().int().min(0).max(6),
    skillLevels: z.object({
      normal: z.number().int().min(1).max(10),
      skill: z.number().int().min(1).max(10),
      forte: z.number().int().min(1).max(10),
      liberation: z.number().int().min(1).max(10),
      intro: z.number().int().min(1).max(10),
    }),
    traceNodeIds: z.array(z.number().int()),
  }),
  weapon: z
    .object({
      id: z.number().int(),
      level: z.number().int().min(1).max(90),
      ascended: z.boolean(),
      rank: z.number().int().min(1).max(5),
    })
    .nullable(),
  echoes: z.array(echoInstance.nullable()).length(5),
  teammates: z.array(teammate.nullable()).length(2),
  effects: z.record(z.string(), z.object({ on: z.boolean(), stacks: z.number().int().optional() })),
  customModifiers: z.array(customModifier),
  enemy,
  rotation,
})

const savedRotation: z.ZodType<SavedRotation> = z.object({
  id: z.string(),
  resonatorId: z.number().int(),
  rotation,
  savedAt: z.string(),
})

const libraryFile = z.object({
  format: z.literal(LIBRARY_FORMAT),
  version: z.literal(FILE_VERSION),
  gameVersion: z.string(),
  exportedAt: z.string().optional(),
  builds: z.array(build),
  rotations: z.array(savedRotation),
})

const patch = z.object({
  op: z.enum(['replace', 'add', 'remove']),
  path: z.array(z.union([z.string(), z.number()])),
  value: z.unknown().optional(),
})

const historyEntry = z.object({ label: z.string(), patches: z.array(patch), inverse: z.array(patch) })
const history = z.record(z.string(), z.object({ past: z.array(historyEntry), future: z.array(historyEntry) }))

const settings = z.object({
  playerName: z.string(),
  playerId: z.string(),
  showEverything: z.boolean(),
  highContrast: z.boolean(),
  reduceMotion: z.boolean(),
  defaultTargetLevel: z.number().int().min(1).max(120),
  defaultResistances: z.object({
    physical: z.number(),
    glacio: z.number(),
    fusion: z.number(),
    electro: z.number(),
    aero: z.number(),
    spectro: z.number(),
    havoc: z.number(),
  }),
})

const workspaceSchema: z.ZodType<Workspace> = z.object({
  library: z.object({
    builds: z.record(z.string(), build),
    order: z.array(z.string()),
    echoInventory: z.array(echoInstance),
    ownedWeaponIds: z.array(z.number().int()),
    rotations: z.array(savedRotation),
  }),
  session: z.object({
    activeBuildId: z.string().nullable(),
    preview: z.any().nullable(),
    toolUi: z.record(z.string(), z.any()),
  }),
  history,
  meta: z.object({
    schemaVersion: z.number().int(),
    firstRunDismissed: z.boolean(),
    settings,
  }),
})

const backupFile = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(FILE_VERSION),
  gameVersion: z.string(),
  exportedAt: z.string().optional(),
  workspace: z.unknown(),
})

export interface Library {
  builds: Build[]
  rotations: SavedRotation[]
}

export interface RestoredBackup {
  workspace: Workspace
  exportedAt?: string
  gameVersion: string
}

function readJson(text: string, what: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`This is not a ${what}: the file could not be read. It may be damaged.`)
  }
}

function checkPatch(gameVersion: string, catalog: Catalog, what: string): void {
  if (gameVersion !== catalog.gameVersion) {
    throw new Error(
      `This ${what} was made for patch ${gameVersion}. This app uses patch ${catalog.gameVersion}. Export it again from this patch, or open it in the matching version.`,
    )
  }
}

function rotationActions(items: readonly RotationItem[]): number[] {
  return items.flatMap((item) => (item.kind === 'loop' ? item.steps.map((step) => step.actionId) : [item.actionId]))
}

/** Every id a build names must exist in this patch, or the numbers would silently change. */
function checkBuild(buildValue: Build, catalog: Catalog): void {
  const label = `"${buildValue.name}"`
  const resonator = catalog.resonators[buildValue.resonator.id]
  if (!resonator) throw new Error(`${label} uses a Resonator this patch does not have.`)
  if (buildValue.weapon && !catalog.weapons[buildValue.weapon.id]) {
    throw new Error(`${label} uses a weapon this patch does not have.`)
  }
  for (const echo of buildValue.echoes) {
    if (!echo) continue
    if (!catalog.echoes[echo.echoId]) throw new Error(`${label} uses an Echo this patch does not have.`)
    if (!catalog.sonatas[echo.sonataId]) throw new Error(`${label} uses a Sonata set this patch does not have.`)
  }
  const known = new Set(resonator.actions.map((action) => action.id))
  const unknown = rotationActions(buildValue.rotation.items).filter((id) => !known.has(id))
  if (unknown.length > 0) {
    throw new Error(`${label} has ${unknown.length === 1 ? 'a rotation step' : 'rotation steps'} ${resonator.name} does not have.`)
  }
}

function checkSavedRotation(saved: SavedRotation, catalog: Catalog): void {
  const resonator = catalog.resonators[saved.resonatorId]
  if (!resonator) throw new Error(`"${saved.rotation.name}" is for a Resonator this patch does not have.`)
  if (Number.isNaN(Date.parse(saved.savedAt))) throw new Error(`"${saved.rotation.name}" has no readable save date.`)
  const known = new Set(resonator.actions.map((action) => action.id))
  const unknown = rotationActions(saved.rotation.items).filter((id) => !known.has(id))
  if (unknown.length > 0) {
    throw new Error(`"${saved.rotation.name}" has ${unknown.length === 1 ? 'a step' : 'steps'} ${resonator.name} does not have.`)
  }
}

function withFreshIds(library: Library, existingBuildIds: ReadonlySet<string>, existingRotationIds: ReadonlySet<string>): Library {
  const buildIds = new Set(existingBuildIds)
  const rotationIds = new Set(existingRotationIds)
  return {
    builds: library.builds.map((value) => {
      if (!buildIds.has(value.id)) {
        buildIds.add(value.id)
        return value
      }
      const id = newId()
      buildIds.add(id)
      return { ...value, id }
    }),
    rotations: library.rotations.map((value) => {
      if (!rotationIds.has(value.id)) {
        rotationIds.add(value.id)
        return value
      }
      const id = newId()
      rotationIds.add(id)
      return { ...value, id }
    }),
  }
}

/** All builds in their shown order, then any build not in the order, plus every saved rotation. */
export function exportLibrary(workspace: Workspace, catalog: Catalog, exportedAt = new Date().toISOString()): string {
  const seen = new Set(workspace.library.order)
  const builds = [
    ...workspace.library.order.map((id) => workspace.library.builds[id]).filter((value): value is Build => value !== undefined),
    ...Object.values(workspace.library.builds).filter((value) => !seen.has(value.id)),
  ]
  return JSON.stringify(
    {
      format: LIBRARY_FORMAT,
      version: FILE_VERSION,
      gameVersion: catalog.gameVersion,
      exportedAt,
      builds,
      rotations: workspace.library.rotations,
    },
    null,
    2,
  )
}

/**
 * Reads a builds-and-rotations file. Refuses a wrong patch, damaged file, duplicate names and
 * anything this patch cannot show. Ids that collide get fresh ids, so an import never overwrites.
 */
export function parseLibraryFile(
  text: string,
  catalog: Catalog,
  existing: { builds: readonly Build[]; rotations: readonly SavedRotation[] } = { builds: [], rotations: [] },
): Library {
  const raw = readJson(text, 'theWuthering builds file')
  const parsed = libraryFile.safeParse(raw)
  if (!parsed.success) throw new Error('This is not a theWuthering builds file. Its contents do not match what the app expects.')
  const file = parsed.data
  checkPatch(file.gameVersion, catalog, 'builds file')

  const names = new Set<string>()
  for (const value of file.builds) {
    const key = value.name.trim().toLocaleLowerCase()
    if (names.has(key)) throw new Error(`This file contains two builds named "${value.name.trim()}". Rename one before importing.`)
    names.add(key)
  }
  const existingNames = new Set(existing.builds.map((value) => value.name.trim().toLocaleLowerCase()))
  for (const value of file.builds) {
    const key = value.name.trim().toLocaleLowerCase()
    if (existingNames.has(key)) {
      throw new Error(`A build named "${value.name.trim()}" is already in this browser. Rename it or delete it before importing.`)
    }
    checkBuild(value, catalog)
    existingNames.add(key)
  }
  for (const value of file.rotations) checkSavedRotation(value, catalog)

  return withFreshIds(
    { builds: file.builds, rotations: file.rotations },
    new Set(existing.builds.map((value) => value.id)),
    new Set(existing.rotations.map((value) => value.id)),
  )
}

/** Everything in this browser, in one file: builds, Echoes, rotations, settings and history. */
export function exportBackup(workspace: Workspace, catalog: Catalog, exportedAt = new Date().toISOString()): string {
  return JSON.stringify(
    { format: BACKUP_FORMAT, version: FILE_VERSION, gameVersion: catalog.gameVersion, exportedAt, workspace },
    null,
    2,
  )
}

/** Reads a whole backup and brings an older save up to date. Never returns a half-checked workspace. */
export function parseBackup(text: string, catalog: Catalog): RestoredBackup {
  const raw = readJson(text, 'theWuthering backup')
  const parsed = backupFile.safeParse(raw)
  if (!parsed.success) throw new Error('This is not a theWuthering backup. Its contents do not match what the app expects.')
  checkPatch(parsed.data.gameVersion, catalog, 'backup')

  let migrated: Workspace
  try {
    migrated = migrate(parsed.data.workspace)
  } catch (error) {
    throw new Error((error as Error).message, { cause: error })
  }
  const checked = workspaceSchema.safeParse(migrated)
  if (!checked.success) throw new Error('This backup is damaged: part of the saved workspace is missing or the wrong shape.')
  const workspace = checked.data
  for (const id of workspace.library.order) {
    if (!workspace.library.builds[id]) throw new Error('This backup is damaged: it lists a build it does not contain.')
  }
  for (const value of Object.values(workspace.library.builds)) checkBuild(value, catalog)
  for (const value of workspace.library.rotations) checkSavedRotation(value, catalog)
  return { workspace, exportedAt: parsed.data.exportedAt, gameVersion: parsed.data.gameVersion }
}

/** Download text as a file. A plain anchor, so no permission prompt and no server. */
export function downloadText(name: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

/** A readable file name from the player's name, never empty. */
export function fileNameFor(prefix: string, playerName: string, suffix: string): string {
  const clean = playerName.replace(/[^\w -]+/g, '').trim().replace(/\s+/g, '-')
  return `${clean ? `${clean}-` : ''}${prefix}.${suffix}`
}
