import { castDraft } from 'immer'
import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useCatalog } from '../../app/context'
import { NOT_MODELLED } from '../../data/catalog'
import { auditEffects } from '../../engine/rotation/effects-audit'
import type { EffectAudit } from '../../engine/rotation/effects-audit'
import type { Build } from '../../engine/types/build'
import type { EffectDef } from '../../engine/types/catalog'
import type { Scope, StatKey } from '../../engine/types/stats'
import { Button, IconButton } from '../../ui/Button'
import { SelectField, Stepper, Switch } from '../../ui/Field'
import { formatStatValue, statLabel } from '../../ui/format'
import { Mark } from '../../ui/Mark'
import { Section } from '../../ui/Section'
import { useEdit, useShowEverything } from './useEdit'

function effectSummary(effect: EffectDef, rank: number): string {
  return effect.modifiers
    .map((modifier) => {
      const perRank = effect.owner.kind === 'weapon' && modifier.values.length === 5
      const value = (perRank ? modifier.values[rank - 1] : modifier.values[0]) ?? 0
      return `${statLabel(modifier.stat, modifier.scope)} +${formatStatValue(modifier.stat, value)}${modifier.perStack ? ' per stack' : ''}`
    })
    .join(', ')
}

export function EffectsSection({ build }: { build: Build }) {
  const catalog = useCatalog()
  const edit = useEdit()
  const everything = useShowEverything()
  const audit = useMemo(() => auditEffects(build, catalog), [build, catalog])
  const byId = useMemo(() => new Map(catalog.effects.map((effect) => [effect.id, effect])), [catalog])

  const groups = new Map<string, EffectAudit[]>()
  for (const row of audit) {
    const holder = row.holder === 'self' ? 'You' : (catalog.resonators[build.teammates[row.holder]?.resonatorId ?? 0]?.name ?? 'Teammate')
    groups.set(holder, [...(groups.get(holder) ?? []), row])
  }

  const notModelled = useMemo(() => relevantNotModelled(build, catalog), [build, catalog])

  return (
    <Section
      title="Effects"
      id="effects"
      description="Effects from your weapon, sets, main Echo, Sequences and team. Conditions use the game's own words. Switch on what is active in your fight."
    >
      {audit.length === 0 ? <p className="text-ink-2">Nothing equipped grants an effect yet.</p> : null}
      {[...groups].map(([holder, rows]) => (
        <div key={holder} className="mb-4">
          <h3 className="text-13 text-ink-3">{holder}</h3>
          <ul>
            {rows.map((row) => {
              const effect = byId.get(row.effectId)
              if (!effect) return null
              const rank = row.holder === 'self' ? (build.weapon?.rank ?? 1) : (build.teammates[row.holder]?.weaponRank ?? 1)
              const summary = effectSummary(effect, rank)
              const reason = <span className={row.touches ? 'text-ink-2' : 'text-ink-3'}>{row.reason}</span>
              const marks = effect.provenance.verified ? null : <Mark kind="unverified" />
              const detail = (
                <span className="flex flex-col gap-0.5">
                  <span>{summary}</span>
                  {effect.control.kind !== 'always' ? <span className="text-ink-3">{effect.condition}</span> : null}
                  {reason}
                </span>
              )
              return (
                <li key={row.key} className="border-b border-rule">
                  {effect.control.kind === 'toggle' ? (
                    <Switch
                      label={
                        <span className="flex flex-wrap items-center gap-2">
                          {row.label}
                          {marks}
                        </span>
                      }
                      description={detail}
                      checked={row.active}
                      onChange={(on) => edit(`${on ? 'Switched on' : 'Switched off'}: ${row.label}`, (draft) => {
                        draft.effects = { ...draft.effects, [row.key]: { on } }
                      })}
                    />
                  ) : effect.control.kind === 'stacks' ? (
                    <div className="flex flex-wrap items-start justify-between gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 font-medium">
                          {row.label}
                          {marks}
                        </div>
                        <div className="mt-0.5 text-13">{detail}</div>
                      </div>
                      <Stepper
                        label="Stacks"
                        value={row.stacks}
                        min={0}
                        max={effect.control.max}
                        suffix={`of ${effect.control.max}`}
                        onChange={(stacks) =>
                          edit(`Set ${row.label} to ${stacks} stacks`, (draft) => {
                            draft.effects = { ...draft.effects, [row.key]: { on: stacks > 0, stacks } }
                          })
                        }
                      />
                    </div>
                  ) : (
                    <div className="py-2">
                      <div className="flex flex-wrap items-center gap-2 font-medium">
                        {row.label}
                        <span className="text-12 text-ink-3">Always on</span>
                        {marks}
                      </div>
                      <div className="mt-0.5 text-13">{detail}</div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      {notModelled.length > 0 ? (
        <details className="mt-2">
          <summary className="min-h-10 cursor-pointer py-2 text-ink-2">
            {notModelled.length} {notModelled.length === 1 ? 'part' : 'parts'} of your equipment are not modelled
          </summary>
          <p className="text-13 text-ink-3">These sentences could not be read into a stat change, so they are left out rather than guessed.</p>
          <ul className="mt-2 text-13">
            {notModelled.map((line, index) => (
              <li key={index} className="border-b border-rule py-2">
                <span className="font-medium">{line.owner}.</span> <span className="text-ink-2">{line.sentence}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {everything ? <CustomBuffs build={build} /> : null}
    </Section>
  )
}

/** Sentences from equipped things that the effect reader could not turn into stats. */
function relevantNotModelled(build: Build, catalog: ReturnType<typeof useCatalog>) {
  const owners: string[] = []
  const weapon = build.weapon ? catalog.weapons[build.weapon.id] : undefined
  if (weapon) owners.push(weapon.passive.name ? `${weapon.name}: ${weapon.passive.name}` : weapon.name)
  const main = build.echoes[0] ? catalog.echoes[build.echoes[0].echoId] : undefined
  if (main) owners.push(`${main.name} (main Echo)`)
  const pieces = new Map<number, number>()
  for (const echo of build.echoes) if (echo) pieces.set(echo.sonataId, (pieces.get(echo.sonataId) ?? 0) + 1)
  for (const [id, count] of pieces) {
    for (const effect of catalog.sonatas[id]?.effects ?? []) {
      if (count >= effect.pieces) owners.push(`${catalog.sonatas[id]?.name} (${effect.pieces} pieces)`)
    }
  }
  const resonator = catalog.resonators[build.resonator.id]
  if (resonator) owners.push(...resonator.sequences.filter((s) => s.index <= build.resonator.sequence).map((s) => `${resonator.name} Sequence ${s.index}: ${s.name}`))
  return NOT_MODELLED.filter((line) => owners.includes(line.owner))
}

const CUSTOM_STATS: { key: string; label: string; stat: StatKey; scope?: Scope }[] = [
  { key: 'atkPct', label: 'ATK%', stat: 'atkPct' },
  { key: 'critRate', label: 'Crit. Rate', stat: 'critRate' },
  { key: 'critDmg', label: 'Crit. DMG', stat: 'critDmg' },
  { key: 'dmgBonus', label: 'DMG Bonus on every hit', stat: 'dmgBonus' },
  { key: 'amplify', label: 'DMG Amplify', stat: 'amplify' },
  { key: 'defIgnore', label: 'Enemy DEF ignored', stat: 'defIgnore' },
  { key: 'resReduction', label: 'Enemy RES reduced', stat: 'resReduction' },
]

function CustomBuffs({ build }: { build: Build }) {
  const edit = useEdit()
  const [stat, setStat] = useState('atkPct')
  const [value, setValue] = useState('10')
  const [label, setLabel] = useState('')
  return (
    <div className="mt-4 border-t border-rule pt-4">
      <h3 className="font-medium">Your own buffs</h3>
      <p className="mt-1 text-13 text-ink-2">For effects not listed above. These are marked as your values everywhere they count.</p>
      <ul className="mt-2">
        {build.customModifiers.map((custom) => (
          <li key={custom.id} className="flex items-center gap-2 border-b border-rule">
            <div className="min-w-0 flex-1">
              <Switch
                label={
                  <span className="flex flex-wrap items-center gap-2">
                    {custom.label}
                    <Mark kind="custom" />
                  </span>
                }
                description={`${statLabel(custom.stat, custom.scope)} +${formatStatValue(custom.stat, custom.value)}`}
                checked={custom.on}
                onChange={(on) =>
                  edit(`${on ? 'Switched on' : 'Switched off'}: ${custom.label}`, (draft) => {
                    const target = draft.customModifiers.find((c) => c.id === custom.id)
                    if (target) target.on = on
                  })
                }
              />
            </div>
            <IconButton
              label={`Delete ${custom.label}`}
              onClick={() => edit(`Deleted ${custom.label}`, (draft) => void (draft.customModifiers = draft.customModifiers.filter((c) => c.id !== custom.id)))}
            >
              <Trash2 size={16} aria-hidden="true" />
            </IconButton>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault()
          const chosen = CUSTOM_STATS.find((s) => s.key === stat)
          const amount = Number(value)
          if (!chosen || !Number.isFinite(amount)) return
          const name = label.trim() || `Custom ${chosen.label}`
          edit(`Added your buff: ${name}`, (draft) => {
            draft.customModifiers = castDraft([
              ...draft.customModifiers,
              { id: globalThis.crypto.randomUUID(), label: name, stat: chosen.stat, ...(chosen.scope ? { scope: chosen.scope } : {}), value: amount / 100, on: true },
            ])
          })
          setLabel('')
        }}
      >
        <label className="col-span-2 flex flex-col gap-1 text-13 text-ink-2 sm:col-span-1">
          Name
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Teammate's set bonus"
            className="min-h-11 rounded-control border border-rule bg-page px-3 text-ink placeholder:text-ink-3 focus:border-signal focus:outline-none md:min-h-9"
          />
        </label>
        <SelectField label="Stat" value={stat} options={CUSTOM_STATS.map((s) => ({ value: s.key, label: s.label }))} onChange={setStat} />
        <label className="flex flex-col gap-1 text-13 text-ink-2">
          Percent
          <input
            type="number"
            step="0.1"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="min-h-11 rounded-control border border-rule bg-page px-3 text-ink focus:border-signal focus:outline-none md:min-h-9"
          />
        </label>
        <Button type="submit" icon={<Plus size={16} aria-hidden="true" />}>
          Add
        </Button>
      </form>
    </div>
  )
}
