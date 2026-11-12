import { castDraft } from 'immer'
import { Tabs } from 'radix-ui'
import { useMemo, useState } from 'react'
import { useActions, useCatalog, useWorkspace } from '../../app/context'
import { useResults } from '../../app/results'
import { simulateRotation } from '../../engine/rotation/simulate'
import { percentFor, setupFingerprint } from '../../engine/score/score'
import type { Change, SuggestOptions } from '../../engine/suggest/change'
import { rankMainStats, rankSets, rankSubstats, rankWeapons, rankWholeBuilds, upgradePath } from '../../engine/suggest/rank'
import type { Suggestion, SubstatValue } from '../../engine/suggest/rank'
import type { Build } from '../../engine/types/build'
import { explainChange, farmingGoal } from '../../explain/suggestion'
import type { BuildRecipe } from '../../state/store'
import { selectActiveBuild } from '../../state/store'
import { Button } from '../../ui/Button'
import { Switch } from '../../ui/Field'
import { formatDamage } from '../../ui/format'
import { Mark } from '../../ui/Mark'
import { EmptyState } from '../../ui/Section'
import { Sheet } from '../../ui/Sheet'
import { Stamp } from '../build/ScorePanel'
import { changeLabel, describeChange } from './describe'

const MODES = [
  { id: 'weapons', label: 'Weapons' },
  { id: 'mains', label: 'Main stats' },
  { id: 'sets', label: 'Sets' },
  { id: 'substats', label: 'Substats' },
  { id: 'whole', label: 'Whole builds' },
] as const
type Mode = (typeof MODES)[number]['id']

interface Ui {
  mode: Mode
  assume: boolean
  ownedOnly: boolean
}
const UI_KEY = 'suggestions'
const DEFAULT_UI: Ui = { mode: 'weapons', assume: false, ownedOnly: false }
const NO_DIFFERENCE = 0.001
const TIE = 0.0001
const SHOWN = 10

/** A recipe that turns the stored build into the suggested one, touching only what changed. */
export function toward(target: Build, from: Build): BuildRecipe {
  return (draft) => {
    if (target.weapon !== from.weapon) draft.weapon = castDraft(target.weapon)
    if (target.echoes !== from.echoes) draft.echoes = castDraft(target.echoes)
    if (target.effects !== from.effects) draft.effects = castDraft(target.effects)
  }
}

export function gainText(gain: number): string {
  if (Math.abs(gain) < NO_DIFFERENCE) return 'No real difference'
  return `${gain > 0 ? '+' : '−'}${(Math.abs(gain) * 100).toFixed(1)}% damage`
}

