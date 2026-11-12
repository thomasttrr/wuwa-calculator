import { Copy, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useCatalog } from '../../app/context'
import {
  duplicateItem,
  findItem,
  loopOf,
  moveStepIntoLoop,
  moveStepOutOfLoop,
  removeItem,
  unwrapLoop,
  updateLoop,
  updateStep,
  wrapInLoop,
} from '../../engine/rotation/edit'
import { ownedEffects } from '../../engine/stats/collect'
import type { Build, RotationLoop, RotationStep } from '../../engine/types/build'
import { Button } from '../../ui/Button'
import { SelectField, Stepper, Switch } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'
import { nameOf } from './names'
import { useRotationEdit } from './useRotationEdit'

const newId = () => globalThis.crypto.randomUUID()

/** The panel for one step or loop: switch, time, note, effect changes, loops, copy and remove. */
export function StepInspector({ build, itemId, onClose }: { build: Build; itemId: string | null; onClose: () => void }) {
  const item = itemId ? findItem(build.rotation, itemId) : undefined
  if (!item) return null
  return item.kind === 'step' ? <StepPanel build={build} step={item} onClose={onClose} /> : <LoopPanel loop={item} onClose={onClose} />
}

/** A text field that saves when you leave it or press Enter, so typing makes one undo step, not one per letter. */
function CommitField({ label, value, onCommit, type = 'text', hint }: { label: string; value: string; onCommit: (value: string) => void; type?: 'text' | 'number'; hint?: string }) {
  const [draft, setDraft] = useState(value)
  const [shown, setShown] = useState(value)
  if (shown !== value) {
    setShown(value)
    setDraft(value)
  }
  const commit = () => draft !== value && onCommit(draft)
  return (
    <label className="flex flex-col gap-1">
      <span className="text-13 text-ink-2">{label}</span>
      <input
        type={type}
        inputMode={type === 'number' ? 'decimal' : undefined}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? 0.1 : undefined}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === 'Enter' && commit()}
        className="min-h-11 w-full rounded-control border border-rule bg-page px-3 text-ink focus:border-signal focus:outline-none md:min-h-9"
      />
      {hint ? <span className="text-12 text-ink-3">{hint}</span> : null}
    </label>
  )
}

