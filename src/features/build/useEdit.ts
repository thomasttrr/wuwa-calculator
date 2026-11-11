import { useActions, useWorkspace } from '../../app/context'
import type { BuildRecipe } from '../../state/store'

/** Edit the active build: one undoable step with a plain label ("Set level to 80"). */
export function useEdit(): (label: string, recipe: BuildRecipe) => void {
  const actions = useActions()
  return (label, recipe) => actions.applyEdit(recipe, label)
}

/** True when the "Show everything" switch is on. Expert controls are hidden, never removed. */
export function useShowEverything(): boolean {
  return useWorkspace((s) => s.meta.settings.showEverything)
}
