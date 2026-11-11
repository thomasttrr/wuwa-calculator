import { Copy, GitCompareArrows, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useActions, useCatalog, useWorkspace } from '../../app/context'
import type { Build } from '../../engine/types/build'
import { Button, IconButton } from '../../ui/Button'
import { Portrait } from '../../ui/ElementChip'
import { formatDamage } from '../../ui/format'
import { Mark } from '../../ui/Mark'
import { EmptyState } from '../../ui/Section'
import { useBuildSummary } from './useBuildSummary'

export function SavedPage() {
  const builds = useWorkspace((s) => s.library.builds)
  const order = useWorkspace((s) => s.library.order)
  const activeId = useWorkspace((s) => s.session.activeBuildId)

  return (
    <div>
      <h1 className="font-display text-26 md:text-34">Saved builds</h1>
      <p className="mt-2 max-w-[64ch] text-ink-2">
        Every build saves in this browser as you work. Open one to edit it, or compare any two side by side.
      </p>
      <div className="mt-6 border-t border-rule">
        {order.length === 0 ? (
          <div className="mt-4">
            <EmptyState>No builds yet. Start one from the build list at the top of the page.</EmptyState>
          </div>
        ) : (
          <ul>
            {order.map((id) => {
              const build = builds[id]
              return build ? <SavedRow key={id} build={build} active={id === activeId} /> : null
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function SavedRow({ build, active }: { build: Build; active: boolean }) {
  const catalog = useCatalog()
  const actions = useActions()
  const navigate = useNavigate()
  const activeId = useWorkspace((s) => s.session.activeBuildId)
  const summary = useBuildSummary(build)
  const [confirming, setConfirming] = useState(false)
  const resonator = catalog.resonators[build.resonator.id]
  const weapon = build.weapon ? catalog.weapons[build.weapon.id] : undefined

  return (
    <li className={`border-b border-rule py-3 ${active ? 'shadow-[inset_2px_0_0_var(--color-signal)] pl-3' : ''}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => {
            actions.switchBuild(build.id)
            void navigate('/build')
          }}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-control text-left hover:bg-raised"
        >
          {resonator ? <Portrait name={resonator.name} element={resonator.element} size={44} /> : null}
          <span className="min-w-0">
            <span className="block truncate font-medium">{build.name}</span>
            <span className="block truncate text-13 text-ink-3">
              {resonator?.name}, level {build.resonator.level}, S{build.resonator.sequence}. {weapon ? `${weapon.name} rank ${build.weapon?.rank}` : 'No weapon'}.
              {active ? ' Open now.' : ''}
            </span>
          </span>
        </button>
        <div className="flex items-center gap-4 sm:w-56 sm:justify-end">
          <div className="sm:text-right">
            <div className="font-display text-20 tabular-nums">{summary?.score ? `${summary.score.percent.toFixed(1)}%` : 'Scoring'}</div>
            <div className="text-12 text-ink-3 tabular-nums">
              {summary ? `${formatDamage(summary.damage)} per rotation` : ''}
              {summary?.score ? `, grade ${summary.score.grade}` : ''}
            </div>
          </div>
          {summary?.hasUnverified ? <Mark kind="unverified" /> : null}
        </div>
        <div className="flex items-center gap-1">
          {activeId && activeId !== build.id ? (
            <IconButton label={`Compare ${build.name} with the open build`} onClick={() => void navigate(`/compare?a=${activeId}&b=${build.id}`)}>
              <GitCompareArrows size={16} aria-hidden="true" />
            </IconButton>
          ) : null}
          <IconButton label={`Duplicate ${build.name}`} onClick={() => actions.duplicateBuild(build.id)}>
            <Copy size={16} aria-hidden="true" />
          </IconButton>
          <IconButton label={`Delete ${build.name}`} onClick={() => setConfirming(true)}>
            <Trash2 size={16} aria-hidden="true" />
          </IconButton>
        </div>
      </div>
      {confirming ? (
        <div role="alertdialog" aria-label={`Delete ${build.name}?`} className="mt-3 flex flex-wrap items-center gap-2 rounded-panel border border-rule bg-raised p-3">
          <span className="mr-auto">Delete {build.name}? Its undo history goes too.</span>
          <Button onClick={() => actions.deleteBuild(build.id)}>Delete build</Button>
          <Button variant="quiet" onClick={() => setConfirming(false)}>
            Keep it
          </Button>
        </div>
      ) : null}
    </li>
  )
}
