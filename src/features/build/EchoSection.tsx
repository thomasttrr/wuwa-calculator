import { castDraft } from 'immer'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useCatalog } from '../../app/context'
import { countSonataPieces } from '../../engine/stats/collect'
import type { Build } from '../../engine/types/build'
import { COST_BUDGET } from '../../engine/score/ideal'
import { BorderBeam } from '../../ui/BorderBeam'
import { Button } from '../../ui/Button'
import { formatStatValue, statLabel } from '../../ui/format'
import { Section } from '../../ui/Section'
import { Sheet } from '../../ui/Sheet'
import { substatTone } from '../../explain/echo-bloom'
import { EchoFields, newEcho } from '../echoes/EchoFields'
import { TONE_COLOUR } from './EchoBloom'
import { CostBadge, EchoPicker } from './pickers'
import { useEdit } from './useEdit'

function usedCost(build: Build, exceptSlot: number): number {
  return build.echoes.reduce((total, echo, slot) => total + (echo && slot !== exceptSlot ? echo.cost : 0), 0)
}

export function EchoSection({ build }: { build: Build }) {
  const catalog = useCatalog()
  const edit = useEdit()
  const [editing, setEditing] = useState<number | null>(null)
  const [choosingFor, setChoosingFor] = useState<number | null>(null)
  const total = usedCost(build, -1)
  const pieces = countSonataPieces(build)

  const setSummary = [...pieces]
    .filter(([, count]) => count >= 2)
    .map(([sonataId, count]) => {
      const sonata = catalog.sonatas[sonataId]
      const active = sonata?.effects.filter((effect) => count >= effect.pieces).map((effect) => effect.pieces) ?? []
      return `${sonata?.name ?? 'Set'}: ${count} pieces${active.length > 0 ? `, ${active.join(' and ')}-piece bonus active` : ''}`
    })

  return (
    <Section
      title="Echoes"
      id="echoes"
      description={`Cost ${total} of ${COST_BUDGET}. Slot 1 is your main Echo: its skill effect applies.`}
    >
      <ol className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {build.echoes.map((echo, slot) => {
          const def = echo ? catalog.echoes[echo.echoId] : undefined
          return (
            <li key={slot}>
              {echo && def ? (
                <button
                  type="button"
                  onClick={() => setEditing(slot)}
                  className={`relative flex w-full items-center gap-3 rounded-panel border-2 bg-raised px-3 py-2.5 text-left hover:border-rule-strong ${slot === 0 ? 'border-transparent motion-reduce:border-ink' : 'border-transparent'}`}
                >
                  {slot === 0 ? <BorderBeam colours="ember" duration={8} delay={3} size={120} /> : null}
                  <span className="sr-only">Edit Echo {slot + 1}: {def.name}. </span>
                  <CostBadge cost={echo.cost} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="truncate font-medium" aria-hidden="true">
                        {def.name}
                      </span>
                      {slot === 0 ? <span className="text-12 text-ink-3">Main Echo</span> : null}
                    </div>
                    <div className="truncate text-13 text-ink-3">
                      {catalog.sonatas[echo.sonataId]?.name}. {statLabel(echo.mainStat.stat, echo.mainStat.scope)}{' '}
                      {formatStatValue(echo.mainStat.stat, echo.mainStat.value)}, {echo.substats.length} of 5 substats
                    </div>
                    {echo.substats.length > 0 ? (
                      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-12 text-ink-2">
                        {echo.substats.map((sub, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full" style={{ background: TONE_COLOUR[substatTone(sub.stat)] }} aria-hidden="true" />
                            {statLabel(sub.stat, sub.scope)} {formatStatValue(sub.stat, sub.value)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setChoosingFor(slot)}
                  disabled={COST_BUDGET - usedCost(build, slot) < 1}
                  className="flex min-h-14 w-full items-center gap-3 rounded-panel border border-dashed border-rule-strong px-3 text-left text-ink-2 hover:bg-raised hover:text-ink disabled:opacity-50"
                >
                  <Plus size={16} aria-hidden="true" />
                  Add Echo {slot + 1}
                  {slot === 0 ? ' (main)' : ''}
                </button>
              )}
            </li>
          )
        })}
      </ol>
      {setSummary.length > 0 ? (
        <ul className="mt-3 text-13 text-ink-2">
          {setSummary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      <EchoPicker
        open={choosingFor !== null}
        onOpenChange={(open) => !open && setChoosingFor(null)}
        maxCost={choosingFor === null ? 4 : Math.min(4, COST_BUDGET - usedCost(build, choosingFor))}
        onPick={(echoId) => {
          const slot = choosingFor
          if (slot === null) return
          const name = catalog.echoes[echoId]?.name ?? 'Echo'
          const existing = build.echoes[slot]
          edit(existing ? `Changed Echo ${slot + 1} to ${name}` : `Added ${name} as Echo ${slot + 1}`, (draft) => {
            const fresh = newEcho(catalog, echoId)
            draft.echoes[slot] = castDraft(
              existing && existing.cost === fresh.cost ? { ...existing, echoId, sonataId: fresh.sonataId } : fresh,
            )
          })
          setChoosingFor(null)
          setEditing(slot)
        }}
      />

      {editing !== null && build.echoes[editing] ? (
        <EchoEditor
          build={build}
          slot={editing}
          onClose={() => setEditing(null)}
          onChangeEcho={() => {
            setChoosingFor(editing)
          }}
        />
      ) : null}
    </Section>
  )
}

function EchoEditor({ build, slot, onClose, onChangeEcho }: { build: Build; slot: number; onClose: () => void; onChangeEcho: () => void }) {
  const catalog = useCatalog()
  const edit = useEdit()
  const echo = build.echoes[slot]
  const def = echo ? catalog.echoes[echo.echoId] : undefined
  if (!echo || !def) return null

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Echo ${slot + 1}: ${def.name}`}
      description={`Cost ${echo.cost}. Main stats are at their level 25 value for a 5-star Echo.`}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
          <Button onClick={onChangeEcho}>Change Echo</Button>
          <Button
            variant="quiet"
            icon={<Trash2 size={16} aria-hidden="true" />}
            onClick={() => {
              edit(`Removed Echo ${slot + 1}`, (draft) => void (draft.echoes[slot] = null))
              onClose()
            }}
          >
            Remove
          </Button>
        </div>
      }
    >
      <EchoFields
        echo={echo}
        name={`Echo ${slot + 1}`}
        onChange={(next, label) =>
          edit(label, (draft) => {
            draft.echoes[slot] = castDraft(next)
          })
        }
      />
    </Sheet>
  )
}
