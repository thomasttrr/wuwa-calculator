import { useMemo, useState } from 'react'
import { useCatalog, useWorkspace } from '../../app/context'
import { useResults } from '../../app/results'
import { simulateRotation } from '../../engine/rotation/simulate'
import { effectSpans } from '../../engine/rotation/spans'
import { selectActiveBuild } from '../../state/store'
import { formatDamage } from '../../ui/format'
import { Stamp } from '../build/ScorePanel'
import { RotationEditor } from './RotationEditor'
import { RotationResults } from './RotationResults'
import { StepInspector } from './StepInspector'
import { Timeline } from './Timeline'
import { useRotationEdit } from './useRotationEdit'

/**
 * The rotation of the shared build. The editor works on the build as saved; every number on the
 * page is the build as shown, so a change being tried elsewhere shows here too.
 */
export function RotationPage() {
  const catalog = useCatalog()
  const results = useResults()
  const stored = useWorkspace(selectActiveBuild)
  const edit = useRotationEdit()
  const [selected, setSelected] = useState<string | null>(null)
  const storedSimulation = useMemo(() => (stored ? simulateRotation(stored, catalog) : null), [stored, catalog])
  const spans = useMemo(() => (results ? effectSpans(results.simulation, results.build, catalog) : []), [results, catalog])
  const [nameDraft, setNameDraft] = useState<string | null>(null)

  if (!stored || !results || !storedSimulation) return <p className="py-8 text-ink-2">Start a build from the build list at the top of the page.</p>
  const { simulation, score } = results
  const resonator = catalog.resonators[stored.resonator.id]
  const seconds = simulation.seconds
  const name = nameDraft ?? stored.rotation.name
  const commitName = () => {
    const next = name.trim()
    if (next && next !== stored.rotation.name) edit(`Renamed the rotation to "${next}"`, (r) => ({ ...r, name: next }))
    setNameDraft(null)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1 basis-full lg:basis-auto">
          <h1 className="font-display text-26 md:text-34">Rotation</h1>
          <label className="mt-2 block max-w-md">
            <span className="text-13 text-ink-2">Name of {resonator?.name ?? 'this'} rotation</span>
            <input
              value={name}
              onChange={(event) => setNameDraft(event.target.value)}
              onBlur={commitName}
              onKeyDown={(event) => event.key === 'Enter' && commitName()}
              className="mt-1 min-h-11 w-full rounded-control border border-rule bg-page px-3 text-ink focus:border-signal focus:outline-none md:min-h-9"
            />
          </label>
        </div>
        <dl className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto">
          <Figure label="Average" value={formatDamage(simulation.total.average)} />
          <Figure label="If nothing crits" value={formatDamage(simulation.total.nonCrit)} />
          <Figure label={seconds !== undefined ? `Per second, over ${seconds.toFixed(1)} s` : 'Per second'} value={seconds ? formatDamage(simulation.total.average / seconds) : 'Add times'} />
          <Figure label="Build score" value={score ? `${score.percent.toFixed(1)}%` : 'Working'} testId="rotation-score" />
        </dl>
      </div>

      <section aria-label="Timeline" className="mb-3 rounded-section bg-panel p-4 md:p-6">
        {simulation.steps.length > 0 ? <Timeline simulation={simulation} spans={spans} /> : <p className="text-ink-2">The timeline appears once a step deals damage.</p>}
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
        <section aria-labelledby="steps-title" className="self-start rounded-section bg-panel p-4 md:p-6">
          <h2 id="steps-title" className="font-display text-16 md:text-20">
            Steps
          </h2>
          <p className="mt-1 mb-3 text-13 text-ink-3">Drag the handle to reorder (or focus it and use Space and the arrow keys). Open a step to time it, note it, or switch buffs at it.</p>
          <RotationEditor build={stored} simulation={storedSimulation} onSelect={setSelected} />
        </section>
        <section aria-label="Results" className="self-start rounded-section bg-panel p-4 md:p-6">
          <RotationResults build={stored} simulation={simulation} />
          <div className="mt-4">
            <Stamp />
          </div>
        </section>
      </div>

      <StepInspector build={stored} itemId={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function Figure({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="rounded-panel bg-panel px-3 py-2.5">
      <dt className="text-12 text-ink-3">{label}</dt>
      <dd data-testid={testId} className="mt-0.5 font-display text-16 tabular-nums md:text-20">
        {value}
      </dd>
    </div>
  )
}
