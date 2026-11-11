// A synchronous backup written when the page is hidden or closed, because an IndexedDB write
// still in flight at that moment can be abandoned by the browser.
import type { Workspace } from '../types'
import { migrate } from './migrations'

const KEY = 'thewuthering:pending'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface Stamped {
  savedAt: number
  workspace: Workspace
}

/** Never throws: a full or blocked storage only means there is no backup. */
export function writePending(storage: StorageLike, workspace: Workspace, savedAt: number): void {
  try {
    storage.setItem(KEY, JSON.stringify({ savedAt, workspace }))
  } catch {
    // Storage full or blocked: the IndexedDB save is still attempted.
  }
}

export function readPending(storage: StorageLike): Stamped | null {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { savedAt?: unknown; workspace?: unknown }
    if (typeof parsed.savedAt !== 'number') return null
    return { savedAt: parsed.savedAt, workspace: migrate(parsed.workspace) }
  } catch {
    return null
  }
}

export function clearPending(storage: StorageLike): void {
  try {
    storage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}

/** The newer of the saved copy and the backup. */
export function choosePending(saved: Stamped | null, pending: Stamped | null): Workspace | null {
  if (!saved) return pending?.workspace ?? null
  if (!pending) return saved.workspace
  return pending.savedAt > saved.savedAt ? pending.workspace : saved.workspace
}
