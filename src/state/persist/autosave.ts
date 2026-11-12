import { toSaved } from '../store'
import type { WorkspaceStore } from '../store'
import type { Workspace } from '../types'

export interface Autosave {
  /** Saves now, cancelling any pending save. */
  flush(): Promise<void>
  /** True when there are changes not yet written. */
  isDirty(): boolean
  /** Throws away a pending save without writing it (used after adopting another tab's version). */
  discardPending(): void
  stop(): void
}

/**
 * Saves the workspace a short delay after the last saved-state change. Preview changes are
 * ignored: a preview is never written. Failures go to `onError` in plain words.
 * `canSave` can hold a save back (a second tab saved a newer version); the change stays dirty.
 */
export function startAutosave(
  store: WorkspaceStore,
  save: (workspace: Workspace) => Promise<void>,
  delayMs = 300,
  onError: (message: string) => void = () => {},
  canSave: () => boolean = () => true,
): Autosave {
  let timer: ReturnType<typeof setTimeout> | undefined
  let dirty = false

  const run = async () => {
    timer = undefined
    if (!dirty) return
    if (!canSave()) return
    dirty = false
    try {
      await save(toSaved(store.getState()))
    } catch (error) {
      dirty = true
      onError(`Your changes could not be saved in this browser: ${(error as Error).message}`)
    }
  }

  const unsubscribe = store.subscribe((state, previous) => {
    const savedChanged =
      state.library !== previous.library ||
      state.history !== previous.history ||
      state.meta !== previous.meta ||
      state.session.activeBuildId !== previous.session.activeBuildId
    if (!savedChanged) return
    dirty = true
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => void run(), delayMs)
  })

  return {
    async flush() {
      if (timer !== undefined) clearTimeout(timer)
      dirty = true
      await run()
    },
    isDirty() {
      return dirty || timer !== undefined
    },
    discardPending() {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      dirty = false
    },
    stop() {
      if (timer !== undefined) clearTimeout(timer)
      unsubscribe()
    },
  }
}
