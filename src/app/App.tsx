import { useEffect, useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { loadCatalog } from '../data/catalog'
import { createSampleBuild } from '../data/sample-build'
import { clearWorkspace, loadStamped, saveWorkspace } from '../state/persist/db'
import { choosePending, clearPending, readPending, writePending } from '../state/persist/pending'
import { createStorageChannel, startSaving } from '../state/persist/saving'
import { createWorkspaceStore, emptyWorkspace, toSaved } from '../state/store'
import { AppContext } from './context'
import type { AppServices } from './context'
import { Shell } from './Shell'
import { BuildPage } from '../features/build/BuildPage'
import { SavedPage } from '../features/saved/SavedPage'
import { SuggestionsPage } from '../features/suggestions/SuggestionsPage'
import { OptimizerPage } from '../features/optimizer/OptimizerPage'
import { RotationPage } from '../features/rotation/RotationPage'
import { ComparePage } from '../features/compare/ComparePage'
import { CardPage } from '../features/card/CardPage'
import { HomePage } from '../features/home/HomePage'
import { GuideComparing, GuideFormula, GuideOverview, GuidePage, GuideScore } from '../features/guide/GuidePage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { NotFound } from './NotFound'
import { TokenPage } from './TokenPage'
import { notices } from './notices'

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/build', element: <BuildPage /> },
      { path: '/suggestions', element: <SuggestionsPage /> },
      { path: '/optimizer', element: <OptimizerPage /> },
      { path: '/rotation', element: <RotationPage /> },
      { path: '/saved', element: <SavedPage /> },
      { path: '/compare', element: <ComparePage /> },
      { path: '/card', element: <CardPage /> },
      {
        path: '/guide',
        element: <GuidePage />,
        children: [
          { index: true, element: <GuideOverview /> },
          { path: 'score', element: <GuideScore /> },
          { path: 'formula', element: <GuideFormula /> },
          { path: 'comparing', element: <GuideComparing /> },
        ],
      },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/design', element: <TokenPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

type Boot = { state: 'loading' } | { state: 'ready'; services: AppServices } | { state: 'failed'; message: string }

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** One identity per tab. Survives a reload, so a tab does not conflict with its own last save. */
function tabIdentity(): string {
  try {
    const existing = window.sessionStorage.getItem('thewuthering:tab')
    if (existing) return existing
    const id = globalThis.crypto.randomUUID()
    window.sessionStorage.setItem('thewuthering:tab', id)
    return id
  } catch {
    return globalThis.crypto.randomUUID()
  }
}

async function boot(): Promise<AppServices> {
  const storage = safeLocalStorage()
  const [catalog, saved] = await Promise.all([
    loadCatalog(),
    loadStamped().catch((error: Error) => {
      notices.show(`Your saved builds could not be read: ${error.message} A fresh start was made; nothing was deleted.`)
      return null
    }),
  ])
  // The backup written on leaving wins when it is newer than the last completed save.
  const pending = storage ? readPending(storage) : null
  const workspace = choosePending(saved, pending)
  const fromPending = pending !== null && workspace === pending.workspace
  const initial = {
    revision: (fromPending ? pending.revision : saved?.revision) ?? 0,
    writer: (fromPending ? pending.writer : saved?.writer) ?? '',
    savedAt: (fromPending ? pending.savedAt : saved?.savedAt) ?? 0,
  }
  const store = createWorkspaceStore(workspace ?? emptyWorkspace())
  const seeded = store.getState().library.order.length === 0 && !(workspace?.meta.firstRunDismissed ?? false)
  if (seeded) store.getState().addBuild(createSampleBuild(catalog))

  const tabId = tabIdentity()
  // A first run is worth persisting before the user touches anything, so the sample build and
  // "saved at" are real. The backup taken on leaving is also written back as a completed save.
  if (fromPending || seeded) {
    const savedAt = Date.now()
    try {
      await saveWorkspace(toSaved(store.getState()), savedAt, { revision: initial.revision, writer: initial.writer || tabId })
      initial.savedAt = savedAt
    } catch (error) {
      notices.show(`Your builds could not be saved in this browser yet: ${(error as Error).message}`)
    }
  }

  const channel = storage ? createStorageChannel(storage) : { publish: () => {}, subscribe: () => () => {} }
  const saving = startSaving({
    store,
    channel,
    tabId,
    initial,
    save: (next, meta) => saveWorkspace(next, meta.savedAt, { revision: meta.revision, writer: meta.writer }),
    load: loadStamped,
    clearStored: async () => {
      await clearWorkspace()
      if (storage) clearPending(storage)
    },
    onError: (message) => notices.show(message),
  })
  if (storage) clearPending(storage)

  const leave = () => {
    if (storage && saving.autosave.isDirty() && !saving.isConflicted()) writePending(storage, toSaved(store.getState()), Date.now(), saving.known())
    void saving.autosave.flush()
  }
  window.addEventListener('pagehide', leave)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') leave()
  })
  return { catalog, store, saving }
}

export function App() {
  const [status, setStatus] = useState<Boot>({ state: 'loading' })

  useEffect(() => {
    boot()
      .then((services) => setStatus({ state: 'ready', services }))
      .catch((error: Error) => setStatus({ state: 'failed', message: error.message }))
  }, [])

  if (status.state === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4 text-ink-2" role="status">
        Loading game data
      </div>
    )
  }
  if (status.state === 'failed') {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <h1 className="font-display text-26">theWuthering could not start</h1>
        <p className="mt-3 text-ink-2">{status.message}</p>
        <p className="mt-2 text-ink-2">Reload the page to try again.</p>
      </div>
    )
  }
  return (
    <AppContext.Provider value={status.services}>
      <RouterProvider router={router} />
    </AppContext.Provider>
  )
}
