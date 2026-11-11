import { X } from 'lucide-react'
import { useActions, useWorkspace } from '../../app/context'
import { SAMPLE_BUILD_ID } from '../../data/sample-build'
import { IconButton } from '../../ui/Button'

/** The guided path on first run: start from the sample, change one thing, watch the score. Dismissible. */
export function FirstRunGuide() {
  const actions = useActions()
  const dismissed = useWorkspace((s) => s.meta.firstRunDismissed)
  const onSample = useWorkspace((s) => s.session.activeBuildId === SAMPLE_BUILD_ID)
  if (dismissed || !onSample) return null
  return (
    <aside aria-labelledby="guide-title" className="mb-6 rounded-panel border border-rule bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 id="guide-title" className="font-display text-16 md:text-20">
          Start from this build, change one thing
        </h2>
        <IconButton label="Close the guide" onClick={() => actions.dismissFirstRun()}>
          <X size={16} aria-hidden="true" />
        </IconButton>
      </div>
      <ol className="mt-2 grid gap-2 text-ink-2 md:grid-cols-3 md:gap-6">
        <li>
          <span className="font-medium text-ink">1. This is a sample.</span> Jiyan with a full Sierra Gale set and ordinary substats, scored against a level 100
          target.
        </li>
        <li>
          <span className="font-medium text-ink">2. Change one thing.</span> Open an Echo and swap a substat, or switch an effect on or off.
        </li>
        <li>
          <span className="font-medium text-ink">3. Watch the score.</span> It updates at once, says what changed, and every number opens to show how it was
          worked out. Undo puts it back.
        </li>
      </ol>
      <p className="mt-3 text-13 text-ink-3">Everything saves in this browser as you go. Start your own from the build list at the top.</p>
    </aside>
  )
}
