import type { EffectSpan } from '../../engine/rotation/spans'
import type { RotationResult } from '../../engine/rotation/simulate'
import { DAMAGE_TYPE_NAME, formatDamage } from '../../ui/format'
import { TYPE_COLOUR } from './names'

/**
 * The rotation as a strip of blocks, one per counted step in play order (loops unrolled), coloured
 * by damage type, sized by time when every step has one. Buff bars beneath span the steps they cover.
 */
export function Timeline({ simulation, spans }: { simulation: RotationResult; spans: readonly EffectSpan[] }) {
  const steps = simulation.steps
  if (steps.length === 0) return null
  const timed = simulation.seconds !== undefined
  const grow = steps.map((s) => (timed ? Math.max(s.seconds ?? 0, 0.05) : 1))
  const types = [...new Set(steps.map((s) => s.action.parts[0]?.facets.damageType ?? 'other'))]
  const description = `${steps.length} steps in play order${timed ? `, over ${simulation.seconds?.toFixed(1)} seconds` : ''}. ${steps
    .map((s, i) => `${i + 1}: ${s.action.name}, ${formatDamage(s.action.average)}`)
    .join('; ')}.`

  return (
    <figure className="m-0">
      <div role="img" aria-label={`Timeline. ${description}`} className="flex h-12 gap-0.5">
        {steps.map((step, i) => {
          const type = step.action.parts[0]?.facets.damageType ?? 'other'
          return (
            <div
              key={`${step.stepId}-${i}`}
              title={`${i + 1}. ${step.action.name}: ${formatDamage(step.action.average)}`}
              className="min-w-0 rounded-[3px]"
              style={{ flexGrow: grow[i], flexBasis: 0, background: TYPE_COLOUR[type], opacity: 0.35 + 0.65 * (step.action.average / Math.max(...steps.map((s) => s.action.average), 1)) }}
            />
          )
        })}
      </div>
      {spans.length > 0 ? (
        <div className="mt-2 grid gap-1">
          {spans.map((span) => (
            <div key={span.key}>
              <p className="truncate text-12 text-ink-2">{span.name}</p>
              <div aria-label={`${span.name}: on for ${span.on.filter(Boolean).length} of ${steps.length} steps`} role="img" className="flex h-2 gap-0.5">
                {span.on.map((on, i) => (
                  <div key={i} className={`min-w-0 rounded-full ${on ? 'bg-tone-energy-regen' : 'bg-transparent'}`} style={{ flexGrow: grow[i], flexBasis: 0 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-12 text-ink-2">
        {types.map((type) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px]" style={{ background: TYPE_COLOUR[type] }} aria-hidden="true" />
            {DAMAGE_TYPE_NAME[type]}
          </span>
        ))}
        <span className="text-ink-3">{timed ? 'Width is time.' : 'Each block is one step; add times to make width show time.'} Brighter blocks hit harder.</span>
      </figcaption>
    </figure>
  )
}
