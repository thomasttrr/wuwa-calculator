// Shows ledger entries: each number with the parts it is made of. Used by the Stats tab and the
// "How this was calculated" sheet, so both explain numbers the same way.
import type { LedgerEntry } from '../../engine/ledger/ledger'
import { formatDamage, formatPercent } from '../../ui/format'
import { Mark } from '../../ui/Mark'

export function formatLedgerValue(entry: Pick<LedgerEntry, 'unit'>, value: number): string {
  switch (entry.unit) {
    case 'number':
      return formatDamage(value)
    case 'percent':
      return formatPercent(value)
    case 'multiplier':
      return `x${value.toFixed(4)}`
    case 'damage':
      return formatDamage(value)
  }
}

export function LedgerRow({ entry, open = false }: { entry: LedgerEntry; open?: boolean }) {
  const hasDetail = entry.parts.length > 0 || entry.formula || entry.note || entry.startsFrom !== undefined
  const value = <span className="shrink-0 font-semibold tabular-nums">{formatLedgerValue(entry, entry.value)}</span>
  const label = (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="text-ink">{entry.label}</span>
      {entry.hasUnverified ? <Mark kind="unverified" /> : null}
    </span>
  )
  if (!hasDetail) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-4 border-b border-rule">
        {label}
        {value}
      </div>
    )
  }
  return (
    <details open={open} className="group border-b border-rule">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="text-ink-3 transition-transform duration-150 group-open:rotate-90">
            ›
          </span>
          {label}
        </span>
        {value}
      </summary>
      <div className="pb-3 pl-5 text-13">
        {entry.formula ? <p className="text-ink-2">{entry.formula}</p> : null}
        {entry.startsFrom !== undefined ? (
          <div className="flex justify-between gap-4 py-1 text-ink-2">
            <span>Starting value</span>
            <span className="tabular-nums">{formatLedgerValue(entry, entry.startsFrom)}</span>
          </div>
        ) : null}
        {entry.parts.length > 0 ? (
          <ul>
            {entry.parts.map((part, index) => (
              <li key={index} className="flex justify-between gap-4 py-1 text-ink-2">
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  {part.label}
                  {!part.verified ? <Mark kind="unverified" /> : null}
                  {part.kind === 'custom' ? <Mark kind="custom" /> : null}
                </span>
                <span className="shrink-0 tabular-nums">+{formatLedgerValue(entry, part.value)}</span>
              </li>
            ))}
          </ul>
        ) : entry.combine === 'sum' ? (
          <p className="text-ink-3">Nothing adds to this yet.</p>
        ) : null}
        {entry.note ? <p className="mt-1 text-ink-3">{entry.note}</p> : null}
      </div>
    </details>
  )
}

export const LEDGER_GROUPS: { title: string; match: (id: string) => boolean }[] = [
  { title: 'Stats', match: (id) => ['atk', 'hp', 'def', 'critRate', 'critDmg', 'energyRegen', 'healingBonus'].includes(id) },
  { title: 'Parts of ATK, HP and DEF', match: (id) => /^(atk|hp|def)\./.test(id) },
  { title: 'Damage bonuses', match: (id) => id.startsWith('dmgBonus') },
  { title: 'Other modifiers', match: (id) => ['amplify', 'special', 'multiplierBonus', 'flatDmg', 'defIgnore', 'defReduction', 'resReduction'].includes(id) },
  { title: 'Against this target', match: (id) => id.startsWith('enemy.') },
  { title: 'Rotation', match: (id) => id.startsWith('rotation.') },
]