function StepPanel({ build, step, onClose }: { build: Build; step: RotationStep; onClose: () => void }) {
  const catalog = useCatalog()
  const edit = useRotationEdit()
  const resonator = catalog.resonators[build.resonator.id]
  const { name, skill } = nameOf(resonator, step.actionId)
  const rotation = build.rotation
  const loop = loopOf(rotation, step.id)
  const at = rotation.items.findIndex((i) => i.id === step.id)
  const before = at > 0 ? rotation.items[at - 1] : undefined
  const after = at >= 0 ? rotation.items[at + 1] : undefined
  const switchable = ownedEffects(build, catalog).filter((o) => o.effect.control.kind !== 'always')
  const changes = step.effectChanges ?? []
  const setChanges = (next: NonNullable<RotationStep['effectChanges']>, label: string) => edit(label, (r) => updateStep(r, step.id, { effectChanges: next }))

  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={name}
      description={`${skill}.${loop ? ` Inside a loop that repeats ${loop.count} times.` : ''}`}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
          <Button icon={<Copy size={16} aria-hidden="true" />} onClick={() => edit(`Copied ${name}`, (r) => duplicateItem(r, step.id, newId))}>
            Copy
          </Button>
          <Button
            variant="quiet"
            icon={<Trash2 size={16} aria-hidden="true" />}
            onClick={() => {
              edit(`Removed ${name}`, (r) => removeItem(r, step.id))
              onClose()
            }}
          >
            Remove
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <Switch label="Count this step" description="Off keeps the step in the list but leaves it out of every total." checked={step.enabled} onChange={(on) => edit(`${on ? 'Switched on' : 'Switched off'} ${name}`, (r) => updateStep(r, step.id, { enabled: on }))} />
        <CommitField
          label="Time in seconds"
          type="number"
          value={step.seconds === undefined ? '' : String(step.seconds)}
          hint="Optional. When every step has a time, results also show damage per second."
          onCommit={(raw) => {
            const n = Number(raw)
            edit(raw === '' ? `Cleared the time of ${name}` : `Set ${name} to ${n} seconds`, (r) => updateStep(r, step.id, { seconds: raw === '' || !Number.isFinite(n) || n < 0 ? undefined : n }))
          }}
        />
        <CommitField label="Note" value={step.note ?? ''} hint="Shown in the summary, for example 'Cancel after the second hit'." onCommit={(note) => edit(`Noted ${name}`, (r) => updateStep(r, step.id, { note: note.trim() || undefined }))} />

        <fieldset className="grid gap-3">
          <legend className="font-medium">Effects that change at this step</legend>
          <p className="text-13 text-ink-3">For buffs that start or end partway through. "From here on" lasts until another step changes it.</p>
          {changes.map((change, index) => {
            const owned = switchable.find((o) => o.key === change.effectId)
            const control = owned?.effect.control
            const max = control?.kind === 'stacks' ? control.max : 0
            // With no count of its own, the change keeps the stacks the build already has.
            const kept = build.effects[change.effectId]?.stacks ?? (control?.kind === 'stacks' ? control.default : 0)
            const replace = (patch: Partial<typeof change>, label: string) => setChanges(changes.map((c, i) => (i === index ? { ...c, ...patch } : c)), label)
            return (
              <div key={index} className="grid gap-2 rounded-panel bg-raised p-3">
                <SelectField
                  label="Effect"
                  value={change.effectId}
                  options={[...(owned ? [] : [{ value: change.effectId, label: 'An effect this build no longer has' }]), ...switchable.map((o) => ({ value: o.key, label: o.label }))]}
                  onChange={(value) => replace({ effectId: value, stacks: undefined }, `Changed an effect at ${name}`)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <SelectField
                    label="Becomes"
                    value={change.on ? 'on' : 'off'}
                    options={[
                      { value: 'on', label: 'On' },
                      { value: 'off', label: 'Off' },
                    ]}
                    onChange={(value) => replace({ on: value === 'on' }, `Set an effect ${value} at ${name}`)}
                  />
                  <SelectField
                    label="Lasts"
                    value={change.lasts}
                    options={[
                      { value: 'onward', label: 'From here on' },
                      { value: 'thisStep', label: 'This step only' },
                    ]}
                    onChange={(value) => replace({ lasts: value as 'onward' | 'thisStep' }, `Changed how long an effect lasts at ${name}`)}
                  />
                </div>
                {max > 0 && change.on ? (
                  <Stepper label="Stacks" value={Math.max(1, change.stacks ?? kept)} min={1} max={max} onChange={(stacks) => replace({ stacks }, `Set stacks at ${name}`)} />
                ) : null}
                <Button variant="quiet" className="justify-self-start" onClick={() => setChanges(changes.filter((_, i) => i !== index), `Removed an effect change from ${name}`)}>
                  Remove this change
                </Button>
              </div>
            )
          })}
          {switchable.length > 0 ? (
            <Button
              className="justify-self-start"
              onClick={() => setChanges([...changes, { effectId: switchable[0]!.key, on: true, lasts: 'onward' }], `Added an effect change at ${name}`)}
            >
              Add an effect change
            </Button>
          ) : (
            <p className="text-13 text-ink-3">This build has no effects that switch on or off.</p>
          )}
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="font-medium">Loop</legend>
          <div className="flex flex-wrap gap-2">
            {loop ? (
              <Button onClick={() => edit(`Took ${name} out of the loop`, (r) => moveStepOutOfLoop(r, step.id))}>Take out of the loop</Button>
            ) : (
              <>
                <Button onClick={() => edit(`Put ${name} in a loop`, (r) => wrapInLoop(r, step.id, newId()))}>Repeat this step</Button>
                {before?.kind === 'loop' ? <Button onClick={() => edit(`Moved ${name} into the loop above`, (r) => moveStepIntoLoop(r, step.id, before.id))}>Join the loop above</Button> : null}
                {after?.kind === 'loop' ? <Button onClick={() => edit(`Moved ${name} into the loop below`, (r) => moveStepIntoLoop(r, step.id, after.id))}>Join the loop below</Button> : null}
              </>
            )}
          </div>
        </fieldset>
      </div>
    </Sheet>
  )
}

function LoopPanel({ loop, onClose }: { loop: RotationLoop; onClose: () => void }) {
  const edit = useRotationEdit()
  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Repeat ${loop.count} times`}
      description={`A loop of ${loop.steps.length} ${loop.steps.length === 1 ? 'step' : 'steps'}. Loops go one level deep.`}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
          <Button icon={<Copy size={16} aria-hidden="true" />} onClick={() => edit('Copied a loop', (r) => duplicateItem(r, loop.id, newId))}>
            Copy
          </Button>
          <Button
            variant="quiet"
            icon={<Trash2 size={16} aria-hidden="true" />}
            onClick={() => {
              edit('Removed a loop and its steps', (r) => removeItem(r, loop.id))
              onClose()
            }}
          >
            Remove with its steps
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <Stepper label="Times to repeat" value={loop.count} min={1} max={20} onChange={(count) => edit(`Set the loop to ${count} times`, (r) => updateLoop(r, loop.id, { count }))} />
        <Switch label="Count this loop" description="Off leaves every pass out of the totals." checked={loop.enabled} onChange={(on) => edit(`${on ? 'Switched on' : 'Switched off'} a loop`, (r) => updateLoop(r, loop.id, { enabled: on }))} />
        <Button
          className="justify-self-start"
          onClick={() => {
            edit('Took a loop apart', (r) => unwrapLoop(r, loop.id))
            onClose()
          }}
        >
          Take the loop apart
        </Button>
        <p className="text-13 text-ink-3">Taking it apart keeps its steps, played once, in the same place.</p>
      </div>
    </Sheet>
  )
}
