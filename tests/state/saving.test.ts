import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startSaving } from '../../src/state/persist/saving'
import type { SaveChannel, SaveMeta } from '../../src/state/persist/saving'
import type { Stamped } from '../../src/state/persist/pending'
import { createWorkspaceStore, emptyWorkspace } from '../../src/state/store'
import type { Workspace } from '../../src/state/types'
import { bareBuild } from '../engine/fixtures/builds'

// Two tabs must never silently overwrite one another. These tests drive the controller with a
// fake channel and one stored record, exactly as two tabs would share IndexedDB.

function harness(initialRevision = 1) {
  const store = createWorkspaceStore(emptyWorkspace())
  const listeners = new Set<(meta: SaveMeta) => void>()
  const writes: { workspace: Workspace; meta: SaveMeta }[] = []
  let stored: Stamped | null = null
  let cleared = 0
  const channel: SaveChannel = {
    publish(meta) {
      for (const listener of [...listeners]) listener(meta)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  const saving = startSaving({
    store,
    channel,
    tabId: 'tab-a',
    initial: { revision: initialRevision, writer: 'tab-a', savedAt: 1000 },
    save: async (workspace, meta) => {
      writes.push({ workspace, meta })
      stored = { savedAt: meta.savedAt, workspace, revision: meta.revision, writer: meta.writer }
    },
    load: async () => stored,
    clearStored: async () => {
      cleared += 1
      stored = null
    },
    delayMs: 300,
  })
  const remote = (meta: SaveMeta) => {
    for (const listener of [...listeners]) listener(meta)
  }
  const setStored = (value: Stamped | null) => {
    stored = value
  }
  return { store, saving, writes, remote, setStored, cleared: () => cleared }
}

const build = (id: string, name = id) => ({ ...bareBuild(1404), id, name })

describe('saving: two tabs', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("another tab's newer save raises a conflict and holds autosave back", async () => {
    const { store, saving, writes, remote } = harness(1)
    remote({ revision: 2, writer: 'tab-b', savedAt: 2000 })
    expect(saving.state.getState().conflict).toEqual({ revision: 2, writer: 'tab-b', savedAt: 2000 })

    store.getState().addBuild(build('a'))
    await vi.advanceTimersByTimeAsync(300)
    expect(writes).toHaveLength(0)
    expect(saving.autosave.isDirty()).toBe(true)

    await saving.keepLocal()
    expect(writes).toHaveLength(1)
    expect(writes[0]?.meta).toMatchObject({ revision: 3, writer: 'tab-a' })
    expect(saving.state.getState().conflict).toBeNull()
    expect(saving.state.getState().revision).toBe(3)
    expect(saving.autosave.isDirty()).toBe(false)
    saving.stop()
  })

  it('equal revisions from different tabs are a collision too', () => {
    const { saving, remote } = harness(1)
    remote({ revision: 1, writer: 'tab-b', savedAt: 2000 })
    expect(saving.state.getState().conflict).not.toBeNull()
    saving.stop()
  })

  it('ignores its own save and an older save from another tab', () => {
    const { saving, remote } = harness(3)
    remote({ revision: 3, writer: 'tab-a', savedAt: 3000 })
    expect(saving.state.getState().conflict).toBeNull()
    remote({ revision: 2, writer: 'tab-b', savedAt: 2000 })
    expect(saving.state.getState().conflict).toBeNull()
    saving.stop()
  })

  it("using the other tab's version replaces this tab and does not write it back", async () => {
    const { store, saving, writes, remote, setStored } = harness(1)
    store.getState().addBuild(build('a'))
    await saving.autosave.flush()
    expect(writes).toHaveLength(1)

    remote({ revision: 5, writer: 'tab-b', savedAt: 5000 })
    const remoteWorkspace = { ...emptyWorkspace(), library: { ...emptyWorkspace().library, builds: { b: build('b', 'Other tab') }, order: ['b'] } }
    setStored({ savedAt: 5000, workspace: remoteWorkspace, revision: 5, writer: 'tab-b' })

    await saving.useRemote()
    expect(store.getState().library.order).toEqual(['b'])
    expect(store.getState().library.builds.a).toBeUndefined()
    expect(writes).toHaveLength(1)
    expect(saving.state.getState()).toMatchObject({ conflict: null, revision: 5, lastSavedAt: 5000 })
    expect(saving.autosave.isDirty()).toBe(false)

    store.getState().addBuild(build('c'))
    await vi.advanceTimersByTimeAsync(300)
    expect(writes).toHaveLength(2)
    expect(writes[1]?.meta.revision).toBe(6)
    saving.stop()
  })

  it('keeping this tab saves every change as the next revision', async () => {
    const { store, saving, writes, remote } = harness(4)
    store.getState().addBuild(build('a'))
    remote({ revision: 6, writer: 'tab-b', savedAt: 6000 })
    await saving.keepLocal()
    expect(writes[0]?.workspace.library.order).toEqual(['a'])
    expect(writes[0]?.meta.revision).toBe(7)
    saving.stop()
  })

  it('replacing everything writes the restored workspace as the next revision', async () => {
    const { store, saving, writes } = harness(2)
    const restored = {
      ...emptyWorkspace(),
      meta: { ...emptyWorkspace().meta, firstRunDismissed: true },
      library: { ...emptyWorkspace().library, builds: { r: build('r', 'Restored') }, order: ['r'] },
    }
    await saving.replaceAll(restored)
    expect(store.getState().library.order).toEqual(['r'])
    expect(writes).toHaveLength(1)
    expect(writes[0]?.meta.revision).toBe(3)
    expect(saving.state.getState().conflict).toBeNull()
    saving.stop()
  })

  it('erasing clears storage, leaves an empty workspace, and broadcasts a new revision', async () => {
    const { store, saving, writes, cleared } = harness(2)
    store.getState().addBuild(build('a'))
    await saving.autosave.flush()
    store.getState().addBuild(build('b'))

    await saving.eraseAll()
    expect(cleared()).toBe(1)
    expect(store.getState().library.order).toEqual([])
    expect(store.getState().meta.firstRunDismissed).toBe(true)
    expect(writes.at(-1)?.meta.revision).toBe(4)
    expect(saving.state.getState().revision).toBe(4)
    saving.stop()
  })
})

describe('saving: errors', () => {
  it('reports a failed save in plain words', async () => {
    vi.useFakeTimers()
    const errors: string[] = []
    const store = createWorkspaceStore(emptyWorkspace())
    const saving = startSaving({
      store,
      channel: { publish: () => {}, subscribe: () => () => {} },
      tabId: 'tab-a',
      initial: { revision: 1, writer: 'tab-a', savedAt: 1000 },
      save: async () => Promise.reject(new Error('Quota exceeded')),
      load: async () => null,
      onError: (message) => errors.push(message),
      delayMs: 300,
    })
    store.getState().addBuild(build('a'))
    await vi.advanceTimersByTimeAsync(300)
    expect(errors).toEqual(['Your changes could not be saved in this browser: Quota exceeded'])
    saving.stop()
    vi.useRealTimers()
  })
})
