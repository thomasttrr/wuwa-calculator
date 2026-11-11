import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useCatalog, useWorkspace } from '../../app/context'
import { buildLedger } from '../../engine/ledger/ledger'
import { simulateRotation } from '../../engine/rotation/simulate'
import type { Build } from '../../engine/types/build'
import { SelectField } from '../../ui/Field'
import { formatDamage, formatPercent } from '../../ui/format'
import { EmptyState } from '../../ui/Section'
import { useBuildSummary } from '../saved/useBuildSummary'
import { setupDifferences } from './diff'

const STAT_ROWS = ['atk', 'critRate', 'critDmg', 'energyRegen']

export function ComparePage() {
  const catalog = useCatalog()
  const builds = useWorkspace((s) => s.library.builds)
  const order = useWorkspace((s) => s.library.order)
  const activeId = useWorkspace((s) => s.session.activeBuildId)
  const [params, setParams] = useSearchParams()

  const aId = params.get('a') ?? activeId ?? order[0] ?? ''
  const bId = params.get('b') ?? order.find((id) => id !== aId) ?? ''
  const a = builds[aId]
  const b = builds[bId]
  const options = order.map((id) => ({ value: id, label: builds[id]?.name ?? id }))

  const differences = useMemo(() => (a && b ? setupDifferences(a, b, catalog) : []), [a, b, catalog])

  if (order.length < 2) {
    return (
      <div>
        <h1 className="font-display text-26 md:text-34">Compare</h1>
        <div className="mt-6">
          <EmptyState>You need two saved builds to compare. Duplicate this one from the build list, change something, then come back.</EmptyState>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-display text-26 md:text-34">Compare</h1>
      <p className="mt-2 max-w-[64ch] text-ink-2">Pick any two saved builds. Differences are shown from the first build's point of view.</p>
      <div className="mt-4 grid max-w-2xl grid-cols-2 gap-3">
        <SelectField label="First build" value={aId} options={options} onChange={(value) => setParams({ a: value, b: bId })} />
        <SelectField label="Second build" value={bId} options={options} onChange={(value) => setParams({ a: aId, b: value })} />
      </div>

      {a && b ? (
        <>
          <section aria-label="Can these be compared?" className="mt-6 border-t border-rule pt-4">
            {differences.length === 0 ? (
              <p className="text-ink">Same setup. These scores and damage numbers can be compared directly.</p>
            ) : (
              <>
                <p className="text-ink">
                  Different setups. Each score is on its own build's scale, so compare damage, not scores, and keep the differences below in mind.
                </p>
                <ul className="mt-2 list-disc pl-5 text-ink-2">
                  {differences.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
          <CompareTable a={a} b={b} />
        </>
      ) : null}
    </div>
  )
}

function CompareTable({ a, b }: { a: Build; b: Build }) {
  const catalog = useCatalog()
  const sa = useBuildSummary(a)
  const sb = useBuildSummary(b)
  const la = useMemo(() => buildLedger(a, catalog), [a, catalog])
  const lb = useMemo(() => buildLedger(b, catalog), [b, catalog])
  const ra = useMemo(() => simulateRotation(a, catalog), [a, catalog])
  const rb = useMemo(() => simulateRotation(b, catalog), [b, catalog])
  const entry = (ledger: typeof la, id: string) => ledger.entries.find((e) => e.id === id)

  const actionIds = [...new Set([...ra.byAction.map((r) => r.key), ...rb.byAction.map((r) => r.key)])]
  const change = (from: number, to: number) => {
    if (from === 0) return ''
    const ratio = to / from - 1
    if (Math.abs(ratio) < 0.0005) return 'same'
    return `${ratio > 0 ? '+' : ''}${(ratio * 100).toFixed(1)}%`
  }
  const tone = (from: number, to: number) => (to > from * 1.0005 ? 'text-gain' : to < from * 0.9995 ? 'text-loss' : 'text-ink-3')

  const rows: { label: string; a: string; b: string; diff?: string; className?: string }[] = [
    { label: 'Resonator', a: catalog.resonators[a.resonator.id]?.name ?? '', b: catalog.resonators[b.resonator.id]?.name ?? '' },
    {
      label: 'Weapon',
      a: a.weapon ? `${catalog.weapons[a.weapon.id]?.name} R${a.weapon.rank}` : 'None',
      b: b.weapon ? `${catalog.weapons[b.weapon.id]?.name} R${b.weapon.rank}` : 'None',
    },
    {
      label: 'Score',
      a: sa?.score ? `${sa.score.percent.toFixed(1)}% (${sa.score.grade})` : 'Scoring',
      b: sb?.score ? `${sb.score.percent.toFixed(1)}% (${sb.score.grade})` : 'Scoring',
    },
    {
      label: 'Rotation damage',
      a: formatDamage(ra.total.average),
      b: formatDamage(rb.total.average),
      diff: change(ra.total.average, rb.total.average),
      className: tone(ra.total.average, rb.total.average),
    },
    ...STAT_ROWS.map((id) => {
      const ea = entry(la, id)
      const eb = entry(lb, id)
      const format = (value: number | undefined) => (value === undefined ? '' : id === 'atk' ? formatDamage(value) : formatPercent(value))
      return { label: ea?.label ?? id, a: format(ea?.value), b: format(eb?.value) }
    }),
  ]

  return (
    <div className="mt-6 border-t border-rule pt-4">
      <h2 className="font-display text-20">Side by side</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[20rem] text-left">
          <thead className="text-13 text-ink-3">
            <tr className="border-b border-rule">
              <th className="py-2 font-normal">
                <span className="sr-only">What</span>
              </th>
              <th className="py-2 font-normal">{a.name}</th>
              <th className="py-2 font-normal">{b.name}</th>
              <th className="py-2 text-right font-normal">Change</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-rule">
                <th className="py-2 pr-3 font-normal text-ink-2">{row.label}</th>
                <td className="py-2 pr-3">{row.a}</td>
                <td className="py-2 pr-3">{row.b}</td>
                <td className={`py-2 text-right ${row.className ?? 'text-ink-3'}`}>{row.diff ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-6 font-medium">Damage by skill</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[20rem] text-left">
          <tbody className="tabular-nums">
            {actionIds.map((id) => {
              const x = ra.byAction.find((r) => r.key === id)
              const y = rb.byAction.find((r) => r.key === id)
              const from = x?.average ?? 0
              const to = y?.average ?? 0
              return (
                <tr key={id} className="border-b border-rule">
                  <th className="py-2 pr-3 font-normal text-ink-2">{x?.label ?? y?.label}</th>
                  <td className="py-2 pr-3">{x ? formatDamage(from) : 'Not in rotation'}</td>
                  <td className="py-2 pr-3">{y ? formatDamage(to) : 'Not in rotation'}</td>
                  <td className={`py-2 text-right ${tone(from, to)}`}>{x && y ? change(from, to) : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
