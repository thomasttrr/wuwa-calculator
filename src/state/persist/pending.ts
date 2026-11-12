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
  /** Present on saves written since tabs started comparing revisions. */
  revision?: number
  writer?: string
}

/** Never throws: a full or blocked storage only means there is no backup. */
export function writePending(storage: StorageLike, workspace: Workspace, savedAt: number, identity?: { revision: number; writer: string }): void {
  try {
    // Only the identity is copied: a caller's own `savedAt` (the last completed save) must not
    // replace the time this backup was taken, or an edit made just before leaving loses the tie-break.
    storage.setItem(
      KEY,
      JSON.stringify({
        savedAt,
        workspace,
        ...(identity ? { revision: identity.revision, writer: identity.writer } : {}),
      }),
    )
  } catch {
    // Storage full or blocked: the IndexedDB save is still attempted.
  }
}

export function readPending(storage: StorageLike): Stamped | null {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { savedAt?: unknown; workspace?: unknown; revision?: unknown; writer?: unknown }
    if (typeof parsed.savedAt !== 'number') return null
    return {
      savedAt: parsed.savedAt,
      workspace: migrate(parsed.workspace),
      ...(typeof parsed.revision === 'number' ? { revision: parsed.revision } : {}),
      ...(typeof parsed.writer === 'string' ? { writer: parsed.writer } : {}),
    }
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

/**
 * The newer of the saved copy and the backup. Revision wins over time, so a stale backup
 * written by a second tab cannot replace a newer save. Equal revisions fall back to time.
 */
export function choosePending(saved: Stamped | null, pending: Stamped | null): Workspace | null {
  if (!saved) return pending?.workspace ?? null
  if (!pending) return saved.workspace
  const pendingRevision = pending.revision ?? 0
  const savedRevision = saved.revision ?? 0
  if (pendingRevision !== savedRevision) return pendingRevision > savedRevision ? pending.workspace : saved.workspace
  return pending.savedAt > saved.savedAt ? pending.workspace : saved.workspace
}
