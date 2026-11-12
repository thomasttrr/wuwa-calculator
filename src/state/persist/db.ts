// Browser storage (IndexedDB). One record holds the whole workspace and the time it was saved.
import { openDB } from 'idb'
import type { Workspace } from '../types'
import { migrate } from './migrations'
import type { Stamped } from './pending'

const DB_NAME = 'thewuthering'
const STORE = 'workspace'
const KEY = 'current'

export interface SaveIdentity {
  /** Counts up with every completed save, across tabs. */
  revision: number
  /** The tab that wrote it. */
  writer: string
}

function database() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    },
  })
}

export async function saveWorkspace(workspace: Workspace, savedAt = Date.now(), identity?: SaveIdentity): Promise<void> {
  const db = await database()
  await db.put(STORE, { savedAt, workspace, ...(identity ? { revision: identity.revision, writer: identity.writer } : {}) }, KEY)
  db.close()
}

/** The saved record with its time, brought up to date, or null when nothing is saved. */
export async function loadStamped(): Promise<Stamped | null> {
  const db = await database()
  const raw: unknown = await db.get(STORE, KEY)
  db.close()
  if (raw === undefined) return null
  const record = raw as { savedAt?: unknown; workspace?: unknown; revision?: unknown; writer?: unknown }
  const identity =
    typeof record.revision === 'number' && typeof record.writer === 'string'
      ? { revision: record.revision, writer: record.writer }
      : undefined
  if (typeof record.savedAt === 'number' && record.workspace !== undefined) {
    return { savedAt: record.savedAt, workspace: migrate(record.workspace), ...identity }
  }
  // Records written before the save time was stored.
  return { savedAt: 0, workspace: migrate(raw), ...identity }
}

export async function loadWorkspace(): Promise<Workspace | null> {
  return (await loadStamped())?.workspace ?? null
}

export async function clearWorkspace(): Promise<void> {
  const db = await database()
  await db.delete(STORE, KEY)
  db.close()
}
