import { Gauge, Image, Lightbulb, ListOrdered, Plus, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useActions, useCatalog, useWorkspace } from '../../app/context'
import { defaultBuildFor } from '../../data/defaults'
import type { Build } from '../../engine/types/build'
import { ResonatorPicker } from '../build/pickers'
import { useBuildSummary } from '../saved/useBuildSummary'
import { Button } from '../../ui/Button'
import { Portrait } from '../../ui/ElementChip'
import { formatDamage } from '../../ui/format'
import { Meter } from '../../ui/Meter'
import { EmptyState, Section } from '../../ui/Section'

export function HomePage() {
  const catalog = useCatalog()
  const actions = useActions()
  const navigate = useNavigate()
  const builds = useWorkspace((s) => s.library.builds)
  const order = useWorkspace((s) => s.library.order)
  const activeId = useWorkspace((s) => s.session.activeBuildId)
  const settings = useWorkspace((s) => s.meta.settings)
  const [picking, setPicking] = useState(false)

  const active = activeId ? builds[activeId] : order[0] ? builds[order[0]] : undefined
  const summary = useBuildSummary(active)
  const resonator = active ? catalog.resonators[active.resonator.id] : undefined

  const next = (() => {
    if (!active) {
      return {
        title: 'Start your first build',
        text: 'Choose a Resonator, then change one thing and watch the score move.',
        to: null as string | null,
        action: 'Choose a Resonator',
      }
    }
    if (!summary) {
      return { title: 'Open the build', text: 'Change anything and every tool updates together.', to: '/build', action: 'Open the build' }
    }
    if (!summary.score) {
      return { title: 'Scoring this setup', text: 'The reference builds are still being worked out. The damage figure is ready now.', to: '/build', action: 'Open the build' }
    }
    if (summary.score.percent < 100) {
      return {
        title: 'Improve the Echo stats',
        text: 'This build is below the reference. Suggestions shows the single change that adds the most damage.',
        to: '/suggestions',
        action: 'Open Suggestions',
      }
    }
    if (summary.score.percent < 150) {
      return {
        title: 'Try the Optimizer',
        text: 'You are past the reference. Search the Echoes you own for a better set and main stats.',
        to: '/optimizer',
        action: 'Open the Optimizer',
      }
    }
    return {
      title: 'Make a card',
      text: 'This build is close to the maximum for its setup. Save a picture, or try a different rotation.',
      to: '/card',
      action: 'Open Card',
    }
  })()

  const startBuild = (id: number) => {
    actions.addBuild(defaultBuildFor(id, catalog, undefined, { targetLevel: settings.defaultTargetLevel, resistances: settings.defaultResistances }))
    setPicking(false)
    void navigate('/build')
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-34 md:text-44">Your build lab</h1>
          <p className="mt-2 max-w-[64ch] text-ink-2">One build, seven tools. Change an Echo once and the score, suggestions, rotation and card all agree.</p>
        </div>
        <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setPicking(true)}>
          New build
        </Button>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section aria-labelledby="open-build" className="rounded-section bg-panel p-4 md:p-6">
          <h2 id="open-build" className="font-display text-16 md:text-20">
            {active ? 'Open now' : 'Nothing open yet'}
          </h2>
          {active && resonator ? (
            <>
              <div className="mt-4 flex min-w-0 items-center gap-4">
                <Portrait name={resonator.name} element={resonator.element} size={64} />
                <div className="min-w-0">
                  <p className="truncate font-display text-20 md:text-26">{active.name}</p>
                  <p className="truncate text-ink-3">
                    {resonator.name}, level {active.resonator.level}, Sequence {active.resonator.sequence}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-end gap-6">
                <div>
                  <p className="text-12 text-ink-3">Build score</p>
                  <p className="font-display text-44 tabular-nums md:text-64">{summary?.score ? `${summary.score.percent.toFixed(1)}%` : 'Scoring'}</p>
                  {summary?.score ? <p className="text-13 text-ink-2">Grade {summary.score.grade}</p> : null}
                </div>
                <div>
                  <p className="text-12 text-ink-3">Rotation damage</p>
                  <p className="font-display text-26 tabular-nums">{summary ? formatDamage(summary.damage) : 'Working'}</p>
                  <p className="text-13 text-ink-3">average per rotation</p>
                </div>
              </div>
              {summary?.score ? (
                <div className="mt-4 max-w-xl">
                  <Meter value={summary.score.percent} min={0} max={200} label="Build score" valueText={`${summary.score.percent.toFixed(1)} percent, grade ${summary.score.grade}`} />
                  <p className="mt-1 text-12 text-ink-3">0 is no Echoes. 100 is the reference. 200 is the maximum.</p>
                </div>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/build" className="inline-flex min-h-11 items-center rounded-control bg-signal px-4 text-14 font-semibold text-on-signal md:min-h-9">
                  Open the build
                </Link>
                <Link to="/card" className="inline-flex min-h-11 items-center gap-2 rounded-control border border-rule px-4 text-14 font-medium text-ink hover:bg-raised md:min-h-9">
                  <Image size={16} aria-hidden="true" />
                  Make a card
                </Link>
              </div>
            </>
          ) : (
            <div className="mt-4">
              <EmptyState action={<Button onClick={() => setPicking(true)}>Choose a Resonator</Button>}>
                No build is open. Start one from any Resonator; the sample build stays in your list.
              </EmptyState>
            </div>
          )}
        </section>

        <section aria-labelledby="next-step" className="rounded-section bg-panel p-4 md:p-6">
          <h2 id="next-step" className="flex items-center gap-2 font-display text-16 md:text-20">
            <Sparkles size={18} aria-hidden="true" />
            Next step
          </h2>
          <p className="mt-4 font-display text-16">{next.title}</p>
          <p className="mt-2 text-ink-2">{next.text}</p>
          <div className="mt-4">
            {next.to ? (
              <Link to={next.to} className="inline-flex min-h-11 items-center rounded-control bg-signal px-4 text-14 font-semibold text-on-signal md:min-h-9">
                {next.action}
              </Link>
            ) : (
              <Button variant="primary" onClick={() => setPicking(true)}>
                {next.action}
              </Button>
            )}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2 text-13">
            <ToolLink to="/suggestions" icon={<Lightbulb size={16} aria-hidden="true" />} label="Suggestions" />
            <ToolLink to="/optimizer" icon={<Gauge size={16} aria-hidden="true" />} label="Optimizer" />
            <ToolLink to="/rotation" icon={<ListOrdered size={16} aria-hidden="true" />} label="Rotation" />
            <ToolLink to="/card" icon={<Image size={16} aria-hidden="true" />} label="Card" />
          </div>
        </section>
      </div>

      <Section title="Your builds" id="builds" description="Every build saves in this browser as you work.">
        {order.length === 0 ? (
          <EmptyState action={<Button onClick={() => setPicking(true)}>Choose a Resonator</Button>}>No builds yet. Start with any Resonator.</EmptyState>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {order.map((id) => {
              const build = builds[id]
              return build ? <BuildRow key={id} build={build} active={id === active?.id} /> : null
            })}
          </ul>
        )}
      </Section>

      <ResonatorPicker open={picking} onOpenChange={setPicking} title="Start a new build" onPick={startBuild} />
    </div>
  )
}

function ToolLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="flex min-h-11 items-center gap-2 rounded-control border border-rule px-3 font-medium text-ink-2 hover:bg-raised hover:text-ink">
      {icon}
      {label}
    </Link>
  )
}

function BuildRow({ build, active }: { build: Build; active: boolean }) {
  const catalog = useCatalog()
  const actions = useActions()
  const navigate = useNavigate()
  const summary = useBuildSummary(build)
  const resonator = catalog.resonators[build.resonator.id]

  return (
    <li className={`rounded-panel border p-3 ${active ? 'border-ink bg-raised' : 'border-transparent bg-raised/60'}`}>
      <button
        type="button"
        onClick={() => {
          actions.switchBuild(build.id)
          void navigate('/build')
        }}
        className="flex w-full min-w-0 items-center gap-3 rounded-control text-left hover:bg-raised"
      >
        {resonator ? <Portrait name={resonator.name} element={resonator.element} size={40} /> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{build.name}</span>
          <span className="block truncate text-13 text-ink-3">
            {resonator?.name}, level {build.resonator.level}
            {active ? ', open now' : ''}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-display text-16 tabular-nums">{summary?.score ? `${summary.score.percent.toFixed(1)}%` : 'Scoring'}</span>
          <span className="block text-12 text-ink-3 tabular-nums">{summary ? formatDamage(summary.damage) : ''}</span>
        </span>
      </button>
    </li>
  )
}
