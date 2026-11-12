import type { Patch } from 'immer'
import type { Build, EchoInstance, Rotation } from '../engine/types/build'

export interface HistoryEntry {
  /** Plain description of the change, shown after an edit and in undo tooltips. */
  label: string
  patches: Patch[]
  inverse: Patch[]
}

export interface BuildHistory {
  past: HistoryEntry[]
  future: HistoryEntry[]
}

export interface Settings {
  playerName: string
  playerId: string
  /** "Show everything" switch: false hides expert controls (they are never removed). */
  showEverything: boolean
  highContrast: boolean
  reduceMotion: boolean
}

export interface SavedRotation {
  id: string
  resonatorId: number
  rotation: Rotation
  /** ISO time it was saved. */
  savedAt: string
}

export interface Workspace {
  library: {
    builds: Record<string, Build>
    order: string[]
    echoInventory: EchoInstance[]
    ownedWeaponIds: number[]
    /** Rotations saved apart from any build, to use again or compare. Since schema 2. */
    rotations: SavedRotation[]
  }
  session: {
    activeBuildId: string | null
    /** A change being tried, shown everywhere but not saved until kept. */
    preview: HistoryEntry | null
    /** Per-tool place memory: open tab, filters, scroll. */
    toolUi: Record<string, unknown>
  }
  history: Record<string, BuildHistory>
  meta: {
    schemaVersion: number
    firstRunDismissed: boolean
    settings: Settings
  }
}
