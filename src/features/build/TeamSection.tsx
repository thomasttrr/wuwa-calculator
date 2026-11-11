import { castDraft } from 'immer'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useCatalog } from '../../app/context'
import { DEFAULT_ENEMY } from '../../data/defaults'
import type { Build } from '../../engine/types/build'
import { ELEMENTS } from '../../engine/types/stats'
import { Button, IconButton } from '../../ui/Button'
import { Portrait } from '../../ui/ElementChip'
import { SelectField, Stepper } from '../../ui/Field'
import { ELEMENT_NAME, formatPercent } from '../../ui/format'
import { Mark } from '../../ui/Mark'
import { Section } from '../../ui/Section'
import { EnemyPicker, ResonatorPicker, WeaponPicker } from './pickers'
import { useEdit, useShowEverything } from './useEdit'

export function TeamSection({ build }: { build: Build }) {
  const catalog = useCatalog()
  const edit = useEdit()
  const everything = useShowEverything()
  const [choosingFor, setChoosingFor] = useState<number | null>(null)
  const [weaponFor, setWeaponFor] = useState<number | null>(null)

  return (
    <Section
      title="Team"
      id="team"
      description="Teammates add their shared buffs and Outro effects. Switch those on under Effects. Their own damage is not counted."
    >
      <ul className="grid gap-2">
        {build.teammates.map((teammate, slot) => {
          const resonator = teammate ? catalog.resonators[teammate.resonatorId] : undefined
          if (!teammate || !resonator) {
            return (
              <li key={slot}>
                <button
                  type="button"
                  onClick={() => setChoosingFor(slot)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-panel border border-dashed border-rule-strong px-3 text-left text-ink-2 hover:bg-raised hover:text-ink"
                >
                  <Plus size={16} aria-hidden="true" />
                  Add teammate {slot + 1}
                </button>
              </li>
            )
          }
          const weapon = teammate.weaponId ? catalog.weapons[teammate.weaponId] : undefined
          return (
            <li key={slot} className="rounded-panel bg-raised p-3">
              <div className="flex items-center gap-3">
                <Portrait name={resonator.name} element={resonator.element} />
                <span className="min-w-0 flex-1 truncate font-medium">{resonator.name}</span>
                <div className="w-36">
                  <SelectField
                    label="Sequence"
                    value={String(teammate.sequence)}
                    options={[0, 1, 2, 3, 4, 5, 6].map((s) => ({ value: String(s), label: `S${s}` }))}
                    onChange={(value) =>
                      edit(`Set ${resonator.name} to Sequence ${value}`, (draft) => {
                        const target = draft.teammates[slot]
                        if (target) target.sequence = Number(value)
                      })
                    }
                  />
                </div>
                <IconButton
                  label={`Remove ${resonator.name}`}
                  onClick={() => edit(`Removed ${resonator.name} from the team`, (draft) => void (draft.teammates[slot] = null))}
                >
                  <X size={16} aria-hidden="true" />
                </IconButton>
              </div>
              {everything ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-13">
                  <span className="text-ink-2">Weapon: {weapon ? `${weapon.name}, rank ${teammate.weaponRank ?? 1}` : 'none'}</span>
                  <Button onClick={() => setWeaponFor(slot)}>{weapon ? 'Change weapon' : 'Add weapon'}</Button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      <TargetBlock build={build} />

      <ResonatorPicker
        open={choosingFor !== null}
        onOpenChange={(open) => !open && setChoosingFor(null)}
        title="Choose a teammate"
        onPick={(id) => {
          const slot = choosingFor
          if (slot === null) return
          edit(`Added ${catalog.resonators[id]?.name} to the team`, (draft) => {
            draft.teammates[slot] = { resonatorId: id, sequence: 0, sonatas: [] }
          })
          setChoosingFor(null)
        }}
      />
      {weaponFor !== null && build.teammates[weaponFor] ? (
        <WeaponPicker
          open
          onOpenChange={(open) => !open && setWeaponFor(null)}
          weaponType={catalog.resonators[build.teammates[weaponFor]?.resonatorId ?? 0]?.weaponType ?? 'sword'}
          selectedId={build.teammates[weaponFor]?.weaponId}
          onPick={(id) => {
            const slot = weaponFor
            edit(`Gave teammate ${slot + 1} ${catalog.weapons[id]?.name}`, (draft) => {
              const target = draft.teammates[slot]
              if (target) {
                target.weaponId = id
                target.weaponRank = target.weaponRank ?? 1
              }
            })
            setWeaponFor(null)
          }}
        />
      ) : null}
    </Section>
  )
}

function TargetBlock({ build }: { build: Build }) {
  const catalog = useCatalog()
  const edit = useEdit()
  const everything = useShowEverything()
  const [picking, setPicking] = useState(false)
  const enemy = build.enemy
  const listed = enemy.enemyId ? catalog.enemies[enemy.enemyId] : undefined
  const differing = ELEMENTS.filter((element) => enemy.resistance[element] !== 0.1)

  return (
    <div className="mt-5 border-t border-rule pt-4">
      <h3 className="font-medium">Target</h3>
      <p className="mt-1 text-13 text-ink-2">Damage means nothing without a target. Every number on this page is against this one.</p>
      <div className="mt-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 font-medium">
            {enemy.name}
            {listed && !listed.provenance.verified ? <Mark kind="unverified" /> : null}
          </div>
          <div className="text-13 text-ink-3">
            {differing.length === 0
              ? 'All resistances 10%'
              : differing.map((element) => `${ELEMENT_NAME[element]} ${formatPercent(enemy.resistance[element], 0)}`).join(', ') + ', others 10%'}
          </div>
        </div>
        <Button onClick={() => setPicking(true)}>
          Change<span className="sr-only"> target</span>
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stepper
          label="Enemy level"
          value={enemy.level}
          min={1}
          max={120}
          onChange={(level) => edit(`Set enemy level to ${level}`, (draft) => void (draft.enemy.level = level))}
        />
      </div>
      {everything ? (
        <fieldset className="mt-3">
          <legend className="text-13 text-ink-2">Resistances (percent)</legend>
          <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ELEMENTS.map((element) => (
              <label key={element} className="flex flex-col gap-1 text-13 text-ink-2">
                {ELEMENT_NAME[element]}
                <input
                  type="number"
                  step={1}
                  value={Math.round(enemy.resistance[element] * 100)}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    if (!Number.isFinite(value)) return
                    edit(`Set ${ELEMENT_NAME[element]} resistance to ${value}%`, (draft) => {
                      draft.enemy.resistance[element] = value / 100
                      draft.enemy.name = 'Custom target'
                      delete draft.enemy.enemyId
                    })
                  }}
                  className="min-h-11 rounded-control border border-rule bg-page px-3 text-ink focus:border-signal focus:outline-none md:min-h-9"
                />
              </label>
            ))}
          </div>
          <Button
            className="mt-3"
            variant="quiet"
            onClick={() => edit('Reset the target', (draft) => void (draft.enemy = castDraft({ ...DEFAULT_ENEMY, level: draft.enemy.level })))}
          >
            Reset to a level {enemy.level} target with 10% resistance
          </Button>
        </fieldset>
      ) : null}
      <EnemyPicker
        open={picking}
        onOpenChange={setPicking}
        selectedId={enemy.enemyId}
        onPick={(id) => {
          const chosen = catalog.enemies[id]
          if (!chosen) return
          edit(`Changed target to ${chosen.name}`, (draft) => {
            draft.enemy = castDraft({ enemyId: id, name: chosen.name, level: draft.enemy.level, resistance: { ...chosen.resistance } })
          })
          setPicking(false)
        }}
      />
    </div>
  )
}
