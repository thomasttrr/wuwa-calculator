import { useEffect, useState } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { loadCatalog } from '../data/catalog'
import { createSampleBuild } from '../data/sample-build'
import { startAutosave } from '../state/persist/autosave'
import { loadWorkspace, saveWorkspace } from '../state/persist/db'
import { createWorkspaceStore, emptyWorkspace } from '../state/store'
import { AppContext } from './context'
import type { AppServices } from './context'
import { Shell } from './Shell'
import { BuildPage } from '../features/build/BuildPage'
import { SavedPage } from '../features/saved/SavedPage'
import { ComparePage } from '../features/compare/ComparePage'
import { NotFound } from './NotFound'
import { TokenPage } from './TokenPage'
import { notices } from './notices'

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: '/', element: <Navigate to="/build" replace /> },
      { path: '/build', element: <BuildPage /> },
      { path: '/saved', element: <SavedPage /> },
      { path: '/compare', element: <ComparePage /> },
      { path: '/design', element: <TokenPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

type Boot = { state: 'loading' } | { state: 'ready'; services: AppServices } | { state: 'failed'; message: string }

async function boot(): Promise<AppServices> {
  const [catalog, saved] = await Promise.all([
    loadCatalog(),
    loadWorkspace().catch((error: Error) => {
      notices.show(`Your saved builds could not be read: ${error.message} A fresh start was made; nothing was deleted.`)
      return null
    }),
  ])
  const store = createWorkspaceStore(saved ?? emptyWorkspace())
  if (store.getState().library.order.length === 0) store.getState().addBuild(createSampleBuild(catalog))

  const autosave = startAutosave(store, saveWorkspace, 300, (message) => notices.show(message))
  const flush = () => void autosave.flush()
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  return { catalog, store }
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
