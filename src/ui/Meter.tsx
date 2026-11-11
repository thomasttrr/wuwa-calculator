// The signature element (see DESIGN.md): a ruled scale with ticks and an amber needle.
// A meter never stands alone: callers always render the number and a label beside it.

export interface MeterTick {
  at: number
  label: string
}

export interface MeterProps {
  /** Current value, in the same units as min and max. */
  value: number
  min?: number
  max?: number
  ticks?: readonly MeterTick[]
  /** Accessible name, for example "Build score". */
  label: string
  /** Text read out as the value, for example "132 percent". */
  valueText: string
}

const DEFAULT_TICKS: readonly MeterTick[] = [
  { at: 0, label: '0' },
  { at: 100, label: '100' },
  { at: 200, label: '200' },
]

function toPercent(value: number, min: number, max: number): number {
  if (max <= min) return 0
  const clamped = Math.min(Math.max(value, min), max)
  return ((clamped - min) / (max - min)) * 100
}

export function Meter({ value, min = 0, max = 200, ticks = DEFAULT_TICKS, label, valueText }: MeterProps) {
  const position = toPercent(value, min, max)

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.min(Math.max(value, min), max)}
      aria-valuetext={valueText}
      className="w-full"
    >
      <div className="relative h-5">
        <div className="absolute inset-x-0 top-2 h-0.5 bg-rule" />
        <div className="absolute left-0 top-2 h-0.5 bg-signal-dim" style={{ width: `${position}%` }} />
        {ticks.map((tick) => (
          <div
            key={tick.at}
            className="absolute top-0.5 h-3.5 w-px bg-rule-strong"
            style={{ left: `${toPercent(tick.at, min, max)}%` }}
          />
        ))}
        <div
          className="absolute top-0 h-5 w-[3px] -translate-x-1/2 bg-signal transition-[left] duration-150 ease-out"
          style={{ left: `${position}%` }}
        />
      </div>
      <div className="relative mt-1 h-4 text-12 text-ink-3" aria-hidden="true">
        {ticks.map((tick) => {
          const at = toPercent(tick.at, min, max)
          const align = at <= 0 ? 'translate-x-0' : at >= 100 ? '-translate-x-full' : '-translate-x-1/2'
          return (
            <span key={tick.at} className={`absolute ${align}`} style={{ left: `${at}%` }}>
              {tick.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
