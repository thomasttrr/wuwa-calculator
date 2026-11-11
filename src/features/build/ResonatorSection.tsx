import { castDraft } from 'immer'
import { useState } from 'react'
import { useCatalog } from '../../app/context'
import { CORE_RESONATOR_IDS } from '../../../data/authored/core-set'
import { startingRotation } from '../../data/defaults'
import type { Build } from '../../engine/types/build'
import { LEVELLED_SKILL_TYPES } from '../../engine/types/catalog'
import type { LevelledSkillType } from '../../engine/types/catalog'
import { Button } from '../../ui/Button'
import { ElementChip, Portrait } from '../../ui/ElementChip'
import { SelectField, Stepper, Switch } from '../../ui/Field'
import { formatPercent } from '../../ui/format'
import { Mark } from '../../ui/Mark'
import { EmptyState, Section } from '../../ui/Section'
import { ResonatorPicker, WEAPON_NAME, WeaponPicker, weaponSecondaryLabel } from './pickers'
import { useEdit, useShowEverything } from './useEdit'

const ASCENSION_LEVELS = new Set([20, 40, 50, 60, 70, 80])
const SKILL_NAME: Record<LevelledSkillType, string> = {
  normal: 'Basic Attack',
  skill: 'Resonance Skill',
  forte: 'Forte Circuit',
  liberation: 'Resonance Liberation',
  intro: 'Intro Skill',
}

