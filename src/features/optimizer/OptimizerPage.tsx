import { castDraft } from 'immer'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useActions, useCatalog, useWorkspace } from '../../app/context'
import { notices } from '../../app/notices'
import { generateCandidates } from '../../engine/optimize/generate'
import { buildFromResult, damageUnderSettings, defaultSettings } from '../../engine/optimize/search'
import type { LimitStat, OptimizerProblem, OptimizerResult, OptimizerSettings } from '../../engine/optimize/search'
import { simulateRotation } from '../../engine/rotation/simulate'
import { rankSets } from '../../engine/suggest/rank'
import type { Build } from '../../engine/types/build'
import type { EchoCost } from '../../engine/types/catalog'
import { explainChange } from '../../explain/suggestion'
import { newId, selectActiveBuild } from '../../state/store'
import { BorderBeam } from '../../ui/BorderBeam'
import { Button } from '../../ui/Button'
import { SelectField, Switch } from '../../ui/Field'
import { formatDamage, formatStatValue } from '../../ui/format'
import { EmptyState } from '../../ui/Section'
import { Sheet } from '../../ui/Sheet'
import { runOptimizer } from '../../workers/optimizer-pool'
import type { OptimizerHandle, OptimizerProgress } from '../../workers/optimizer-pool'
import { Stamp } from '../build/ScorePanel'
import { EchoSummary } from '../echoes/EchoSummary'
import { gainText } from '../suggestions/SuggestionsPage'
import { Inventory } from './Inventory'

type Source = 'mine' | 'generated'
type Limits = Partial<Record<LimitStat, { min?: number; max?: number }>>

interface Ui {
  source: Source
  /** Action id, or null for the whole rotation. */
  target: number | null
  lockMain: boolean
  /** Null: every set (my Echoes) or a starting list (generated). */
  sets: number[] | null
  mains: Partial<Record<EchoCost, number[]>> | null
  /** In the units shown: percent for rates, plain numbers for ATK. */
  limits: Limits
  assume: boolean
  keep: number
}
const UI_KEY = 'optimizer'
const DEFAULT_UI: Ui = {
  source: 'mine',
  target: null,
  lockMain: true,
  sets: null,
  mains: null,
  limits: {},
  assume: false,
  keep: 10,
}
const COSTS: readonly EchoCost[] = [4, 3, 1]
const LIMIT_ROWS: { stat: LimitStat; label: string; percent: boolean }[] = [
  { stat: 'energyRegen', label: 'Energy Regen', percent: true },
  { stat: 'critRate', label: 'Crit. Rate', percent: true },
  { stat: 'critDmg', label: 'Crit. DMG', percent: true },
  { stat: 'atk', label: 'ATK', percent: false },
]
const SHOWN = 10

type Run =
  | { status: 'idle' }
  | {
      status: 'running' | 'done' | 'cancelled' | 'error'
      problem: OptimizerProblem
      source: Source
      current: number
      progress: OptimizerProgress | null
      results: OptimizerResult[]
      elapsedMs: number
      error?: string
    }

function timeLeft(progress: OptimizerProgress | null): string {
  if (!progress || progress.remainingMs === null) return 'Working out how long this will take.'
  const seconds = Math.max(1, Math.round(progress.remainingMs / 1000))
  if (seconds < 90) return `About ${seconds} ${seconds === 1 ? 'second' : 'seconds'} left.`
  return `About ${Math.round(seconds / 60)} minutes left.`
}