export function SuggestionsPage() {
  const catalog = useCatalog()
  const actions = useActions()
  const active = useWorkspace(selectActiveBuild)
  const owned = useWorkspace((s) => s.library.ownedWeaponIds)
  const stored = useWorkspace((s) => s.session.toolUi[UI_KEY] as Partial<Ui> | undefined)
  const ui: Ui = { ...DEFAULT_UI, ...stored }
  const setUi = (changes: Partial<Ui>) => actions.setToolUi(UI_KEY, { ...ui, ...changes })
  const [ownedOpen, setOwnedOpen] = useState(false)

  const options = useMemo<SuggestOptions>(
    () => ({ assumeConditionsMet: ui.assume, ownedWeaponIds: ui.ownedOnly ? owned : null }),
    [ui.assume, ui.ownedOnly, owned],
  )

  if (!active) return <p className="py-8 text-ink-2">Start a build from the build list at the top of the page.</p>
  const resonator = catalog.resonators[active.resonator.id]

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-26 md:text-34">Suggestions</h1>
        <p className="mt-2 max-w-[64ch] text-ink-2">
          Changes to {active.name}, ranked by how much damage they add to this rotation. Every number is a full re-calculation. Try any of them: nothing is saved until you
          keep it.
        </p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <section aria-labelledby="ranked-title" className="rounded-section bg-panel p-4 md:p-6">
          <h2 id="ranked-title" className="sr-only">
            Ranked changes
          </h2>
          <Tabs.Root value={ui.mode} onValueChange={(value) => setUi({ mode: value as Mode })}>
            <Tabs.List aria-label="What to change" className="flex flex-wrap gap-1">
              {MODES.map((mode) => (
                <Tabs.Trigger
                  key={mode.id}
                  value={mode.id}
                  className="min-h-11 rounded-control px-4 text-ink-2 hover:bg-raised hover:text-ink data-[state=active]:bg-raised data-[state=active]:font-semibold data-[state=active]:text-ink data-[state=active]:shadow-[inset_0_-3px_0_var(--color-signal)] md:min-h-10"
                >
                  {mode.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <div className="mt-3 grid gap-x-6 border-b border-rule pb-2 md:grid-cols-2">
              <Switch
                label="Count every condition as met"
                description="Switches the suggested weapon's or set's own effects fully on. Off: they keep their default state."
                checked={ui.assume}
                onChange={(on) => setUi({ assume: on })}
              />
              <Switch
                label="Only weapons I own"
                description={`${owned.length} marked as owned.`}
                checked={ui.ownedOnly}
                onChange={(on) => setUi({ ownedOnly: on })}
                extra={
                  <Button variant="quiet" className="mt-1 -ml-4" onClick={() => setOwnedOpen(true)}>
                    Choose weapons I own
                  </Button>
                }
              />
            </div>

            <Tabs.Content value="weapons" className="pt-4">
              <Ranked build={active} kind="weapons" options={options} />
            </Tabs.Content>
            <Tabs.Content value="mains" className="pt-4">
              <Ranked build={active} kind="mains" options={options} />
            </Tabs.Content>
            <Tabs.Content value="sets" className="pt-4">
              <Ranked build={active} kind="sets" options={options} />
            </Tabs.Content>
            <Tabs.Content value="substats" className="pt-4">
              <Substats build={active} />
            </Tabs.Content>
            <Tabs.Content value="whole" className="pt-4">
              <Ranked build={active} kind="whole" options={options} />
            </Tabs.Content>
          </Tabs.Root>
          <div className="mt-4">
            <Stamp />
          </div>
        </section>

        <UpgradePath build={active} options={options} />
      </div>

      <Sheet
        open={ownedOpen}
        onOpenChange={setOwnedOpen}
        title="Weapons I own"
        description={`${resonator ? `${resonator.name}'s weapon type only. ` : ''}Used when "Only weapons I own" is on. Saved in this browser.`}
      >
        <OwnedWeapons build={active} />
      </Sheet>
    </div>
  )
}

function rank(kind: 'weapons' | 'mains' | 'sets' | 'whole', build: Build, catalog: ReturnType<typeof useCatalog>, options: SuggestOptions): Suggestion[] {
  switch (kind) {
    case 'weapons':
      return rankWeapons(build, catalog, options)
    case 'mains':
      return rankMainStats(build, catalog, options)
    case 'sets':
      return rankSets(build, catalog, options)
    case 'whole':
      return rankWholeBuilds(build, catalog, options)
  }
}

/** A suggested set or weapon whose own data is unverified (for example a set whose texts disagree with the game tables). */
function usesUnverifiedData(change: Change, catalog: ReturnType<typeof useCatalog>): boolean {
  switch (change.kind) {
    case 'set':
      return catalog.sonatas[change.sonataId]?.provenance.verified === false
    case 'weapon':
      return catalog.weapons[change.weaponId]?.provenance.verified === false
    case 'combo':
      return change.changes.some((part) => usesUnverifiedData(part, catalog))
    default:
      return false
  }
}

const EMPTY: Record<'weapons' | 'mains' | 'sets' | 'whole', string> = {
  weapons: 'No other weapons to compare. Turn off "Only weapons I own", or mark more weapons as owned.',
  mains: 'Add Echoes on the Build page to compare their main stats.',
  sets: 'Add Echoes on the Build page to compare sets.',
  whole: 'Nothing to combine yet. Add a weapon and Echoes on the Build page.',
}

function Ranked({ build, kind, options }: { build: Build; kind: 'weapons' | 'mains' | 'sets' | 'whole'; options: SuggestOptions }) {
  const catalog = useCatalog()
  const actions = useActions()
  const results = useResults()
  const preview = useWorkspace((s) => s.session.preview)
  const [showAll, setShowAll] = useState(false)
  const ranked = useMemo(() => rank(kind, build, catalog, options), [kind, build, catalog, options])
  const base = useMemo(() => simulateRotation(build, catalog), [build, catalog])

  // Score points only make sense on the same scale: the same setup as the build being scored.
  const anchors = results?.score && results.fingerprint === setupFingerprint(build, catalog) ? results.score.anchors : null
  const fingerprint = setupFingerprint(build, catalog)
  const currentPercent = anchors ? percentFor(base.total.average, anchors) : null

  if (ranked.length === 0) return <EmptyState>{EMPTY[kind]}</EmptyState>
  const top = ranked[0]!
  const scale = Math.max(...ranked.map((s) => Math.abs(s.gain)), 1e-9)
  const shown = showAll ? ranked : ranked.slice(0, SHOWN)

  return (
    <div>
      <p className="mb-3 max-w-[64ch] text-ink">
        {top.gain >= NO_DIFFERENCE
          ? `Best here: ${describeChange(top.change, build, catalog).title}, ${gainText(top.gain).toLowerCase()}.`
          : 'Nothing here beats what you have now. These come closest.'}
      </p>
      {ranked.some((s) => setupFingerprint(s.build, catalog) !== fingerprint) ? (
        <p className="-mt-1 mb-3 max-w-[64ch] text-13 text-ink-3">
          A new weapon or set changes the setup, so the score is worked out on a new scale. Compare these by damage, not by score.
        </p>
      ) : null}
      <ol className="grid gap-2">
        {shown.map((s, i) => {
          const tied = i > 0 && Math.abs(ranked[i - 1]!.gain - s.gain) < TIE
          const place = ranked.findIndex((other) => Math.abs(other.gain - s.gain) < TIE) + 1
          const text = describeChange(s.change, build, catalog)
          const label = changeLabel(s.change, build, catalog)
          const after = simulateRotation(s.build, catalog)
          const reason = explainChange(base, after).text
          const unverified = (after.hasUnverified && !base.hasUnverified) || usesUnverifiedData(s.change, catalog)
          const sameSetup = setupFingerprint(s.build, catalog) === fingerprint
          const points = anchors && currentPercent !== null && sameSetup ? percentFor(s.damage, anchors) - currentPercent : null
          const trying = preview?.label === label
          return (
            <li key={i} className="rounded-panel bg-raised p-3 md:p-4">
              <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                <span className="w-8 shrink-0 pt-0.5 font-display text-16 text-ink-3">
                  <span aria-hidden="true">{tied ? `=${place}` : place}</span>
                  <span className="sr-only">{tied ? `Tied for ${place}.` : `Number ${place}.`}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{text.title}</p>
                  <p className="text-13 text-ink-3">{text.detail}</p>
                  <p className="mt-1.5 text-14 text-ink-2">{reason}</p>
                  {unverified ? (
                    <div className="mt-1.5">
                      <Mark kind="unverified" detail="This option uses data the two sources disagree on, or that only one source has." />
                    </div>
                  ) : null}
                </div>
                <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pl-12 sm:w-auto sm:shrink-0 sm:flex-col sm:items-end sm:pl-0">
                  <span className={`font-display text-16 tabular-nums ${Math.abs(s.gain) < NO_DIFFERENCE ? 'text-ink-2' : s.gain > 0 ? 'text-gain' : 'text-loss'}`}>
                    {gainText(s.gain)}
                  </span>
                  {points !== null && Math.abs(s.gain) >= NO_DIFFERENCE ? (
                    <span className="text-13 text-ink-3 tabular-nums">
                      {points >= 0 ? '+' : '−'}
                      {Math.abs(points).toFixed(1)} score points
                    </span>
                  ) : null}
                  <span className="text-13 text-ink-3 tabular-nums">{formatDamage(s.damage)} per rotation</span>
                  {trying ? (
                    <span className="rounded-full border border-signal px-3 py-1 text-13 text-ink">Trying now</span>
                  ) : (
                    <Button onClick={() => actions.setPreview(toward(s.build, build), label)}>
                      Try it<span className="sr-only">: {text.title}</span>
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-page" aria-hidden="true">
                <div className={`h-1.5 rounded-full ${s.gain >= 0 ? 'bg-signal' : 'bg-loss'}`} style={{ width: `${(Math.abs(s.gain) / scale) * 100}%` }} />
              </div>
            </li>
          )
        })}
      </ol>
      {ranked.length > SHOWN ? (
        <Button variant="quiet" className="mt-3" onClick={() => setShowAll(!showAll)}>
          {showAll ? `Show the top ${SHOWN}` : `Show all ${ranked.length}`}
        </Button>
      ) : null}
    </div>
  )
}

function Substats({ build }: { build: Build }) {
  const catalog = useCatalog()
  const [helpOpen, setHelpOpen] = useState(false)
  const values = useMemo(() => rankSubstats(build, catalog), [build, catalog])
  if (values.length === 0) return <EmptyState>Add Echoes on the Build page to see what each substat is worth.</EmptyState>
  const best = Math.max(...values.map((v) => v.perRoll), 1e-9)

  return (
    <div>
      <p className="font-display text-16 md:text-20">{farmingGoal(values, catalog)}</p>
      <p className="mt-1 text-13 text-ink-3">
        Ranked by damage gained from one more roll at the average value.{' '}
        <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={() => setHelpOpen(true)}>
          What these numbers mean
        </button>
      </p>
      <ol className="mt-3 grid gap-2">
        {values.map((v, i) => (
          <SubstatRow key={v.row} value={v} place={i + 1} best={best} />
        ))}
      </ol>
      {values.some((v) => catalog.echoStats.substats[v.row]?.stat === 'energyRegen' && v.perRoll === 0) ? (
        <p className="mt-3 max-w-[64ch] text-13 text-ink-3">
          Energy Regen adds no damage to this rotation, but your rotation may still need it to have the Liberation ready. That is a cost these numbers do not see.
        </p>
      ) : null}
      <Sheet open={helpOpen} onOpenChange={setHelpOpen} title="What these numbers mean" description="Every number is a full re-calculation of this rotation.">
        <dl className="space-y-4 text-ink-2">
          <div>
            <dt className="font-medium text-ink">Priority</dt>
            <dd>The order of the list: the stat worth the most per roll comes first.</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">Per average roll</dt>
            <dd>Damage gained by adding one more roll of this stat, at the average value Kuro Games publishes for it, to your Echoes as they are now.</dd>
          </div>
          <div>
            <dt className="font-medium text-ink">Giving you now</dt>
            <dd>How much of your damage this stat on your Echoes is responsible for, found by taking every roll of it away and re-calculating.</dd>
          </div>
        </dl>
      </Sheet>
    </div>
  )
}

function SubstatRow({ value, place, best }: { value: SubstatValue; place: number; best: number }) {
  const catalog = useCatalog()
  const row = catalog.echoStats.substats[value.row]
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 rounded-panel bg-raised px-3 py-2.5 md:grid-cols-[2rem_minmax(0,1fr)_9rem_9rem]">
      <span className="font-display text-14 text-ink-3">{place}</span>
      <div className="min-w-0">
        <p className={value.perRoll > 0 ? 'text-ink' : 'text-ink-3'}>{row?.label}</p>
        <div className="mt-1.5 h-1.5 rounded-full bg-page" aria-hidden="true">
          <div className="h-1.5 rounded-full bg-signal" style={{ width: `${(value.perRoll / best) * 100}%` }} />
        </div>
      </div>
      <p className="col-start-2 mt-1 text-13 text-ink-2 tabular-nums md:col-start-auto md:mt-0 md:text-right">
        {value.perRoll > 0 ? `+${(value.perRoll * 100).toFixed(2)}%` : 'Nothing'} <span className="text-ink-3">per average roll</span>
      </p>
      <p className="col-start-2 text-13 text-ink-2 tabular-nums md:col-start-auto md:text-right">
        {value.count > 0 ? `${(value.share * 100).toFixed(1)}%` : 'None'} <span className="text-ink-3">giving you now</span>
      </p>
    </li>
  )
}

function UpgradePath({ build, options }: { build: Build; options: SuggestOptions }) {
  const catalog = useCatalog()
  const actions = useActions()
  const path = useMemo(() => upgradePath(build, catalog, options, 3), [build, catalog, options])
  const apply = (count: number) => {
    let from = build
    for (const step of path.slice(0, count)) {
      actions.applyEdit(toward(step.build, from), changeLabel(step.change, from, catalog))
      from = step.build
    }
  }

  return (
    <section aria-labelledby="path-title" className="self-start rounded-section bg-panel p-4 md:p-6">
      <h2 id="path-title" className="font-display text-16 md:text-20">
        Step by step
      </h2>
      <p className="mt-1 text-13 text-ink-2">The single best change, then the best change after that. Each step is saved on its own, so undo takes back one at a time.</p>
      {path.length === 0 ? (
        <p className="mt-4 text-ink">No single weapon, set or main stat change adds damage right now. Look at Substats for what to farm next.</p>
      ) : (
        <>
          <ol className="mt-4 grid gap-2">
            {path.map((step, i) => {
              const from = i === 0 ? build : path[i - 1]!.build
              const text = describeChange(step.change, from, catalog)
              return (
                <li key={i} className="rounded-panel bg-raised p-3">
                  <p className="text-13 text-ink-3">Step {i + 1}</p>
                  <p className="font-semibold text-ink">{text.title}</p>
                  <p className="mt-1 text-13 text-ink-2 tabular-nums">
                    {gainText(step.gain)} on the step before. Running total {gainText(step.totalGain).replace(' damage', '')}.
                  </p>
                </li>
              )
            })}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => apply(1)}>
              Apply step 1
            </Button>
            {path.length > 1 ? <Button onClick={() => apply(path.length)}>Apply all {path.length}</Button> : null}
          </div>
        </>
      )}
    </section>
  )
}

function OwnedWeapons({ build }: { build: Build }) {
  const catalog = useCatalog()
  const actions = useActions()
  const owned = useWorkspace((s) => s.library.ownedWeaponIds)
  const type = catalog.resonators[build.resonator.id]?.weaponType
  const weapons = Object.values(catalog.weapons)
    .filter((w) => w.weaponType === type)
    .sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name))
  return (
    <ul className="divide-y divide-rule">
      {weapons.map((w) => (
        <li key={w.id}>
          <label className="flex min-h-12 items-center gap-3 py-1">
            <input
              type="checkbox"
              className="size-5 accent-[var(--color-signal)]"
              checked={owned.includes(w.id)}
              onChange={(event) => actions.setOwnedWeapon(w.id, event.target.checked)}
            />
            <span className="flex-1 text-ink">{w.name}</span>
            <span className="text-13 text-ink-3">{w.rarity} star</span>
          </label>
        </li>
      ))}
    </ul>
  )
}
