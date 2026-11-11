import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { loadWorkspace, saveWorkspace, clearWorkspace } from '../../src/state/persist/db'
import { CURRENT_SCHEMA_VERSION, migrate } from '../../src/state/persist/migrations'
import { createWorkspaceStore, emptyWorkspace, selectActiveBuild, toSaved } from '../../src/state/store'
import { bareBuild } from '../engine/fixtures/builds'

describe('persistence', () => {
  it('a saved workspace loads back with its builds and undo history', async () => {
    const store = createWorkspaceStore(emptyWorkspace())
    store.getState().addBuild({ ...bareBuild(1402), id: 'a', name: 'Saved build' })
    store.getState().applyEdit((d) => void (d.resonator.level = 70), 'Level 70')
    await saveWorkspace(toSaved(store.getState()))

    const loaded = await loadWorkspace()
    expect(loaded).not.toBeNull()
    const restored = createWorkspaceStore(loaded ?? emptyWorkspace())
    expect(selectActiveBuild(restored.getState())?.resonator.level).toBe(70)
    restored.getState().undo()
    expect(selectActiveBuild(restored.getState())?.resonator.level).toBe(90)
  })

  it('a preview is never saved', async () => {
    const store = createWorkspaceStore(emptyWorkspace())
    store.getState().addBuild({ ...bareBuild(1402), id: 'a', name: 'B' })
    store.getState().setPreview((d) => void (d.resonator.sequence = 6), 'Try')
    expect(toSaved(store.getState()).session.preview).toBeNull()
  })

  it('clearing removes everything', async () => {
    await saveWorkspace(toSaved(createWorkspaceStore(emptyWorkspace()).getState()))
    await clearWorkspace()
    expect(await loadWorkspace()).toBeNull()
  })
})

describe('migrations', () => {
  it('accepts the current version unchanged', () => {
    const workspace = emptyWorkspace()
    expect(migrate(JSON.parse(JSON.stringify(workspace)))).toEqual(workspace)
  })

  it('refuses a workspace from a newer version of the app, with a plain reason', () => {
    expect(() => migrate({ ...emptyWorkspace(), meta: { ...emptyWorkspace().meta, schemaVersion: CURRENT_SCHEMA_VERSION + 1 } })).toThrow(
      /newer version/,
    )
  })

  it('refuses something that is not a workspace', () => {
    expect(() => migrate({ hello: 'world' })).toThrow(/not a theWuthering save/)
    expect(() => migrate(null)).toThrow(/not a theWuthering save/)
  })
})
