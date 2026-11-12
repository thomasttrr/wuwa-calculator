import { useCatalog } from '../../app/context'
import type { EchoInstance, EchoSubstat } from '../../engine/types/build'
import type { Catalog } from '../../engine/types/catalog'
import type { Scope } from '../../engine/types/stats'
import { SelectField } from '../../ui/Field'
import { formatStatValue } from '../../ui/format'
import { EmptyState } from '../../ui/Section'

const sameScope = (a?: Scope, b?: Scope) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** A fresh Echo of this kind: its set's first option, the first main stat for its cost, no substats. */
export function newEcho(catalog: Catalog, echoId: number): EchoInstance {
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
    mainStat: {
      stat: main.stat,
      ...(main.scope ? { scope: main.scope } : {}),
      value: main.value,
    },
    fixedStat: { stat: fixed.stat, value: fixed.value },
    substats: [],
  }
}

/**
 * The fields of one Echo: set, main stat, substats and rolls. Shared by the Build page and the
 * Echo inventory. `name` starts every change's label ("Set Echo 1 main stat to ATK%").
 */
export function EchoFields({ echo, name, onChange }: { echo: EchoInstance; name: string; onChange: (next: EchoInstance, label: string) => void }) {
  const catalog = useCatalog()
  const def = catalog.echoes[echo.echoId]
  const tables = catalog.echoStats
  const mains = tables.mainStats[echo.cost]
  const mainIndex = mains.findIndex((main) => main.stat === echo.mainStat.stat && sameScope(main.scope, echo.mainStat.scope))
  const rows = [...echo.substats, ...(echo.substats.length < 5 ? [null] : [])]

  const setSub = (index: number, sub: EchoSubstat | null, label: string) => {
    const subs = [...echo.substats]
    if (sub) subs[index] = sub
    else subs.splice(index, 1)
    onChange({ ...echo, substats: subs }, label)
  }

  return (
    <div className="grid gap-4">
      <SelectField
        label="Sonata set"
        value={String(echo.sonataId)}
        options={(def?.sonataIds ?? [echo.sonataId]).map((id) => ({
          value: String(id),
          label: catalog.sonatas[id]?.name ?? String(id),
        }))}
        onChange={(value) => onChange({ ...echo, sonataId: Number(value) }, `Set ${name} to ${catalog.sonatas[Number(value)]?.name}`)}
      />
      <SelectField
        label="Main stat"
        value={String(mainIndex)}
        options={mains.map((main, i) => ({
          value: String(i),
          label: `${main.label} ${formatStatValue(main.stat, main.value)}`,
        }))}
        onChange={(value) => {
          const main = mains[Number(value)]
          if (!main) return
          onChange(
            {
              ...echo,
              mainStat: {
                stat: main.stat,
                ...(main.scope ? { scope: main.scope } : {}),
                value: main.value,
              },
            },
            `Set ${name} main stat to ${main.label}`,
          )
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
                  {
                    value: '-1',
                    label: sub ? 'Remove this substat' : 'Add a substat',
                  },
                  ...tables.substats.map((r, i) => ({ value: String(i), label: r.label })).filter((option) => !taken.has(Number(option.value))),
                ]}
                onChange={(value) => {
                  const chosen = tables.substats[Number(value)]
                  if (!chosen) return setSub(index, null, `Removed a substat from ${name}`)
                  const mid = chosen.rolls[Math.floor((chosen.rolls.length - 1) / 2)] ?? chosen.rolls[0] ?? 0
                  setSub(
                    index,
                    {
                      stat: chosen.stat,
                      ...(chosen.scope ? { scope: chosen.scope } : {}),
                      value: mid,
                    },
                    `Set ${name} substat to ${chosen.label}`,
                  )
                }}
              />
              {sub && row ? (
                <SelectField
                  label="Roll"
                  value={String(sub.value)}
                  options={row.rolls.map((roll) => ({
                    value: String(roll),
                    label: formatStatValue(row.stat, roll),
                  }))}
                  onChange={(value) =>
                    setSub(index, { ...sub, value: Number(value) }, `Set ${name} ${row.label} to ${formatStatValue(row.stat, Number(value))}`)
                  }
                />
              ) : (
                <div />
              )}
            </div>
          )
        })}
        {echo.substats.length === 0 ? <EmptyState>No substats yet. Add the ones this Echo rolled, in any order.</EmptyState> : null}
      </fieldset>
    </div>
  )
}
