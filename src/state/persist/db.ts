// Browser storage (IndexedDB). One record holds the whole workspace.
import { openDB } from 'idb'
import type { Workspace } from '../types'
import { migrate } from './migrations'

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

export async function saveWorkspace(workspace: Workspace): Promise<void> {
  const db = await database()
  await db.put(STORE, workspace, KEY)
  db.close()
}

/** The saved workspace, brought up to date, or null when nothing is saved. */
export async function loadWorkspace(): Promise<Workspace | null> {
  const db = await database()
  const raw: unknown = await db.get(STORE, KEY)
  db.close()
  return raw === undefined ? null : migrate(raw)
}

export async function clearWorkspace(): Promise<void> {
  const db = await database()
  await db.delete(STORE, KEY)
  db.close()
}
