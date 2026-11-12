import { castDraft, current } from 'immer'
import { useActions } from '../../app/context'
import type { Rotation } from '../../engine/types/build'

/** One undoable change to the active build's rotation, with a plain label ("Moved Heavy Attack"). */
export function useRotationEdit(): (label: string, change: (rotation: Rotation) => Rotation) => void {
  const actions = useActions()
  return (label, change) =>
    actions.applyEdit((draft) => {
      draft.rotation = castDraft(change(current(draft.rotation) as Rotation))
    }, label)
}
