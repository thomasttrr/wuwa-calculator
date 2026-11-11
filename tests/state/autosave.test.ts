import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startAutosave } from '../../src/state/persist/autosave'
import { createWorkspaceStore, emptyWorkspace } from '../../src/state/store'
import type { Workspace } from '../../src/state/types'
import { bareBuild } from '../engine/fixtures/builds'

describe('autosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function setup() {
    const store = createWorkspaceStore(emptyWorkspace())
    const saved: Workspace[] = []
    const save = vi.fn(async (workspace: Workspace) => void saved.push(workspace))
    const autosave = startAutosave(store, save, 300)
    return { store, saved, save, autosave }
  }

  it('saves 300ms after the last change, once for a burst of changes', async () => {
    const { store, save, autosave } = setup()
    store.getState().addBuild({ ...bareBuild(1402), id: 'a', name: 'A' })
    store.getState().applyEdit((d) => void (d.resonator.level = 80), 'Level 80')
    store.getState().applyEdit((d) => void (d.resonator.level = 70), 'Level 70')
    await vi.advanceTimersByTimeAsync(299)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
    autosave.stop()
  })

  it('a flush saves straight away (used when the tab is hidden or closed)', async () => {
    const { store, saved, autosave } = setup()
    store.getState().addBuild({ ...bareBuild(1402), id: 'a', name: 'A' })
    await autosave.flush()
    expect(saved).toHaveLength(1)
    expect(saved[0]?.library.order).toEqual(['a'])
    autosave.stop()
  })

  it('a preview alone does not trigger a save, and is never written', async () => {
    const { store, save, autosave } = setup()
    store.getState().addBuild({ ...bareBuild(1402), id: 'a', name: 'A' })
    await autosave.flush()
    save.mockClear()
    store.getState().setPreview((d) => void (d.resonator.sequence = 6), 'Try')
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).not.toHaveBeenCalled()
    autosave.stop()
  })

  it('reports a failed save instead of hiding it', async () => {
    const store = createWorkspaceStore(emptyWorkspace())
    const errors: string[] = []
    const autosave = startAutosave(store, async () => Promise.reject(new Error('Quota exceeded')), 300, (message) => errors.push(message))
    store.getState().addBuild({ ...bareBuild(1402), id: 'a', name: 'A' })
    await vi.advanceTimersByTimeAsync(300)
    expect(errors).toEqual(['Your changes could not be saved in this browser: Quota exceeded'])
    autosave.stop()
  })
})
