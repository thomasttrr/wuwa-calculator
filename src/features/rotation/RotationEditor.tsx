import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { Announcements, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Repeat } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useCatalog } from '../../app/context'
import { addStep, findItem, loopOf, moveItem, updateLoop, updateStep } from '../../engine/rotation/edit'
import type { RotationResult } from '../../engine/rotation/simulate'
import type { Build, RotationItem, RotationLoop, RotationStep } from '../../engine/types/build'
import { formatDamage, formatPercent } from '../../ui/format'
import { nameOf } from './names'
import { useRotationEdit } from './useRotationEdit'

interface StepTotals {
  average: number
  reason?: string
}

/** Damage per editor step, added up over every pass of its loop; or why it was not counted. */
function totalsByStep(simulation: RotationResult): Map<string, StepTotals> {
  const map = new Map<string, StepTotals>()
  for (const step of simulation.steps) map.set(step.stepId, { average: (map.get(step.stepId)?.average ?? 0) + step.action.average })
  for (const line of simulation.uncounted) map.set(line.stepId, { average: 0, reason: line.reason })
  return map
}

export function RotationEditor({
  build,
  simulation,
  onSelect,
}: {
  build: Build
  simulation: RotationResult
  onSelect: (id: string) => void
}) {
  const catalog = useCatalog()
  const edit = useRotationEdit()
  const resonator = catalog.resonators[build.resonator.id]
  const rotation = build.rotation
  const totals = useMemo(() => totalsByStep(simulation), [simulation])
  const total = simulation.total.average || 1
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const label = (id: string): string => {
    const item = findItem(rotation, id)
    if (!item) return 'step'
    return item.kind === 'loop' ? `the loop of ${item.steps.length} steps` : nameOf(resonator, item.actionId).name
  }
  const position = (id: string) => {
    const loop = loopOf(rotation, id)
    const list: readonly RotationItem[] = loop ? loop.steps : rotation.items
    return list.findIndex((x) => x.id === id) + 1
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${label(String(active.id))}, at position ${position(String(active.id))}.`,
    onDragOver: ({ active, over }) => (over ? `${label(String(active.id))} is over position ${position(String(over.id))}.` : `${label(String(active.id))} is not over a place.`),
    onDragEnd: ({ active, over }) => (over ? `Dropped ${label(String(active.id))} at position ${position(String(over.id))}.` : `Put ${label(String(active.id))} back.`),
    onDragCancel: ({ active }) => `Put ${label(String(active.id))} back where it was.`,
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const a = String(active.id)
    let o = String(over.id)
    const fromLoop = loopOf(rotation, a)?.id ?? null
    const overLoop = loopOf(rotation, o)?.id ?? null
    // A top-level item dropped on a step inside a loop lands where the loop is.
    if (fromLoop === null && overLoop !== null) o = overLoop
    else if (fromLoop !== overLoop) return
    const list: readonly RotationItem[] = fromLoop ? (loopOf(rotation, a)?.steps ?? []) : rotation.items
    const to = list.findIndex((x) => x.id === o)
    if (to < 0) return
    edit(`Moved ${label(a)}`, (r) => moveItem(r, a, to))
  }

  // Step numbers in play order, counting each loop's steps once.
  const numbers = new Map<string, number>()
  for (const item of rotation.items) for (const s of item.kind === 'loop' ? item.steps : [item]) numbers.set(s.id, numbers.size + 1)
  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ announcements }}>
        <SortableContext items={rotation.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ol aria-label="Rotation steps" className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
            {rotation.items.map((item) =>
              item.kind === 'step' ? (
                <SortableStep key={item.id} step={item} number={numbers.get(item.id) ?? 0} resonatorId={build.resonator.id} totals={totals.get(item.id)} total={total} onSelect={onSelect} />
              ) : (
                <SortableLoop key={item.id} loop={item} numbers={numbers} resonatorId={build.resonator.id} totals={totals} total={total} onSelect={onSelect} />
              ),
            )}
          </ol>
        </SortableContext>
      </DndContext>
      {rotation.items.length === 0 ? <p className="mt-2 text-ink-2">No steps yet. Add the first one below.</p> : null}
      <AddStep build={build} />
    </div>
  )
}

function SortableStep({
  step,
  number,
  resonatorId,
  totals,
  total,
  onSelect,
  inLoop = false,
}: {
  step: RotationStep
  number: number
  resonatorId: number
  totals: StepTotals | undefined
  total: number
  onSelect: (id: string) => void
  inLoop?: boolean
}) {
  const catalog = useCatalog()
  const edit = useRotationEdit()
  const resonator = catalog.resonators[resonatorId]
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: step.id })
  const { name, skill, Icon } = nameOf(resonator, step.actionId)
  const share = totals ? totals.average / total : 0
  return (
    <li
      ref={setNodeRef}
      data-step-name={name}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-stretch gap-1 rounded-panel ${inLoop ? 'bg-panel' : 'bg-raised'} ${isDragging ? 'relative z-10 shadow-float' : ''} ${step.enabled ? '' : 'opacity-60'}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Move step ${number}: ${name}`}
        className="flex w-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-l-panel text-ink-3 hover:text-ink active:cursor-grabbing"
      >
        <GripVertical size={18} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => onSelect(step.id)} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-2 pr-3 text-left">
        <span className="sr-only">Open step {number}: </span>
        <span aria-hidden="true" className="w-6 shrink-0 font-display text-13 text-ink-3">
          {number}
        </span>
        <Icon size={16} aria-hidden="true" className="shrink-0 text-ink-2" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ink">{name}</span>
          <span className="block truncate text-12 text-ink-3">
            {skill}
            {step.seconds !== undefined ? `, ${step.seconds} s` : ''}
            {step.effectChanges?.length ? `, ${step.effectChanges.length} effect ${step.effectChanges.length === 1 ? 'change' : 'changes'}` : ''}
            {step.note ? `. ${step.note}` : ''}
            {step.enabled ? '' : '. Switched off'}
          </span>
        </span>
        <span className="shrink-0 text-right tabular-nums">
          {totals?.reason ? (
            <span className="text-12 text-ink-3">Not counted</span>
          ) : step.enabled ? (
            <>
              <span className="block text-14 font-semibold">{formatDamage(totals?.average ?? 0)}</span>
              <span className="block text-12 text-ink-3">{formatPercent(share)}</span>
            </>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        aria-pressed={step.enabled}
        onClick={() => edit(`${step.enabled ? 'Switched off' : 'Switched on'} ${name}`, (r) => updateStep(r, step.id, { enabled: !step.enabled }))}
        className="w-12 shrink-0 rounded-r-panel text-12 text-ink-2 hover:text-ink"
      >
        {step.enabled ? 'On' : 'Off'}
        <span className="sr-only">: count step {number}</span>
      </button>
    </li>
  )
}

