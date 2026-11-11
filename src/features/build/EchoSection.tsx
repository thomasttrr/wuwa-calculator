import { castDraft } from 'immer'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useCatalog } from '../../app/context'
import { countSonataPieces } from '../../engine/stats/collect'
import type { Build, EchoInstance, EchoSubstat } from '../../engine/types/build'
import type { Catalog } from '../../engine/types/catalog'
import type { Scope } from '../../engine/types/stats'
import { COST_BUDGET } from '../../engine/score/ideal'
import { Button } from '../../ui/Button'
import { SelectField } from '../../ui/Field'
import { formatStatValue, statLabel } from '../../ui/format'
import { EmptyState, Section } from '../../ui/Section'
import { Sheet } from '../../ui/Sheet'
import { CostBadge, EchoPicker } from './pickers'
import { useEdit } from './useEdit'

const sameScope = (a?: Scope, b?: Scope) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

function usedCost(build: Build, exceptSlot: number): number {
  return build.echoes.reduce((total, echo, slot) => total + (echo && slot !== exceptSlot ? echo.cost : 0), 0)
}

function newEcho(catalog: Catalog, echoId: number): EchoInstance {
  const def = catalog.echoes[echoId]
  if (!def) throw new Error(`Unknown Echo ${echoId}`)
  const main = catalog.echoStats.mainStats[def.cost][0]
  const fixed = catalog.echoStats.fixedStats[def.cost]
  if (!main) throw new Error(`No main stats for cost ${def.cost}`)
  return {
    uid: globalThis.crypto.randomUUID(),
    echoId,
    cost: def.cost,
    sonataId: def.sonataIds[0] ?? 0,
    mainStat: { stat: main.stat, ...(main.scope ? { scope: main.scope } : {}), value: main.value },
    fixedStat: { stat: fixed.stat, value: fixed.value },
    substats: [],
  }
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
      <ol className="grid gap-2">
        {build.echoes.map((echo, slot) => {
          const def = echo ? catalog.echoes[echo.echoId] : undefined
          return (
            <li key={slot}>
              {echo && def ? (
                <button
                  type="button"
                  onClick={() => setEditing(slot)}
                  className="flex w-full items-center gap-3 rounded-panel border border-rule bg-panel px-3 py-2.5 text-left hover:bg-raised"
                  aria-label={`Echo ${slot + 1}${slot === 0 ? ', main' : ''}: ${def.name}. Edit`}
                >
                  <CostBadge cost={echo.cost} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="truncate font-medium">{def.name}</span>
                      {slot === 0 ? <span className="text-12 text-ink-3">Main Echo</span> : null}
                    </div>
                    <div className="truncate text-13 text-ink-3">
                      {catalog.sonatas[echo.sonataId]?.name}. {statLabel(echo.mainStat.stat, echo.mainStat.scope)}{' '}
                      {formatStatValue(echo.mainStat.stat, echo.mainStat.value)}, {echo.substats.length} of 5 substats
                    </div>
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
  const tables = catalog.echoStats
  const mains = tables.mainStats[echo.cost]
  const mainIndex = mains.findIndex((main) => main.stat === echo.mainStat.stat && sameScope(main.scope, echo.mainStat.scope))

  const setSub = (index: number, sub: EchoSubstat | null, label: string) =>
    edit(label, (draft) => {
      const target = draft.echoes[slot]
      if (!target) return
      const subs = [...target.substats]
      if (sub) subs[index] = castDraft(sub)
      else subs.splice(index, 1)
      target.substats = subs
    })

  const rows = [...echo.substats, ...(echo.substats.length < 5 ? [null] : [])]

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
      <div className="grid gap-4">
        <SelectField
          label="Sonata set"
          value={String(echo.sonataId)}
          options={def.sonataIds.map((id) => ({ value: String(id), label: catalog.sonatas[id]?.name ?? String(id) }))}
          onChange={(value) =>
            edit(`Set Echo ${slot + 1} to ${catalog.sonatas[Number(value)]?.name}`, (draft) => {
              const target = draft.echoes[slot]
              if (target) target.sonataId = Number(value)
            })
          }
        />
        <SelectField
          label="Main stat"
          value={String(mainIndex)}
          options={mains.map((main, i) => ({ value: String(i), label: `${main.label} ${formatStatValue(main.stat, main.value)}` }))}
          onChange={(value) => {
            const main = mains[Number(value)]
            if (!main) return
            edit(`Set Echo ${slot + 1} main stat to ${main.label}`, (draft) => {
              const target = draft.echoes[slot]
              if (target) target.mainStat = castDraft({ stat: main.stat, ...(main.scope ? { scope: main.scope } : {}), value: main.value })
            })
          }}
        />
        <p className="text-13 text-ink-3">
          Fixed stat: {tables.fixedStats[echo.cost].label} {formatStatValue(echo.fixedStat.stat, echo.fixedStat.value)}
        </p>

        <fieldset className="grid gap-3">
          <legend className="font-medium">Substats</legend>
          {rows.map((sub, index) => {
            const tableIndex = sub ? tables.substats.findIndex((row) => row.stat === sub.stat && sameScope(row.scope, sub.scope)) : -1
            const row = tables.substats[tableIndex]
            const taken = new Set(
              echo.substats
                .filter((_, i) => i !== index)
                .map((other) => tables.substats.findIndex((r) => r.stat === other.stat && sameScope(r.scope, other.scope))),
            )
            return (
              <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,8rem)] gap-2">
                <SelectField
                  label={`Substat ${index + 1}`}
                  value={String(tableIndex)}
                  options={[
                    { value: '-1', label: sub ? 'Remove this substat' : 'Add a substat' },
                    ...tables.substats.map((r, i) => ({ value: String(i), label: r.label })).filter((option) => !taken.has(Number(option.value))),
                  ]}
                  onChange={(value) => {
                    const chosen = tables.substats[Number(value)]
                    if (!chosen) return setSub(index, null, `Removed a substat from Echo ${slot + 1}`)
                    const mid = chosen.rolls[Math.floor((chosen.rolls.length - 1) / 2)] ?? chosen.rolls[0] ?? 0
                    setSub(index, { stat: chosen.stat, ...(chosen.scope ? { scope: chosen.scope } : {}), value: mid }, `Set Echo ${slot + 1} substat to ${chosen.label}`)
                  }}
                />
                {sub && row ? (
                  <SelectField
                    label="Roll"
                    value={String(sub.value)}
                    options={row.rolls.map((roll) => ({ value: String(roll), label: formatStatValue(row.stat, roll) }))}
                    onChange={(value) =>
                      setSub(index, { ...sub, value: Number(value) }, `Set Echo ${slot + 1} ${row.label} to ${formatStatValue(row.stat, Number(value))}`)
                    }
                  />
                ) : (
                  <div />
                )}
              </div>
            )
          })}
          {echo.substats.length === 0 ? (
            <EmptyState>No substats yet. Add the ones this Echo rolled, in any order.</EmptyState>
          ) : null}
        </fieldset>
      </div>
    </Sheet>
  )
}
