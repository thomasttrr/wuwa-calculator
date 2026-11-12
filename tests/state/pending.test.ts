import { describe, expect, it } from 'vitest'
import { choosePending, clearPending, readPending, writePending } from '../../src/state/persist/pending'
import { emptyWorkspace } from '../../src/state/store'

// When a tab closes, an IndexedDB write still in flight can be abandoned. The app also writes a
// synchronous backup to local storage on leaving, and on start keeps whichever copy is newer.

function fakeStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

describe('pending backup', () => {
  it('writes and reads back a workspace with its time', () => {
    const storage = fakeStorage()
    const workspace = emptyWorkspace()
    writePending(storage, workspace, 1000)
    expect(readPending(storage)).toEqual({ savedAt: 1000, workspace })
    clearPending(storage)
    expect(readPending(storage)).toBeNull()
  })

  it('keeps the revision and writer with the backup', () => {
    const storage = fakeStorage()
    const workspace = emptyWorkspace()
    writePending(storage, workspace, 1000, { revision: 4, writer: 'tab-a' })
    expect(readPending(storage)).toEqual({ savedAt: 1000, revision: 4, writer: 'tab-a', workspace })
  })

  it('stamps the backup with the leave time, not the last completed save', () => {
    const storage = fakeStorage()
    const workspace = emptyWorkspace()
    // Callers pass their last save metadata; its savedAt is older than this backup.
    const identity = { revision: 4, writer: 'tab-a', savedAt: 500 }
    writePending(storage, workspace, 1000, identity)
    expect(readPending(storage)).toEqual({ savedAt: 1000, revision: 4, writer: 'tab-a', workspace })
  })

  it('prefers a newer revision even when a stale tab wrote a newer timestamp', () => {
    const stale = { savedAt: 3000, revision: 2, writer: 'tab-b', workspace: { ...emptyWorkspace(), meta: { ...emptyWorkspace().meta, firstRunDismissed: true } } }
    const newest = { savedAt: 2000, revision: 3, writer: 'tab-a', workspace: emptyWorkspace() }
    expect(choosePending(newest, stale)).toBe(newest.workspace)
    expect(choosePending(stale, newest)).toBe(newest.workspace)
  })

  it('prefers the backup only when it is newer than the saved copy', () => {
    const older = { savedAt: 1000, workspace: emptyWorkspace() }
    const newer = { savedAt: 2000, workspace: { ...emptyWorkspace(), meta: { ...emptyWorkspace().meta, firstRunDismissed: true } } }
    expect(choosePending(older, newer)).toBe(newer.workspace)
    expect(choosePending(newer, older)).toBe(newer.workspace)
    expect(choosePending(null, older)).toBe(older.workspace)
    expect(choosePending(older, null)).toBe(older.workspace)
    expect(choosePending(null, null)).toBeNull()
  })

  it('ignores a backup it cannot read, and survives a full or blocked storage', () => {
    const storage = fakeStorage()
    storage.setItem('thewuthering:pending', '{not json')
    expect(readPending(storage)).toBeNull()
    const full = { ...fakeStorage(), setItem: () => { throw new Error('QuotaExceededError') } }
    expect(() => writePending(full, emptyWorkspace(), 1)).not.toThrow()
  })
})