export function OptimizerPage() {
  const catalog = useCatalog()
  const actions = useActions()
  const active = useWorkspace(selectActiveBuild)
  const inventory = useWorkspace((s) => s.library.echoInventory)
  const stored = useWorkspace((s) => s.session.toolUi[UI_KEY] as Partial<Ui> | undefined)
  const ui: Ui = { ...DEFAULT_UI, ...stored }
  const setUi = (changes: Partial<Ui>) => actions.setToolUi(UI_KEY, { ...ui, ...changes })
  const [run, setRun] = useState<Run>({ status: 'idle' })
  const [setsOpen, setSetsOpen] = useState(false)
  const [mainsOpen, setMainsOpen] = useState(false)
  const handle = useRef<OptimizerHandle | null>(null)
  useEffect(() => () => handle.current?.cancel(), [])

  const actionsInRotation = useMemo(() => {
    if (!active) return []
    const seen = new Map<number, string>()
    for (const step of simulateRotation(active, catalog).steps) if (step.action.counted) seen.set(step.action.actionId, step.action.name)
    return [...seen]
  }, [active, catalog])

  // Generated plans start from your own set and the five best sets for this build.
  const wantsDefaultSets = ui.source === 'generated' && ui.sets === null
  const generatedDefault = useMemo(() => {
    if (!active || !wantsDefaultSets) return null
    const own = active.echoes[0]?.sonataId
    const top = rankSets(active, catalog)
      .slice(0, 5)
      .map((s) => (s.change.kind === 'set' ? s.change.sonataId : -1))
    return [...new Set([...(own !== undefined ? [own] : []), ...top])].filter((id) => id >= 0)
  }, [active, catalog, wantsDefaultSets])

  if (!active) return <p className="py-8 text-ink-2">Start a build from the build list at the top of the page.</p>
  const mainEcho = active.echoes[0]
  const mainName = mainEcho ? (catalog.echoes[mainEcho.echoId]?.name ?? 'your main Echo') : null
  const inventorySets = [...new Set(inventory.map((e) => e.sonataId))]
  const setChoices = ui.source === 'mine' ? inventorySets : Object.keys(catalog.sonatas).map(Number)
  const chosenSets = ui.sets ?? (ui.source === 'generated' ? (generatedDefault ?? []) : inventorySets)
  const running = run.status === 'running'

  const settings = (): OptimizerSettings => {
    const limits = LIMIT_ROWS.flatMap(({ stat, percent }) => {
      const row = ui.limits[stat]
      if (!row || (row.min === undefined && row.max === undefined)) return []
      const scale = percent ? 0.01 : 1
      return [
        {
          stat,
          ...(row.min !== undefined ? { min: row.min * scale } : {}),
          ...(row.max !== undefined ? { max: row.max * scale } : {}),
        },
      ]
    })
    return {
      ...defaultSettings(),
      target: ui.target === null ? { kind: 'rotation' } : { kind: 'action', actionId: ui.target },
      keep: Math.min(50, Math.max(1, ui.keep)),
      lockMainEchoId: ui.lockMain && mainEcho ? mainEcho.echoId : null,
      allowedSonataIds: ui.sets ? ui.sets : null,
      allowedMains: ui.mains,
      limits,
      assumeConditionsMet: ui.assume,
    }
  }

  const start = () => {
    const s = settings()
    let problem: OptimizerProblem
    if (ui.source === 'generated') {
      const generated = generateCandidates(active, catalog, chosenSets)
      problem = {
        build: active,
        candidates: generated.candidates,
        extraSubstats: generated.extraSubstats,
        settings: {
          ...s,
          allowedSonataIds: null,
          lockMainEchoId: generated.mainEchoId,
        },
      }
    } else {
      problem = { build: active, candidates: inventory, settings: s }
    }
    const current = damageUnderSettings(active, catalog, s)
    const begun: Run = {
      status: 'running',
      problem,
      source: ui.source,
      current,
      progress: null,
      results: [],
      elapsedMs: 0,
    }
    setRun(begun)
    const h = runOptimizer(problem, catalog, {
      onProgress: (progress) => setRun((r) => (r.status === 'running' ? { ...r, progress, elapsedMs: progress.elapsedMs } : r)),
      onResults: (results) => setRun((r) => (r.status === 'running' ? { ...r, results } : r)),
    })
    handle.current = h
    h.finished
      .then((end) =>
        setRun((r) =>
          r.status === 'running'
            ? {
                ...r,
                status: end.cancelled ? 'cancelled' : 'done',
                results: end.results,
                elapsedMs: end.elapsedMs,
              }
            : r,
        ),
      )
      .catch((error: Error) => setRun((r) => (r.status === 'running' ? { ...r, status: 'error', error: error.message } : r)))
  }

  const cancel = () => handle.current?.cancel()
  const blocked =
    ui.source === 'mine' && inventory.length === 0
      ? 'Add your Echoes first, under My Echoes.'
      : ui.source === 'mine' && ui.lockMain && mainEcho && !inventory.some((e) => e.echoId === mainEcho.echoId)
        ? `None of your Echoes is a ${mainName}. Add it under My Echoes, or turn off "Keep ${mainName} as main Echo".`
        : ui.source === 'generated' && !mainEcho
          ? 'Equip a main Echo on the Build page first: generated plans keep it.'
          : chosenSets.length === 0
            ? 'Allow at least one set.'
            : null

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-26 md:text-34">Optimizer</h1>
        <p className="mt-2 max-w-[64ch] text-ink-2">
          Finds the best Echoes for {active.name}, from the Echoes you own or as a plan of sets and main stats to aim for. It checks every combination that
          could win, and skips only the ones it can prove cannot.
        </p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className="grid content-start gap-3">
          <section aria-labelledby="setup-title" className="rounded-section bg-panel p-4 md:p-6">
            <h2 id="setup-title" className="font-display text-16 md:text-20">
              What to search
            </h2>
            <fieldset className="mt-3">
              <legend className="text-13 text-ink-2">Source</legend>
              <div className="mt-1 grid grid-cols-2 gap-1 rounded-control bg-page p-1">
                {(
                  [
                    ['mine', `My Echoes (${inventory.length})`],
                    ['generated', 'Generated plan'],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={`flex min-h-10 cursor-pointer items-center justify-center rounded-control px-2 text-center text-14 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal ${ui.source === value ? 'bg-raised font-semibold text-ink shadow-[inset_0_-3px_0_var(--color-signal)]' : 'text-ink-2'}`}
                  >
                    <input
                      type="radio"
                      name="source"
                      value={value}
                      checked={ui.source === value}
                      onChange={() => setUi({ source: value, sets: null })}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-13 text-ink-3">
                {ui.source === 'mine'
                  ? 'Searches the Echoes you own.'
                  : 'Echoes of each allowed set and main stat, with no substats; your current substats are kept as one total. Your main Echo stays the same kind.'}
              </p>
            </fieldset>

            <div className="mt-3 grid gap-3">
              <SelectField
                label="Damage to maximise"
                value={ui.target === null ? 'rotation' : String(ui.target)}
                options={[
                  { value: 'rotation', label: 'The whole rotation' },
                  ...actionsInRotation.map(([id, name]) => ({
                    value: String(id),
                    label: `Only: ${name}`,
                  })),
                ]}
                onChange={(value) => setUi({ target: value === 'rotation' ? null : Number(value) })}
              />
              {ui.source === 'mine' ? (
                <Switch
                  label={mainName ? `Keep ${mainName} as main Echo` : 'Keep my main Echo'}
                  description="Off: any Echo can be the main one, and its own effect is counted."
                  checked={ui.lockMain}
                  onChange={(on) => setUi({ lockMain: on })}
                />
              ) : null}
              <Switch
                label="Count every condition as met"
                description="Switches every set and Echo effect fully on. Off: they keep the switches you set on the Build page."
                checked={ui.assume}
                onChange={(on) => setUi({ assume: on })}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-14">
                  Sets: {chosenSets.length} of {setChoices.length}
                </span>
                <Button variant="quiet" onClick={() => setSetsOpen(true)}>
                  Choose sets
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-14">Main stats: {ui.mains ? 'some' : 'all'} allowed</span>
                <Button variant="quiet" onClick={() => setMainsOpen(true)}>
                  Choose main stats
                </Button>
              </div>
              <fieldset>
                <legend className="text-14">Stat limits</legend>
                <p className="text-13 text-ink-3">Leave empty for no limit. Checked on your stats before any conditional effects.</p>
                <div className="mt-2 grid gap-2">
                  {LIMIT_ROWS.map((row) => (
                    <LimitRow key={row.stat} row={row} value={ui.limits[row.stat]} onChange={(next) => setUi({ limits: { ...ui.limits, [row.stat]: next } })} />
                  ))}
                </div>
              </fieldset>
              <label className="flex items-center justify-between gap-3 text-14">
                Results to keep
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={ui.keep}
                  onChange={(event) => setUi({ keep: Number(event.target.value) || 1 })}
                  className="min-h-11 w-24 rounded-control border border-rule bg-page px-3 text-ink focus:border-signal focus:outline-none md:min-h-9"
                />
              </label>
            </div>

            <div className="mt-4">
              {blocked ? <p className="mb-2 text-13 text-ink-2">{blocked}</p> : null}
              {running ? (
                <Button onClick={cancel}>Cancel</Button>
              ) : (
                <Button variant="primary" disabled={blocked !== null} onClick={start}>
                  {ui.source === 'mine' ? 'Find the best Echoes' : 'Make a plan'}
                </Button>
              )}
            </div>
          </section>

          <Inventory build={active} />
        </div>

        <RunPanel run={run} build={active} />
      </div>

      <Sheet
        open={setsOpen}
        onOpenChange={setSetsOpen}
        title="Sets to allow"
        description={ui.source === 'mine' ? 'Only sets among your Echoes are listed.' : 'Fewer sets search faster.'}
      >
        <div className="mb-3 flex gap-2">
          <Button variant="quiet" onClick={() => setUi({ sets: setChoices })}>
            Allow all
          </Button>
          <Button variant="quiet" onClick={() => setUi({ sets: [] })}>
            Allow none
          </Button>
        </div>
        <ul className="divide-y divide-rule">
          {setChoices
            .map((id) => catalog.sonatas[id])
            .filter((s) => s !== undefined)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((set) => (
              <li key={set.id}>
                <label className="flex min-h-12 items-center gap-3 py-1">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--color-signal)]"
                    checked={chosenSets.includes(set.id)}
                    onChange={(event) =>
                      setUi({
                        sets: event.target.checked ? [...chosenSets, set.id] : chosenSets.filter((id) => id !== set.id),
                      })
                    }
                  />
                  <span className="flex-1 text-ink">{set.name}</span>
                  {ui.source === 'mine' ? <span className="text-13 text-ink-3">{inventory.filter((e) => e.sonataId === set.id).length} owned</span> : null}
                </label>
              </li>
            ))}
        </ul>
      </Sheet>

      <Sheet open={mainsOpen} onOpenChange={setMainsOpen} title="Main stats to allow" description="Per Echo cost. Echoes with other main stats are left out.">
        <Button variant="quiet" className="mb-3" onClick={() => setUi({ mains: null })}>
          Allow all
        </Button>
        {COSTS.map((cost) => {
          const options = catalog.echoStats.mainStats[cost]
          const allowed = ui.mains?.[cost] ?? options.map((_, i) => i)
          return (
            <fieldset key={cost} className="mb-4">
              <legend className="font-medium">Cost {cost}</legend>
              {options.map((main, i) => (
                <label key={i} className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--color-signal)]"
                    checked={allowed.includes(i)}
                    onChange={(event) =>
                      setUi({
                        mains: {
                          ...ui.mains,
                          [cost]: event.target.checked ? [...allowed, i] : allowed.filter((x) => x !== i),
                        },
                      })
                    }
                  />
                  <span className="text-ink">
                    {main.label} {formatStatValue(main.stat, main.value)}
                  </span>
                </label>
              ))}
            </fieldset>
          )
        })}
      </Sheet>
    </div>
  )
}

