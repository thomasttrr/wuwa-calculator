import { describe, expect, it } from 'vitest'
import {
  BACKUP_FORMAT,
  exportBackup,
  exportLibrary,
  fileNameFor,
  parseBackup,
  parseLibraryFile,
} from '../../src/state/library-file'
import { emptyWorkspace } from '../../src/state/store'
import type { SavedRotation, Workspace } from '../../src/state/types'
import { bareBuild, catalog } from '../engine/fixtures/builds'

// Files are the only way data leaves this browser. Every refusal must leave the saved workspace
// untouched and say, in plain words, what to do next.

const build = (id: string, name: string, resonatorId = 1404) => ({ ...bareBuild(resonatorId), id, name })
const rotation = (id: string, resonatorId = 1404): SavedRotation => ({
  id,
  resonatorId,
  rotation: { id: `${id}-rotation`, name: `${id} opener`, items: [] },
  savedAt: '2026-11-11T10:00:00.000Z',
})

function workspaceWith(builds = [build('b1', 'Round trip')], rotations: SavedRotation[] = [rotation('r1')]): Workspace {
  const base = emptyWorkspace()
  return {
    ...base,
    library: {
      ...base.library,
      builds: Object.fromEntries(builds.map((value) => [value.id, value])),
      order: builds.map((value) => value.id),
      rotations,
    },
    session: { ...base.session, activeBuildId: builds[0]?.id ?? null },
  }
}

const fileObject = (text: string) => JSON.parse(text) as Record<string, unknown>

describe('builds and rotations file', () => {
  it('exports every build in the shown order, then every saved rotation', () => {
    const text = exportLibrary(workspaceWith(), catalog, '2026-11-11T12:00:00.000Z')
    const file = fileObject(text)
    expect(file.format).toBe('theWuthering.library')
    expect(file.gameVersion).toBe(catalog.gameVersion)
    expect(file.exportedAt).toBe('2026-11-11T12:00:00.000Z')
    expect((file.builds as { name: string }[]).map((value) => value.name)).toEqual(['Round trip'])
    expect((file.rotations as { id: string }[]).map((value) => value.id)).toEqual(['r1'])
  })

  it('round-trips a file back into the same builds and rotations', () => {
    const parsed = parseLibraryFile(exportLibrary(workspaceWith(), catalog), catalog)
    expect(parsed.builds.map((value) => value.name)).toEqual(['Round trip'])
    expect(parsed.builds[0]?.id).toBe('b1')
    expect(parsed.rotations.map((value) => value.id)).toEqual(['r1'])
  })

  it('refuses a file from another patch, and says which patch it needs', () => {
    const file = fileObject(exportLibrary(workspaceWith(), catalog))
    file.gameVersion = '0.0.0'
    expect(() => parseLibraryFile(JSON.stringify(file), catalog)).toThrow(/patch 0\.0\.0.*patch .*Export it again/s)
  })

  it('refuses a damaged file without touching anything', () => {
    expect(() => parseLibraryFile('{not json', catalog)).toThrow(/could not be read.*damaged/s)
    expect(() => parseLibraryFile('{"format":"something else"}', catalog)).toThrow(/not a theWuthering builds file/)
  })

  it('refuses a build whose name is already here, never overwriting it', () => {
    const existing = [build('other', 'Round trip')]
    expect(() => parseLibraryFile(exportLibrary(workspaceWith(), catalog), catalog, { builds: existing, rotations: [] })).toThrow(
      /already in this browser.*Rename it or delete it/s,
    )
  })

  it('gives a clashing id a new one instead of replacing the saved build', () => {
    const existing = [build('b1', 'Something else')]
    const parsed = parseLibraryFile(exportLibrary(workspaceWith(), catalog), catalog, { builds: existing, rotations: [] })
    expect(parsed.builds[0]?.id).not.toBe('b1')
    expect(parsed.builds[0]?.name).toBe('Round trip')
  })

  it('refuses a Resonator, weapon or Echo this patch does not have', () => {
    const file = fileObject(exportLibrary(workspaceWith(), catalog))
    const builds = file.builds as { resonator: { id: number } }[]
    builds[0]!.resonator.id = 999_999
    expect(() => parseLibraryFile(JSON.stringify(file), catalog)).toThrow(/Resonator this patch does not have/)

    const weaponFile = fileObject(exportLibrary(workspaceWith(), catalog))
    ;(weaponFile.builds as { weapon: unknown }[])[0]!.weapon = { id: 999_999, level: 90, ascended: false, rank: 1 }
    expect(() => parseLibraryFile(JSON.stringify(weaponFile), catalog)).toThrow(/weapon this patch does not have/)
  })
})

describe('whole backup', () => {
  it('round-trips builds, Echoes, rotations, settings and history', () => {
    const workspace = workspaceWith()
    const restored = parseBackup(exportBackup(workspace, catalog), catalog)
    expect(restored.gameVersion).toBe(catalog.gameVersion)
    expect(restored.workspace).toEqual(workspace)
  })

  it('brings an older save up to the current settings shape', () => {
    const old = JSON.parse(JSON.stringify(emptyWorkspace())) as { meta: { schemaVersion: number; settings: Record<string, unknown> } }
    old.meta.schemaVersion = 2
    delete old.meta.settings.defaultTargetLevel
    delete old.meta.settings.defaultResistances
    const text = JSON.stringify({ format: BACKUP_FORMAT, version: 1, gameVersion: catalog.gameVersion, workspace: old })
    const restored = parseBackup(text, catalog)
    expect(restored.workspace.meta.settings.defaultTargetLevel).toBe(100)
    expect(restored.workspace.meta.settings.defaultResistances.glacio).toBe(0.1)
  })

  it('refuses another patch, a damaged file and a workspace with a missing build', () => {
    const file = fileObject(exportBackup(workspaceWith(), catalog))
    file.gameVersion = '0.0.0'
    expect(() => parseBackup(JSON.stringify(file), catalog)).toThrow(/patch 0\.0\.0/)

    expect(() => parseBackup('not json', catalog)).toThrow(/not a theWuthering backup.*damaged/s)

    const damaged = fileObject(exportBackup(workspaceWith(), catalog))
    const workspace = damaged.workspace as { library: { order: string[] } }
    workspace.library.order = ['missing']
    expect(() => parseBackup(JSON.stringify(damaged), catalog)).toThrow(/lists a build it does not contain/)
  })
})

describe('file names', () => {
  it('uses the player name but never a path character', () => {
    const name = fileNameFor('backup', ' A/B: C ', 'json')
    expect(name).toBe('AB-C-backup.json')
    expect(fileNameFor('card', '', 'png')).toBe('card.png')
  })
})
