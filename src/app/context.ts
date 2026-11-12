import { createContext, useContext, useSyncExternalStore } from 'react'
import { useStore } from 'zustand'
import type { Catalog } from '../engine/types/catalog'
import type { Build } from '../engine/types/build'
import type { SavingController, SavingState } from '../state/persist/saving'
import { selectBuildView } from '../state/store'
import type { WorkspaceActions, WorkspaceState, WorkspaceStore } from '../state/store'

export interface AppServices {
  catalog: Catalog
  store: WorkspaceStore
  saving: SavingController
}

export const AppContext = createContext<AppServices | null>(null)

function useServices(): AppServices {
  const services = useContext(AppContext)
  if (!services) throw new Error('AppContext is missing: render inside <App>.')
  return services
}

export function useCatalog(): Catalog {
  return useServices().catalog
}

export function useWorkspace<T>(selector: (state: WorkspaceState) => T): T {
  return useStore(useServices().store, selector)
}

/** The store's actions. Stable across renders. */
export function useActions(): WorkspaceActions {
  return useServices().store.getState()
}

/** The build every tool shows: the active build with any preview applied. */
export function useBuildView(): Build | null {
  return useWorkspace(selectBuildView)
}

/** Saving state: a second tab's newer save, and this tab's revision. */
export function useSaving(): SavingState {
  const { saving } = useServices()
  return useSyncExternalStore(saving.state.subscribe, saving.state.getState)
}

/** Actions that settle a two-tab save conflict, restore a backup or erase everything. */
export function useSavingActions(): Pick<SavingController, 'keepLocal' | 'useRemote' | 'replaceAll' | 'eraseAll'> {
  return useServices().saving
}
