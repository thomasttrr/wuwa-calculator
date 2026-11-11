// Browser storage (IndexedDB). One record holds the whole workspace and the time it was saved.
import { openDB } from 'idb'
import type { Workspace } from '../types'
import { migrate } from './migrations'
import type { Stamped } from './pending'

const DB_NAME = 'thewuthering'
const STORE = 'workspace'
const KEY = 'current'

function database() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    },
  })
}

export async function saveWorkspace(workspace: Workspace, savedAt = Date.now()): Promise<void> {
  const db = await database()
  await db.put(STORE, { savedAt, workspace }, KEY)
  db.close()
}

/** The saved record with its time, brought up to date, or null when nothing is saved. */
export async function loadStamped(): Promise<Stamped | null> {
  const db = await database()
  const raw: unknown = await db.get(STORE, KEY)
  db.close()
  if (raw === undefined) return null
  const record = raw as { savedAt?: unknown; workspace?: unknown }
  if (typeof record.savedAt === 'number' && record.workspace !== undefined) {
    return { savedAt: record.savedAt, workspace: migrate(record.workspace) }
  }
  // Records written before the save time was stored.
  return { savedAt: 0, workspace: migrate(raw) }
}

export async function loadWorkspace(): Promise<Workspace | null> {
  return (await loadStamped())?.workspace ?? null
}

export async function clearWorkspace(): Promise<void> {
  const db = await database()
  await db.delete(STORE, KEY)
  db.close()
}
