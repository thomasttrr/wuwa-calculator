import { Tabs } from 'radix-ui'
import { useMemo } from 'react'
import { useActions, useCatalog, useWorkspace } from '../../app/context'
import { useResults } from '../../app/results'
import { buildLedger } from '../../engine/ledger/ledger'
import type { HitResult } from '../../engine/formula/hit'
import type { StepResult } from '../../engine/rotation/simulate'
import { DAMAGE_TYPE_NAME, ELEMENT_NAME, formatDamage, formatPercent } from '../../ui/format'
import { Mark } from '../../ui/Mark'
import { LEDGER_GROUPS, LedgerRow } from './LedgerView'

const TAB_KEY = 'build.resultsTab'

export function ResultsTabs() {
  const actions = useActions()
  const tab = useWorkspace((s) => (s.session.toolUi[TAB_KEY] as string | undefined) ?? 'stats')
  return (
    <Tabs.Root value={tab} onValueChange={(value) => actions.setToolUi(TAB_KEY, value)} className="border-t border-rule pt-2">
      <Tabs.List aria-label="Results" className="flex gap-1 border-b border-rule">
        {[
          ['stats', 'Stats'],
          ['damage', 'Damage by hit'],
        ].map(([value, label]) => (
          <Tabs.Trigger
            key={value}
            value={value ?? ''}
            className="min-h-11 border-b-2 border-transparent px-3 text-ink-2 hover:text-ink data-[state=active]:border-signal data-[state=active]:text-ink md:min-h-10"
          >
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content value="stats" className="pt-3">
        <StatsTab />
      </Tabs.Content>
      <Tabs.Content value="damage" className="pt-3">
        <DamageTab />
      </Tabs.Content>
    </Tabs.Root>
  )
}

function StatsTab() {
  const catalog = useCatalog()
  const results = useResults()
  const ledger = useMemo(() => (results ? buildLedger(results.build, catalog) : null), [results, catalog])
  if (!ledger || !results) return null
  // Only the resistances this rotation meets, plus the Resonator's own element.
  const hitElements = new Set<string>([
    catalog.resonators[results.build.resonator.id]?.element ?? '',
    ...results.simulation.steps.flatMap((step) => step.action.parts.map((part) => part.facets.element)),
  ])
  const shown = ledger.entries.filter((entry) => !entry.id.startsWith('enemy.resistance.') || hitElements.has(entry.id.slice('enemy.resistance.'.length)))
  return (
    <div className="space-y-5">
      <p className="text-13 text-ink-3">Open any stat to see where each part comes from. Bonuses that apply only to some hits are listed under Damage bonuses.</p>
      {LEDGER_GROUPS.filter((group) => group.title !== 'Rotation' && group.title !== 'Parts of ATK, HP and DEF').map((group) => {
        const entries = shown.filter((entry) => group.match(entry.id))
        if (entries.length === 0) return null
        return (
          <section key={group.title} aria-label={group.title}>
            <h3 className="mb-1 text-13 text-ink-3">{group.title}</h3>
            {entries.map((entry) =>
              ['atk', 'hp', 'def'].includes(entry.id) ? (
                <ScaledStatRow key={entry.id} id={entry.id} entries={ledger.entries} />
              ) : (
                <LedgerRow key={entry.id} entry={entry} />
              ),
            )}
          </section>
        )
      })}
    </div>
  )
}

/** ATK, HP and DEF open into their base, percent and flat parts. */
function ScaledStatRow({ id, entries }: { id: string; entries: ReturnType<typeof buildLedger>['entries'] }) {
  const total = entries.find((entry) => entry.id === id)
  const parts = entries.filter((entry) => entry.id.startsWith(`${id}.`))
  if (!total) return null
  return (
    <details className="group border-b border-rule">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="text-ink-3 transition-transform duration-150 group-open:rotate-90">
            ›
          </span>
          {total.label}
          {total.hasUnverified ? <Mark kind="unverified" /> : null}
        </span>
        <span className="font-semibold tabular-nums">{formatDamage(total.value)}</span>
      </summary>
      <div className="pb-2 pl-5">
        <p className="text-13 text-ink-2">{total.formula}</p>
        {parts.map((part) => (
          <LedgerRow key={part.id} entry={part} />
        ))}
      </div>
    </details>
  )
}

function DamageTab() {
  const results = useResults()
  if (!results) return null
  const { simulation } = results
  const max = Math.max(...simulation.steps.map((step) => step.action.average), 1)
  return (
    <div>
      <p className="text-13 text-ink-3">
        Every step of the rotation, in order. Open one to see its formula with your numbers in it.
      </p>
      <ol className="mt-2">
        {simulation.steps.map((step, index) => (
          <StepRow key={`${step.stepId}-${index}`} step={step} share={step.action.average / (simulation.total.average || 1)} width={step.action.average / max} />
        ))}
      </ol>
      {simulation.uncounted.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-13 text-ink-3">Not counted</h3>
          <ul>
            {simulation.uncounted.map((line, index) => (
              <li key={index} className="border-b border-rule py-2 text-13">
                <span className="flex flex-wrap items-center gap-2 text-ink">
                  {line.name}
                  <Mark kind="notModelled" detail={line.reason} />
                </span>
                <span className="text-ink-3">{line.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export function StepRow({ step, share, width }: { step: StepResult; share: number; width: number }) {
  const { action } = step
  return (
    <li className="border-b border-rule">
      <details className="group">
        <summary className="grid min-h-12 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-2 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="text-ink-3 transition-transform duration-150 group-open:rotate-90">
              ›
            </span>
            <span className="truncate">{action.name}</span>
            {action.hasUnverified ? <Mark kind="unverified" /> : null}
          </span>
          <span className="text-right tabular-nums">
            <span className="font-semibold">{formatDamage(action.average)}</span>
            <span className="ml-2 text-13 text-ink-3">{formatPercent(share)}</span>
          </span>
          <span className="col-span-2 block h-1 rounded-full bg-rule" aria-hidden="true">
            <span className="block h-1 rounded-full bg-signal-dim" style={{ width: `${Math.max(width * 100, 1)}%` }} />
          </span>
        </summary>
        <div className="space-y-4 pb-3 pl-5">
          {action.parts.map((part, index) => (
            <HitFormula key={index} part={part} index={index} total={action.parts.length} />
          ))}
        </div>
      </details>
    </li>
  )
}

const TERM_NAME: Record<string, string> = {
  dmgBonus: '1 + DMG Bonus',
  amplify: '1 + DMG Amplify',
  special: '1 + Special DMG',
  defense: 'Enemy defence',
  resistance: 'Enemy resistance',
}

function HitFormula({ part, index, total }: { part: HitResult; index: number; total: number }) {
  const { formula } = part
  const scaling = { atk: 'ATK', hp: 'HP', def: 'DEF', energyRegen: 'Energy Regen' }[formula.scalingStat]
  return (
    <div className="text-13">
      <p className="text-ink-2">
        {total > 1 ? `Part ${index + 1} of ${total}. ` : ''}
        {ELEMENT_NAME[part.facets.element]}, counts as {DAMAGE_TYPE_NAME[part.facets.damageType]}
        {part.count > 1 ? `, lands ${part.count} times` : ''}.
      </p>
      <table className="mt-1 w-full max-w-md text-left">
        <tbody className="tabular-nums">
          <tr className="border-b border-rule">
            <th className="py-1 font-normal text-ink-2">
              {scaling} {formatDamage(formula.scalingValue)} x multiplier {formatPercent(formula.multiplier, 2)}
              {formula.flat > 0 ? ` + ${formatDamage(formula.flat)}` : ''}
            </th>
            <td className="py-1 text-right">{(formula.terms[0]?.value ?? 0).toFixed(1)}</td>
          </tr>
          {formula.terms.slice(1).map((term) => (
            <tr key={term.key} className="border-b border-rule">
              <th className="py-1 font-normal text-ink-2">x {TERM_NAME[term.key] ?? term.key}</th>
              <td className="py-1 text-right">{term.value.toFixed(4)}</td>
            </tr>
          ))}
          <tr className="border-b border-rule">
            <th className="py-1 font-medium">Damage per landing, no crit</th>
            <td className="py-1 text-right font-medium">{formatDamage(part.perHit.nonCrit)}</td>
          </tr>
          <tr className="border-b border-rule">
            <th className="py-1 font-normal text-ink-2">On a crit (x Crit. DMG {formatPercent(formula.critDmg)})</th>
            <td className="py-1 text-right">{formatDamage(part.perHit.crit)}</td>
          </tr>
          <tr>
            <th className="py-1 font-normal text-ink-2">Average (Crit. Rate {formatPercent(formula.critRate)})</th>
            <td className="py-1 text-right">{formatDamage(part.perHit.average)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-ink-3">
        Enemy level {formula.defense.enemyLevel}, DEF {formatDamage(formula.defense.enemyDef)}; resistance {formatPercent(formula.resistance.total)} after reductions.
      </p>
    </div>
  )
}
