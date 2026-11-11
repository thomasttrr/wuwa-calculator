import { useMemo } from 'react'
import { useCatalog } from '../../app/context'
import { useResults } from '../../app/results'
import { buildLedger } from '../../engine/ledger/ledger'
import { Sheet } from '../../ui/Sheet'
import { LEDGER_GROUPS, LedgerRow } from './LedgerView'
import { Stamp } from './ScorePanel'

/** The whole build, every number with what it is made of. */
export function LedgerSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const catalog = useCatalog()
  const results = useResults()
  const ledger = useMemo(() => (results && open ? buildLedger(results.build, catalog) : null), [results, catalog, open])
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="How this was calculated"
      description="Every number behind this build's result, and what it is made of. Open any line to see its parts."
    >
      {ledger ? (
        <div className="space-y-6">
          <p className="text-13 text-ink-2">
            Each hit deals: the stat it scales with x its multiplier, x (1 + DMG Bonus), x (1 + DMG Amplify), x enemy defence, x enemy resistance. A critical hit
            multiplies that by Crit. DMG. The average uses your Crit. Rate. The Damage tab shows this worked out for every hit.
          </p>
          {LEDGER_GROUPS.map((group) => {
            const entries = ledger.entries.filter((entry) => group.match(entry.id))
            if (entries.length === 0) return null
            return (
              <section key={group.title} aria-label={group.title}>
                <h3 className="mb-1 font-medium">{group.title}</h3>
                {entries.map((entry) => (
                  <LedgerRow key={entry.id} entry={entry} open={group.title === 'Rotation'} />
                ))}
              </section>
            )
          })}
          <p className="text-13 text-ink-3">
            Formula source: Wuthering Waves Wiki, Damage page (community content, CC-BY-SA). Game values: encore.moe, checked against nanoka.cc.
          </p>
          <Stamp />
        </div>
      ) : null}
    </Sheet>
  )
}
