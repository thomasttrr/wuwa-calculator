import { Tabs } from 'radix-ui'
import { useMemo, useState } from 'react'
import { useActions, useCatalog, useWorkspace } from '../../app/context'
import { notices } from '../../app/notices'
import type { BreakdownRow, RotationResult } from '../../engine/rotation/simulate'
import { simulateRotation } from '../../engine/rotation/simulate'
import type { Build, Rotation } from '../../engine/types/build'
import { exportRotation, importRotation } from '../../state/rotation-share'
import { newId } from '../../state/store'
import { Button } from '../../ui/Button'
import { formatDamage, formatPercent } from '../../ui/format'
import { EmptyState } from '../../ui/Section'
import { StepRow } from '../build/ResultsTabs'
import { TYPE_COLOUR } from './names'
import { summariseRotation } from './summary'
import { useRotationEdit } from './useRotationEdit'

const TAB_KEY = 'rotation.tab'
const TABS = [
  ['steps', 'Every hit'],
  ['breakdown', 'Breakdowns'],
  ['summary', 'Summary'],
  ['saved', 'Saved rotations'],
] as const

export function RotationResults({ build, simulation }: { build: Build; simulation: RotationResult }) {
  const actions = useActions()
  const tab = useWorkspace((s) => (s.session.toolUi[TAB_KEY] as string | undefined) ?? 'steps')
  return (
    <Tabs.Root value={tab} onValueChange={(value) => actions.setToolUi(TAB_KEY, value)}>
      <Tabs.List aria-label="Rotation results" className="flex flex-wrap gap-1">
        {TABS.map(([value, label]) => (
          <Tabs.Trigger
            key={value}
            value={value}
            className="min-h-11 rounded-control px-3 text-ink-2 hover:bg-raised hover:text-ink data-[state=active]:bg-raised data-[state=active]:font-semibold data-[state=active]:text-ink data-[state=active]:shadow-[inset_0_-3px_0_var(--color-signal)] md:min-h-10"
          >
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content value="steps" className="pt-3">
        <Steps simulation={simulation} />
      </Tabs.Content>
      <Tabs.Content value="breakdown" className="pt-3">
        <Breakdowns simulation={simulation} />
      </Tabs.Content>
      <Tabs.Content value="summary" className="pt-3">
        <Summary build={build} />
      </Tabs.Content>
      <Tabs.Content value="saved" className="pt-3">
        <Saved build={build} simulation={simulation} />
      </Tabs.Content>
    </Tabs.Root>
  )
}

function Steps({ simulation }: { simulation: RotationResult }) {
  const max = Math.max(...simulation.steps.map((s) => s.action.average), 1)
  if (simulation.steps.length === 0) return <EmptyState>No counted steps yet. Add a step on the left.</EmptyState>
  return (
    <div>
      <p className="text-13 text-ink-3">Every counted step in play order, loops unrolled. Open one to see its formula with your numbers in it.</p>
      <ol className="mt-2">
        {simulation.steps.map((step, i) => (
          <StepRow key={`${step.stepId}-${i}`} step={step} share={step.action.average / (simulation.total.average || 1)} width={step.action.average / max} />
        ))}
      </ol>
    </div>
  )
}

function Bars<K>({ title, rows, colour }: { title: string; rows: readonly BreakdownRow<K>[]; colour?: (key: K) => string }) {
  return (
    <section aria-label={title} className="mb-5">
      <h3 className="font-medium">{title}</h3>
      <ul className="mt-2 grid gap-2">
        {rows.map((row) => (
          <li key={String(row.key)} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 text-14">
            <span className="flex min-w-0 items-center gap-2">
              {colour ? <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: colour(row.key) }} aria-hidden="true" /> : null}
              <span className="truncate">{row.label}</span>
            </span>
            <span className="tabular-nums">
              <span className="font-semibold">{formatDamage(row.average)}</span>
              <span className="ml-2 text-13 text-ink-3">{formatPercent(row.share)}</span>
            </span>
            <span className="col-span-2 mt-1 block h-1.5 rounded-full bg-page" aria-hidden="true">
              <span className="block h-1.5 rounded-full bg-signal" style={{ width: `${Math.max(row.share * 100, 1)}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Breakdowns({ simulation }: { simulation: RotationResult }) {
  if (simulation.steps.length === 0) return <EmptyState>Nothing to break down yet.</EmptyState>
  return (
    <div>
      <Bars title="By damage type" rows={simulation.byDamageType} colour={(key) => TYPE_COLOUR[key]} />
      <Bars title="By element" rows={simulation.byElement} />
      <Bars title="By skill" rows={simulation.byAction} />
    </div>
  )
}

function Summary({ build }: { build: Build }) {
  const catalog = useCatalog()
  const resonator = catalog.resonators[build.resonator.id]
  if (!resonator) return null
  const lines = summariseRotation(build.rotation, resonator)
  const text = `${build.rotation.name}\n${lines.join('\n')}`
  return (
    <div>
      <p className="text-13 text-ink-3">The rotation as a short list to follow in game. Repeats of the same skill are joined.</p>
      <ol className="mt-3 grid gap-1 rounded-panel bg-raised p-4 font-display text-14 leading-relaxed whitespace-pre-wrap" aria-label="Rotation summary">
        {lines.map((line, i) => (
          <li key={i} className="list-none">
            {line}
          </li>
        ))}
      </ol>
      <Button
        className="mt-3"
        onClick={() =>
          void navigator.clipboard
            .writeText(text)
            .then(() => notices.show('Summary copied.'))
            .catch(() => notices.show('The summary could not be copied. Select it and copy it instead.'))
        }
      >
        Copy as text
      </Button>
    </div>
  )
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${name.replace(/[^\w -]+/g, '').trim() || 'rotation'}.rotation.json`
  a.click()
  URL.revokeObjectURL(url)
}

function Saved({ build, simulation }: { build: Build; simulation: RotationResult }) {
  const catalog = useCatalog()
  const actions = useActions()
  const edit = useRotationEdit()
  const all = useWorkspace((s) => s.library.rotations)
  const saved = all.filter((r) => r.resonatorId === build.resonator.id)
  const [name, setName] = useState(build.rotation.name)
  const [pasted, setPasted] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [comparing, setComparing] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const resonatorName = catalog.resonators[build.resonator.id]?.name ?? 'this Resonator'

  const totals = useMemo(
    () => new Map(saved.map((s) => [s.id, simulateRotation({ ...build, rotation: s.rotation }, catalog)])),
    [saved, build, catalog],
  )
  const keep = (rotation: Rotation, label: string) => {
    actions.saveRotation({ id: newId(), resonatorId: build.resonator.id, rotation, savedAt: new Date().toISOString() })
    notices.show(label)
  }
  const tryImport = (text: string) => {
    try {
      const { rotation } = importRotation(text, catalog, build.resonator.id)
      keep(rotation, `Imported "${rotation.name}" into your saved rotations.`)
      setPasted('')
      setProblem(null)
    } catch (error) {
      setProblem((error as Error).message)
    }
  }
  const compared = saved.find((s) => s.id === comparing)
  const other = compared ? totals.get(compared.id) : undefined

  return (
    <div className="grid gap-5">
      <section aria-labelledby="save-this">
        <h3 id="save-this" className="font-medium">
          Save this rotation
        </h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Name for the saved rotation</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-h-11 w-full rounded-control border border-rule bg-page px-3 text-ink focus:border-signal focus:outline-none md:min-h-9"
            />
          </label>
          <Button onClick={() => keep({ ...build.rotation, name: name.trim() || build.rotation.name }, `Saved "${name.trim() || build.rotation.name}".`)}>Save</Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="quiet" onClick={() => void navigator.clipboard.writeText(exportRotation(build.rotation, build.resonator.id, catalog)).then(() => notices.show('Rotation copied as text.'))}>
            Copy as text
          </Button>
          <Button variant="quiet" onClick={() => download(build.rotation.name, exportRotation(build.rotation, build.resonator.id, catalog))}>
            Save as a file
          </Button>
        </div>
      </section>

      <section aria-labelledby="saved-list">
        <h3 id="saved-list" className="font-medium">
          Saved for {resonatorName}
        </h3>
        {saved.length === 0 ? (
          <p className="mt-1 text-13 text-ink-3">None yet. Save this one, or import one below.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {saved.map((s) => {
              const result = totals.get(s.id)
              const gain = result && simulation.total.average > 0 ? result.total.average / simulation.total.average - 1 : 0
              return (
                <li key={s.id} className="rounded-panel bg-raised p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-ink">{s.rotation.name}</span>
                    <span className="text-13 text-ink-2 tabular-nums">
                      {formatDamage(result?.total.average ?? 0)} with this build{Math.abs(gain) >= 0.001 ? `, ${gain > 0 ? '+' : '−'}${(Math.abs(gain) * 100).toFixed(1)}%` : ''}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button onClick={() => edit(`Used the saved rotation "${s.rotation.name}"`, () => ({ ...s.rotation, id: build.rotation.id }))}>
                      Use<span className="sr-only"> {s.rotation.name}</span>
                    </Button>
                    <Button variant="quiet" onClick={() => setComparing(comparing === s.id ? null : s.id)}>
                      {comparing === s.id ? 'Stop comparing' : 'Compare'}
                      <span className="sr-only"> {s.rotation.name}</span>
                    </Button>
                    <Button variant="quiet" onClick={() => download(s.rotation.name, exportRotation(s.rotation, s.resonatorId, catalog))}>
                      Save as a file<span className="sr-only"> {s.rotation.name}</span>
                    </Button>
                    {confirming === s.id ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-13 text-ink-2">Delete it? This cannot be undone.</span>
                        <Button
                          onClick={() => {
                            actions.deleteRotation(s.id)
                            setConfirming(null)
                          }}
                        >
                          Delete
                        </Button>
                        <Button variant="quiet" onClick={() => setConfirming(null)}>
                          Keep
                        </Button>
                      </span>
                    ) : (
                      <Button variant="quiet" onClick={() => setConfirming(s.id)}>
                        Delete<span className="sr-only"> {s.rotation.name}</span>
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {compared && other ? (
        <section aria-labelledby="compare-title" className="rounded-panel bg-raised p-3">
          <h3 id="compare-title" className="font-medium">
            This rotation against "{compared.rotation.name}"
          </h3>
          <p className="text-13 text-ink-3">Same build, team and target; only the rotation differs.</p>
          <table className="mt-2 w-full text-left text-14">
            <thead className="text-13 text-ink-3">
              <tr className="border-b border-rule">
                <th className="py-1.5 font-normal">
                  <span className="sr-only">What</span>
                </th>
                <th className="py-1.5 text-right font-normal">This one</th>
                <th className="py-1.5 text-right font-normal">Saved</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[
                ['Average', simulation.total.average, other.total.average],
                ['If nothing crits', simulation.total.nonCrit, other.total.nonCrit],
                ['Steps counted', simulation.steps.length, other.steps.length],
                ...[...new Set([...simulation.byDamageType, ...other.byDamageType].map((r) => r.key))].map((key) => [
                  [...simulation.byDamageType, ...other.byDamageType].find((r) => r.key === key)?.label ?? String(key),
                  simulation.byDamageType.find((r) => r.key === key)?.average ?? 0,
                  other.byDamageType.find((r) => r.key === key)?.average ?? 0,
                ]),
              ].map(([label, a, b]) => (
                <tr key={String(label)} className="border-b border-rule">
                  <th className="py-1.5 font-normal text-ink-2">{label}</th>
                  <td className="py-1.5 text-right">{formatDamage(Number(a))}</td>
                  <td className="py-1.5 text-right">{formatDamage(Number(b))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section aria-labelledby="import-title">
        <h3 id="import-title" className="font-medium">
          Import a rotation
        </h3>
        <p className="text-13 text-ink-3">Paste text copied from theWuthering, or choose a .rotation.json file. It goes into your saved rotations.</p>
        <label className="mt-2 block">
          <span className="sr-only">Rotation text</span>
          <textarea
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            rows={3}
            className="w-full rounded-control border border-rule bg-page p-3 text-13 text-ink focus:border-signal focus:outline-none"
          />
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button disabled={!pasted.trim()} onClick={() => tryImport(pasted)}>
            Import pasted text
          </Button>
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-control px-4 text-14 font-medium text-ink-2 hover:bg-raised hover:text-ink md:min-h-9">
            Choose a file
            <input type="file" accept=".json,application/json" className="sr-only" onChange={(event) => void event.target.files?.[0]?.text().then(tryImport)} />
          </label>
        </div>
        {problem ? (
          <p role="alert" className="mt-2 text-14 text-loss">
            {problem}
          </p>
        ) : null}
      </section>
    </div>
  )
}
