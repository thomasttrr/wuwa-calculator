// The shared build. Every tool reads selectBuildView and edits through applyEdit, so a change
// made anywhere shows everywhere and can be undone. Nothing here imports React.
import { applyPatches, enablePatches, produceWithPatches } from 'immer'
import type { Draft } from 'immer'
import { createStore } from 'zustand/vanilla'
import type { Build } from '../engine/types/build'
import type { BuildHistory, HistoryEntry, Settings, Workspace } from './types'
import { CURRENT_SCHEMA_VERSION } from './persist/migrations'

enablePatches()

export const HISTORY_LIMIT = 100

export type BuildRecipe = (draft: Draft<Build>) => void

export interface WorkspaceActions {
  addBuild(build: Build): void
  switchBuild(id: string): void
  renameBuild(id: string, name: string): void
  /** Returns the new build's id. */
  duplicateBuild(id: string): string
  deleteBuild(id: string): void
  applyEdit(recipe: BuildRecipe, label: string): void
  undo(): void
  redo(): void
  setPreview(recipe: BuildRecipe, label: string): void
  keepPreview(): void
  discardPreview(): void
  dismissFirstRun(): void
  updateSettings(changes: Partial<Settings>): void
  setToolUi(tool: string, value: unknown): void
  /** Replaces the whole workspace (used by import and "delete everything"). */
  replaceWorkspace(workspace: Workspace): void
}

export type WorkspaceState = Workspace & WorkspaceActions

export const DEFAULT_SETTINGS: Settings = {
  playerName: '',
  playerId: '',
  showEverything: false,
  highContrast: false,
  reduceMotion: false,
}

export function emptyWorkspace(): Workspace {
  return {
    library: { builds: {}, order: [], echoInventory: [], ownedWeaponIds: [] },
    session: { activeBuildId: null, preview: null, toolUi: {} },
    history: {},
    meta: { schemaVersion: CURRENT_SCHEMA_VERSION, firstRunDismissed: false, settings: { ...DEFAULT_SETTINGS } },
  }
}

export function newId(): string {
  return globalThis.crypto.randomUUID()
}

/** The workspace without the store's functions and without any unsaved preview. */
export function toSaved(state: WorkspaceState | Workspace): Workspace {
  return {
    library: state.library,
    session: { ...state.session, preview: null },
    history: state.history,
    meta: state.meta,
  }
}

export function selectActiveBuild(state: Workspace): Build | null {
  const id = state.session.activeBuildId
  return id ? (state.library.builds[id] ?? null) : null
}

const viewCache = new WeakMap<HistoryEntry, { base: Build; view: Build }>()

/** The build every tool shows: the active build with any preview applied. Stable between calls. */
export function selectBuildView(state: Workspace): Build | null {
  const base = selectActiveBuild(state)
  const preview = state.session.preview
  if (!base || !preview) return base
  const cached = viewCache.get(preview)
  if (cached && cached.base === base) return cached.view
  const view = applyPatches(base, preview.patches)
  viewCache.set(preview, { base, view })
  return view
}

const emptyHistory = (): BuildHistory => ({ past: [], future: [] })