export function ResonatorSection({ build }: { build: Build }) {
  const catalog = useCatalog()
  const edit = useEdit()
  const everything = useShowEverything()
  const [picking, setPicking] = useState(false)
  const resonator = catalog.resonators[build.resonator.id]
  if (!resonator) return null
  const basic = !CORE_RESONATOR_IDS.includes(resonator.id)

  return (
    <Section title="Resonator" id="resonator">
      <div className="flex items-center gap-3">
        <Portrait name={resonator.name} element={resonator.element} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-20">{resonator.name}</span>
            {basic ? <Mark kind="basic" /> : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-13 text-ink-3">
            <ElementChip element={resonator.element} />
            <span>{WEAPON_NAME[resonator.weaponType]}</span>
            <span>{resonator.rarity} star</span>
          </div>
        </div>
        <Button onClick={() => setPicking(true)}>
          Change<span className="sr-only"> Resonator</span>
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stepper
          label="Level"
          value={build.resonator.level}
          min={1}
          max={90}
          onChange={(level) =>
            edit(`Set level to ${level}`, (draft) => {
              draft.resonator.level = level
              if (!ASCENSION_LEVELS.has(level)) draft.resonator.ascended = false
            })
          }
        />
        <SelectField
          label="Sequence"
          value={String(build.resonator.sequence)}
          options={[0, 1, 2, 3, 4, 5, 6].map((s) => ({ value: String(s), label: s === 0 ? 'S0 (no duplicates)' : `S${s}` }))}
          onChange={(value) => edit(`Set Sequence to ${value}`, (draft) => void (draft.resonator.sequence = Number(value)))}
        />
      </div>

      {everything ? (
        <div className="mt-4 space-y-3">
          {ASCENSION_LEVELS.has(build.resonator.level) ? (
            <Switch
              label={`Ascended at level ${build.resonator.level}`}
              description="Ascending raises base stats without changing the level."
              checked={build.resonator.ascended}
              onChange={(on) => edit(on ? 'Ascended' : 'Not ascended', (draft) => void (draft.resonator.ascended = on))}
            />
          ) : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {LEVELLED_SKILL_TYPES.map((type) => (
              <Stepper
                key={type}
                label={SKILL_NAME[type]}
                value={build.resonator.skillLevels[type]}
                min={1}
                max={10}
                onChange={(level) => edit(`Set ${SKILL_NAME[type]} to level ${level}`, (draft) => void (draft.resonator.skillLevels[type] = level))}
              />
            ))}
          </div>
          <fieldset>
            <legend className="text-13 text-ink-2">Skill tree stat nodes</legend>
            <ul className="mt-1">
              {resonator.traceNodes.map((node) => {
                const on = build.resonator.traceNodeIds.includes(node.id)
                return (
                  <li key={node.id}>
                    <label className="flex min-h-10 items-center gap-3 border-b border-rule">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          edit(on ? `Removed node: ${node.label}` : `Added node: ${node.label}`, (draft) => {
                            draft.resonator.traceNodeIds = on
                              ? draft.resonator.traceNodeIds.filter((id) => id !== node.id)
                              : [...draft.resonator.traceNodeIds, node.id]
                          })
                        }
                        className="size-4 accent-[var(--color-signal)]"
                      />
                      <span>{node.label}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </fieldset>
        </div>
      ) : (
        <p className="mt-3 text-13 text-ink-3">
          Skills at level {build.resonator.skillLevels.skill}, {build.resonator.traceNodeIds.length} of {resonator.traceNodes.length} skill tree nodes. Turn on
          Show everything to change them.
        </p>
      )}

      <WeaponBlock build={build} />

      <ResonatorPicker
        open={picking}
        onOpenChange={setPicking}
        selectedId={resonator.id}
        onPick={(id) => {
          const next = catalog.resonators[id]
          if (!next) return
          edit(`Changed Resonator to ${next.name}`, (draft) => {
            draft.resonator.id = id
            draft.resonator.traceNodeIds = next.traceNodes.map((node) => node.id)
            draft.resonator.sequence = 0
            if (draft.weapon && catalog.weapons[draft.weapon.id]?.weaponType !== next.weaponType) draft.weapon = null
            draft.rotation = castDraft(startingRotation(next))
          })
          setPicking(false)
        }}
      />
    </Section>
  )
}

function WeaponBlock({ build }: { build: Build }) {
  const catalog = useCatalog()
  const edit = useEdit()
  const [picking, setPicking] = useState(false)
  const resonator = catalog.resonators[build.resonator.id]
  if (!resonator) return null
  const weapon = build.weapon ? catalog.weapons[build.weapon.id] : undefined
  const top = weapon?.growth.find((point) => point.level === build.weapon?.level && point.ascended === build.weapon?.ascended) ?? weapon?.growth.find((point) => point.level === build.weapon?.level)

  return (
    <div className="mt-5 border-t border-rule pt-4">
      <h3 className="font-medium">Weapon</h3>
      {weapon && build.weapon ? (
        <>
          <div className="mt-2 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{weapon.name}</div>
              <div className="text-13 text-ink-3">
                {weapon.rarity} star. ATK {Math.round(top?.atk ?? 0)}, {weaponSecondaryLabel(weapon.secondaryStat)} {formatPercent(top?.secondary ?? 0)}
              </div>
            </div>
            <Button onClick={() => setPicking(true)}>
              Change<span className="sr-only"> weapon</span>
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stepper
              label="Weapon level"
              value={build.weapon.level}
              min={1}
              max={90}
              onChange={(level) => edit(`Set weapon level to ${level}`, (draft) => draft.weapon && (draft.weapon.level = level))}
            />
            <SelectField
              label="Refinement rank"
              value={String(build.weapon.rank)}
              options={[1, 2, 3, 4, 5].map((r) => ({ value: String(r), label: `Rank ${r}` }))}
              onChange={(value) => edit(`Set refinement to rank ${value}`, (draft) => draft.weapon && (draft.weapon.rank = Number(value)))}
            />
          </div>
          <p className="mt-2 text-13 text-ink-3">The weapon's passive effects are listed under Effects.</p>
        </>
      ) : (
        <div className="mt-2">
          <EmptyState action={<Button onClick={() => setPicking(true)}>Choose a weapon</Button>}>
            No weapon equipped. Pick a {WEAPON_NAME[resonator.weaponType]} to add its ATK and effects.
          </EmptyState>
        </div>
      )}
      <WeaponPicker
        open={picking}
        onOpenChange={setPicking}
        weaponType={resonator.weaponType}
        selectedId={build.weapon?.id}
        onPick={(id) => {
          const next = catalog.weapons[id]
          edit(`Equipped ${next?.name ?? 'weapon'}`, (draft) => {
            draft.weapon = { id, level: draft.weapon?.level ?? 90, ascended: false, rank: draft.weapon?.rank ?? 1 }
          })
          setPicking(false)
        }}
      />
    </div>
  )
}
