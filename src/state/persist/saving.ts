// Saving with two tabs open. Every completed save carries a revision and the tab that wrote it.
// Another tab's newer save is never overwritten without telling the user first.
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import { emptyWorkspace, toSaved } from '../store'
import type { WorkspaceStore } from '../store'
import type { Workspace } from '../types'
import { startAutosave } from './autosave'
import type { Autosave } from './autosave'
import type { Stamped } from './pending'

export const SAVE_CHANNEL_KEY = 'thewuthering:save-meta'

export interface SaveMeta {
  revision: number
  /** The tab that wrote the save. */
  writer: string
  savedAt: number
}

export interface SavingState {
  /** Set when another tab saved a newer version while this one has changes. */
  conflict: SaveMeta | null
  revision: number
  lastSavedAt: number | null
}

export interface SaveChannel {
  publish(meta: SaveMeta): void
  subscribe(listener: (meta: SaveMeta) => void): () => void
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function parseSaveMeta(raw: string | null): SaveMeta | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as { revision?: unknown; writer?: unknown; savedAt?: unknown }
    if (typeof value.revision !== 'number' || typeof value.writer !== 'string' || typeof value.savedAt !== 'number') return null
    return { revision: value.revision, writer: value.writer, savedAt: value.savedAt }
  } catch {
    return null
  }
}

/** Broadcasts completed saves to other tabs through a local-storage key. */
export function createStorageChannel(storage: StorageLike): SaveChannel {
  return {
    publish(meta) {
      try {
        storage.setItem(SAVE_CHANNEL_KEY, JSON.stringify(meta))
      } catch {
        // A blocked storage only means other tabs are not told; saving still works.
      }
    },
    subscribe(listener) {
      // Storage events fire in the other documents, never in the one that wrote the value.
      const onStorage = (event: StorageEvent) => {
        if (event.key !== SAVE_CHANNEL_KEY) return
        const meta = parseSaveMeta(event.newValue)
        if (meta) listener(meta)
      }
      window.addEventListener('storage', onStorage)
      return () => window.removeEventListener('storage', onStorage)
    },
  }
}

export interface SavingController {
  state: StoreApi<SavingState>
  autosave: Autosave
  /** Writes the current state, as an explicit "keep this tab" choice, with a higher revision. */
  keepLocal(): Promise<void>
  /** Replaces this tab's state with the newest save made by another tab. */
  useRemote(): Promise<void>
  /** Replaces the whole workspace (restore) and saves it as the next revision. */
  replaceAll(workspace: Workspace): Promise<void>
  /** Deletes every saved build, rotation, Echo, setting and undo step from this browser. */
  eraseAll(): Promise<void>
  known(): SaveMeta
  isConflicted(): boolean
  stop(): void
}

export interface SavingOptions {
  store: WorkspaceStore
  channel: SaveChannel
  tabId: string
  save: (workspace: ReturnType<typeof toSaved>, meta: SaveMeta) => Promise<void>
  load: () => Promise<Stamped | null>
  initial: SaveMeta
  /** Clears the saved record and the leaving backup (used by "delete everything"). */
  clearStored?: () => Promise<void>
  delayMs?: number
  onError?: (message: string) => void
}

export function startSaving({ store, channel, tabId, save, load, initial, clearStored, delayMs = 300, onError = () => {} }: SavingOptions): SavingController {
  let known: SaveMeta = { ...initial, writer: initial.writer || tabId }
  const state = createStore<SavingState>(() => ({
    conflict: null,
    revision: known.revision,
    lastSavedAt: known.savedAt > 0 ? known.savedAt : null,
  }))

  const write = async (meta: SaveMeta) => {
    await save(toSaved(store.getState()), meta)
    known = meta
    state.setState({ revision: meta.revision, lastSavedAt: meta.savedAt, conflict: null })
    channel.publish(meta)
  }

  const autosave = startAutosave(
    store,
    async (workspace) => {
      const meta: SaveMeta = { revision: known.revision + 1, writer: tabId, savedAt: Date.now() }
      await save(workspace, meta)
      known = meta
      state.setState({ revision: meta.revision, lastSavedAt: meta.savedAt })
      channel.publish(meta)
    },
    delayMs,
    onError,
    () => state.getState().conflict === null,
  )

  const unsubscribe = channel.subscribe((remote) => {
    if (remote.writer === known.writer) return
    if (remote.revision < known.revision) return
    const current = state.getState().conflict
    // Equal revisions from different tabs are a real collision (both tabs saved at once).
    if (remote.revision === known.revision && !current) {
      state.setState({ conflict: remote })
      return
    }
    if (remote.revision > known.revision) state.setState({ conflict: remote })
  })

  return {
    state,
    autosave,
    known: () => known,
    isConflicted: () => state.getState().conflict !== null,
    async keepLocal() {
      const conflict = state.getState().conflict
      if (!conflict) return
      const meta: SaveMeta = { revision: conflict.revision + 1, writer: tabId, savedAt: Date.now() }
      await write(meta)
      // The explicit save already contains every change made in this tab.
      autosave.discardPending()
    },
    async useRemote() {
      const loaded = await load()
      if (!loaded) {
        state.setState({ conflict: null })
        autosave.discardPending()
        return
      }
      store.getState().replaceWorkspace(loaded.workspace)
      known = {
        revision: loaded.revision ?? state.getState().conflict?.revision ?? known.revision,
        writer: loaded.writer ?? tabId,
        savedAt: loaded.savedAt,
      }
      // Replacing the workspace must not immediately save it back as a new revision.
      autosave.discardPending()
      state.setState({ conflict: null, revision: known.revision, lastSavedAt: known.savedAt })
    },
    async replaceAll(workspace) {
      store.getState().replaceWorkspace(workspace)
      const meta: SaveMeta = { revision: known.revision + 1, writer: tabId, savedAt: Date.now() }
      await write(meta)
      autosave.discardPending()
    },
    async eraseAll() {
      autosave.discardPending()
      await clearStored?.()
      const blank = emptyWorkspace()
      const workspace: Workspace = { ...blank, meta: { ...blank.meta, firstRunDismissed: true } }
      store.getState().replaceWorkspace(workspace)
      // A fresh revision and a broadcast stop other tabs from quietly writing their old copy back.
      const meta: SaveMeta = { revision: known.revision + 1, writer: tabId, savedAt: Date.now() }
      try {
        await write(meta)
      } catch (error) {
        onError(`Everything was removed from this tab, but the browser could not record the reset: ${(error as Error).message}`)
        known = { revision: 0, writer: tabId, savedAt: 0 }
        state.setState({ conflict: null, revision: 0, lastSavedAt: null })
      }
      autosave.discardPending()
    },
    stop() {
      unsubscribe()
      autosave.stop()
    },
  }
}