export function createWorkspaceStore(initial: Workspace) {
  return createStore<WorkspaceState>()((set, get) => {
    const withActive = (fn: (id: string, build: Build) => Partial<Workspace> | null) => {
      const state = get()
      const id = state.session.activeBuildId
      const build = id ? state.library.builds[id] : undefined
      if (!id || !build) return
      const changes = fn(id, build)
      if (changes) set(changes)
    }

    const replaceBuild = (id: string, build: Build): Workspace['library'] => ({
      ...get().library,
      builds: { ...get().library.builds, [id]: build },
    })

    return {
      ...initial,

      addBuild(build) {
        const state = get()
        set({
          library: {
            ...state.library,
            builds: { ...state.library.builds, [build.id]: build },
            order: state.library.order.includes(build.id) ? state.library.order : [...state.library.order, build.id],
          },
          session: { ...state.session, activeBuildId: build.id, preview: null },
        })
      },

      switchBuild(id) {
        const state = get()
        if (!state.library.builds[id]) return
        set({ session: { ...state.session, activeBuildId: id, preview: null } })
      },

      renameBuild(id, name) {
        const build = get().library.builds[id]
        if (!build) return
        set({ library: replaceBuild(id, { ...build, name }) })
      },

      duplicateBuild(id) {
        const state = get()
        const source = state.library.builds[id]
        if (!source) throw new Error(`No build ${id}`)
        const copy: Build = { ...structuredClone(source), id: newId(), name: `${source.name} (copy)` }
        const order = [...state.library.order]
        order.splice(order.indexOf(id) + 1, 0, copy.id)
        set({
          library: { ...state.library, builds: { ...state.library.builds, [copy.id]: copy }, order },
          session: { ...state.session, activeBuildId: copy.id, preview: null },
        })
        return copy.id
      },

      deleteBuild(id) {
        const state = get()
        if (!state.library.builds[id]) return
        const index = state.library.order.indexOf(id)
        const order = state.library.order.filter((other) => other !== id)
        const builds = { ...state.library.builds }
        delete builds[id]
        const history = { ...state.history }
        delete history[id]
        const wasActive = state.session.activeBuildId === id
        const nextActive = wasActive ? (order[Math.max(0, index - 1)] ?? null) : state.session.activeBuildId
        set({
          library: { ...state.library, builds, order },
          history,
          session: { ...state.session, activeBuildId: nextActive, preview: wasActive ? null : state.session.preview },
        })
      },

      applyEdit(recipe, label) {
        withActive((id, build) => {
          const [next, patches, inverse] = produceWithPatches(build, recipe)
          if (patches.length === 0) return { session: { ...get().session, preview: null } }
          const history = get().history[id] ?? emptyHistory()
          return {
            library: replaceBuild(id, next),
            history: {
              ...get().history,
              [id]: { past: [...history.past, { label, patches, inverse }].slice(-HISTORY_LIMIT), future: [] },
            },
            session: { ...get().session, preview: null },
          }
        })
      },

      undo() {
        withActive((id, build) => {
          const history = get().history[id]
          const entry = history?.past.at(-1)
          if (!history || !entry) return null
          return {
            library: replaceBuild(id, applyPatches(build, entry.inverse)),
            history: { ...get().history, [id]: { past: history.past.slice(0, -1), future: [entry, ...history.future] } },
            session: { ...get().session, preview: null },
          }
        })
      },

      redo() {
        withActive((id, build) => {
          const history = get().history[id]
          const entry = history?.future[0]
          if (!history || !entry) return null
          return {
            library: replaceBuild(id, applyPatches(build, entry.patches)),
            history: { ...get().history, [id]: { past: [...history.past, entry], future: history.future.slice(1) } },
            session: { ...get().session, preview: null },
          }
        })
      },

      setPreview(recipe, label) {
        withActive((_id, build) => {
          const [, patches, inverse] = produceWithPatches(build, recipe)
          return { session: { ...get().session, preview: patches.length > 0 ? { label, patches, inverse } : null } }
        })
      },

      keepPreview() {
        const preview = get().session.preview
        if (!preview) return
        withActive((id, build) => {
          const history = get().history[id] ?? emptyHistory()
          return {
            library: replaceBuild(id, applyPatches(build, preview.patches)),
            history: { ...get().history, [id]: { past: [...history.past, preview].slice(-HISTORY_LIMIT), future: [] } },
            session: { ...get().session, preview: null },
          }
        })
      },

      discardPreview() {
        set({ session: { ...get().session, preview: null } })
      },

      dismissFirstRun() {
        set({ meta: { ...get().meta, firstRunDismissed: true } })
      },

      updateSettings(changes) {
        set({ meta: { ...get().meta, settings: { ...get().meta.settings, ...changes } } })
      },

      setToolUi(tool, value) {
        set({ session: { ...get().session, toolUi: { ...get().session.toolUi, [tool]: value } } })
      },

      replaceWorkspace(workspace) {
        set({ ...workspace })
      },
    }
  })
}

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>