function LimitRow({
  row,
  value,
  onChange,
}: {
  row: (typeof LIMIT_ROWS)[number]
  value: { min?: number; max?: number } | undefined
  onChange: (next: { min?: number; max?: number }) => void
}) {
  const field = (which: 'min' | 'max') => (
    <label className="flex min-w-0 flex-1 items-center gap-2 text-13 text-ink-2">
      <span className="w-8">{which === 'min' ? 'At least' : 'At most'}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value?.[which] ?? ''}
        aria-label={`${row.label}, ${which === 'min' ? 'at least' : 'at most'}${row.percent ? ' (percent)' : ''}`}
        onChange={(event) => {
          const raw = event.target.value
          const next = { ...value }
          if (raw === '') delete next[which]
          else next[which] = Number(raw)
          onChange(next)
        }}
        className="min-h-11 w-full min-w-0 rounded-control border border-rule bg-page px-2 text-ink focus:border-signal focus:outline-none md:min-h-9"
      />
    </label>
  )
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
      <span className="text-14">
        {row.label}
        {row.percent ? ' %' : ''}
      </span>
      {field('min')}
      {field('max')}
    </div>
  )
}

function RunPanel({ run, build }: { run: Run; build: Build }) {
  const catalog = useCatalog()
  const actions = useActions()
  const preview = useWorkspace((s) => s.session.preview)
  const [showAll, setShowAll] = useState(false)
  const base = useMemo(() => simulateRotation(build, catalog), [build, catalog])

  if (run.status === 'idle') {
    return (
      <section aria-labelledby="results-title" className="self-start rounded-section bg-panel p-4 md:p-6">
        <h2 id="results-title" className="font-display text-16 md:text-20">
          Results
        </h2>
        <p className="mt-2 text-ink-2">Choose what to search, then start. Results appear here as they are found, best first.</p>
      </section>
    )
  }

  const { progress, results, problem, current } = run
  const share = progress && progress.total > 0 ? progress.done / progress.total : 0
  const shown = showAll ? results : results.slice(0, SHOWN)
  const seconds = (run.elapsedMs / 1000).toFixed(1)

  return (
    <section aria-labelledby="results-title" className="relative self-start rounded-section bg-panel p-4 md:p-6">
      {run.status === 'running' ? <BorderBeam colours="tide" duration={6} size={200} /> : null}
      <h2 id="results-title" className="font-display text-16 md:text-20">
        Results
      </h2>
      <div role="status" aria-live="polite" className="mt-2">
        {run.status === 'running' ? (
          <>
            <p className="text-ink">
              Searching: {Math.round(share * 100)}% done. {timeLeft(progress)}
            </p>
            <div className="mt-2 h-2 rounded-full bg-page" aria-hidden="true">
              <div className="h-2 rounded-full bg-signal transition-[width] duration-150" style={{ width: `${share * 100}%` }} />
            </div>
            <p className="mt-1 text-13 text-ink-3">
              {progress ? `${progress.workers > 0 ? `${progress.workers} workers` : 'On this page'}, ${seconds} seconds so far.` : 'Starting.'}
            </p>
          </>
        ) : run.status === 'cancelled' ? (
          <p className="text-ink">Stopped after {seconds} seconds. These are the best found before you cancelled; a full search may find better.</p>
        ) : run.status === 'error' ? (
          <p className="text-ink">The search stopped with an error: {run.error}. Try again, or allow fewer Echoes.</p>
        ) : (
          <p className="text-ink">Done in {seconds} seconds. Every combination that could beat these was checked.</p>
        )}
      </div>

      {results.length === 0 ? (
        run.status === 'running' ? null : (
          <div className="mt-3">
            <EmptyState>No combination meets the limits you set. Loosen a limit, or allow more sets or main stats.</EmptyState>
          </div>
        )
      ) : (
        <ol className="mt-4 grid gap-2">
          {shown.map((result, i) => {
            const b = buildFromResult(problem, result, catalog)
            const gain = current > 0 ? result.damage / current - 1 : 0
            const label = `Equipped the Optimizer's result ${i + 1}`
            const reason = run.source === 'mine' && problem.settings.target.kind === 'rotation' ? explainChange(base, simulateRotation(b, catalog)).text : null
            return (
              <li key={result.echoes.join('-')} className="rounded-panel bg-raised p-3 md:p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-display text-16">
                    <span className="text-ink-3">{i + 1}. </span>
                    {formatDamage(result.damage)}
                  </p>
                  <p className={`text-14 font-semibold ${Math.abs(gain) < 0.001 ? 'text-ink-2' : gain > 0 ? 'text-gain' : 'text-loss'}`}>
                    {Math.abs(gain) < 0.001 ? 'Same as your build now' : `${gainText(gain)} on your build now`}
                  </p>
                </div>
                {reason ? <p className="mt-1 text-14 text-ink-2">{reason}</p> : null}
                <ul className="mt-2 grid gap-1.5">
                  {result.echoes.map((index, slot) => {
                    const echo = run.source === 'generated' ? problem.candidates[index]! : b.echoes[slot]!
                    return (
                      <li key={index} className="flex rounded-control bg-panel px-2.5 py-2">
                        <EchoSummary echo={echo} note={slot === 0 ? 'Main Echo' : undefined} />
                      </li>
                    )
                  })}
                </ul>
                {run.source === 'mine' ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {preview?.label === label ? (
                      <span className="rounded-full border border-signal px-3 py-1 text-13 text-ink">Trying now</span>
                    ) : (
                      <Button
                        onClick={() =>
                          actions.setPreview((draft) => {
                            draft.echoes = castDraft(b.echoes)
                          }, label)
                        }
                      >
                        Try it<span className="sr-only">: result {i + 1}</span>
                      </Button>
                    )}
                    <Button
                      variant="quiet"
                      onClick={() => {
                        const name = `${build.name}, Optimizer ${i + 1}`
                        actions.addBuild({
                          ...build,
                          id: newId(),
                          name,
                          echoes: b.echoes,
                        })
                        actions.switchBuild(build.id)
                        notices.show(`Saved as "${name}". Open it from Saved builds or the build list.`)
                      }}
                    >
                      Save as build
                      <span className="sr-only">: result {i + 1}</span>
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 text-13 text-ink-3">A plan to farm towards: damage uses your current substats as one total.</p>
                )}
              </li>
            )
          })}
        </ol>
      )}
      {results.length > SHOWN ? (
        <Button variant="quiet" className="mt-3" onClick={() => setShowAll(!showAll)}>
          {showAll ? `Show the top ${SHOWN}` : `Show all ${results.length}`}
        </Button>
      ) : null}
      <div className="mt-4">
        <Stamp />
      </div>
    </section>
  )
}