function SortableLoop({
  loop,
  numbers,
  resonatorId,
  totals,
  total,
  onSelect,
}: {
  loop: RotationLoop
  numbers: ReadonlyMap<string, number>
  resonatorId: number
  totals: Map<string, StepTotals>
  total: number
  onSelect: (id: string) => void
}) {
  const edit = useRotationEdit()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: loop.id })
  const sum = loop.steps.reduce((s, step) => s + (totals.get(step.id)?.average ?? 0), 0)
  const rows = loop.steps.map((step) => (
    <SortableStep key={step.id} step={step} number={numbers.get(step.id) ?? 0} resonatorId={resonatorId} totals={totals.get(step.id)} total={total} onSelect={onSelect} inLoop />
  ))
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-panel border-2 border-rule-strong bg-raised p-1.5 ${isDragging ? 'relative z-10 shadow-float' : ''} ${loop.enabled ? '' : 'opacity-60'}`}
    >
      <div className="flex flex-wrap items-center gap-2 pb-1.5">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Move the loop of ${loop.steps.length} steps`}
          className="flex size-10 cursor-grab touch-none items-center justify-center text-ink-3 hover:text-ink"
        >
          <GripVertical size={18} aria-hidden="true" />
        </button>
        <Repeat size={16} aria-hidden="true" className="text-ink-2" />
        <button type="button" onClick={() => onSelect(loop.id)} className="min-h-10 flex-1 text-left">
          <span className="font-medium text-ink">Repeat {loop.count} times</span>
          <span className="ml-2 text-12 text-ink-3">
            {formatDamage(sum)} in all{loop.enabled ? '' : '. Switched off'}
          </span>
        </button>
        <span className="flex items-center gap-1" role="group" aria-label="Times to repeat">
          <button
            type="button"
            aria-label="Repeat one time fewer"
            disabled={loop.count <= 1}
            onClick={() => edit(`Set the loop to ${loop.count - 1} times`, (r) => updateLoop(r, loop.id, { count: loop.count - 1 }))}
            className="size-10 rounded-control text-ink-2 hover:bg-panel disabled:opacity-40"
          >
            −
          </button>
          <span className="w-6 text-center tabular-nums">{loop.count}</span>
          <button
            type="button"
            aria-label="Repeat one time more"
            disabled={loop.count >= 20}
            onClick={() => edit(`Set the loop to ${loop.count + 1} times`, (r) => updateLoop(r, loop.id, { count: loop.count + 1 }))}
            className="size-10 rounded-control text-ink-2 hover:bg-panel disabled:opacity-40"
          >
            +
          </button>
        </span>
      </div>
      <SortableContext items={loop.steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ol aria-label={`Steps repeated ${loop.count} times`} className="grid grid-cols-[minmax(0,1fr)] gap-1">
          {rows}
        </ol>
      </SortableContext>
      {loop.steps.length === 0 ? <p className="px-2 py-1 text-13 text-ink-3">This loop is empty. Move steps into it from their own panel.</p> : null}
    </li>
  )
}

function AddStep({ build }: { build: Build }) {
  const catalog = useCatalog()
  const edit = useRotationEdit()
  const resonator = catalog.resonators[build.resonator.id]
  const [query, setQuery] = useState('')
  const actionsList = resonator?.actions ?? []
  const matches = query.trim()
    ? actionsList.filter((a) => nameOf(resonator, a.id).name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : []
  const add = (actionId: number) => {
    edit(`Added ${nameOf(resonator, actionId).name}`, (r) => addStep(r, { actionId, id: globalThis.crypto.randomUUID() }))
    setQuery('')
  }
  return (
    <div className="mt-3">
      <label className="flex items-center gap-2 rounded-control border border-rule bg-page px-3 focus-within:border-signal">
        <Plus size={16} aria-hidden="true" className="text-ink-3" />
        <span className="sr-only">Add a step: type part of a skill's name</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && matches[0]) {
              event.preventDefault()
              add(matches[0].id)
            }
          }}
          placeholder="Add a step: type part of a skill's name"
          className="min-h-11 w-full bg-transparent text-ink placeholder:text-ink-3 focus:outline-none md:min-h-10"
        />
      </label>
      {matches.length > 0 ? (
        <ul aria-label="Matching skills" className="mt-1 grid gap-1">
          {matches.map((action) => {
            const { name, skill, Icon } = nameOf(resonator, action.id)
            return (
              <li key={action.id}>
                <button type="button" onClick={() => add(action.id)} className="flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-left hover:bg-raised">
                  <Icon size={16} aria-hidden="true" className="text-ink-2" />
                  <span className="flex-1 text-ink">
                    <span className="sr-only">Add </span>
                    {name}
                  </span>
                  <span className="text-12 text-ink-3">{action.kind === 'heal' ? 'Healing' : action.modelled ? skill : 'Not modelled'}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : query.trim() ? (
        <p className="mt-1 text-13 text-ink-3">No skill of {resonator?.name} has that in its name.</p>
      ) : null}
    </div>
  )
}
