import { Minus, Plus } from 'lucide-react'
import { useId } from 'react'
import type { ReactNode, SelectHTMLAttributes } from 'react'
import { Switch as RadixSwitch } from 'radix-ui'

const CONTROL =
  'min-h-11 w-full rounded-control border border-rule bg-page px-3 text-ink md:min-h-9 hover:border-rule-strong focus:border-signal focus:outline-none'

/** A native select: the most reliable picker on phones and with screen readers. */
export function SelectField({
  label,
  hint,
  options,
  value,
  onChange,
  ...rest
}: {
  label: string
  hint?: string
  options: readonly { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'>) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-13 text-ink-2">
        {label}
      </label>
      <select id={id} className={CONTROL} value={value} onChange={(event) => onChange(event.target.value)} {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <span className="text-12 text-ink-3">{hint}</span> : null}
    </div>
  )
}

/** A whole-number field with minus and plus buttons; keeps the value inside min and max. */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  suffix?: string
}) {
  const id = useId()
  const set = (next: number) => onChange(Math.min(max, Math.max(min, Math.round(next))))
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-13 text-ink-2">
        {label}
      </label>
      <div className="flex items-stretch">
        <button
          type="button"
          aria-label={`Lower ${label}`}
          disabled={value <= min}
          onClick={() => set(value - 1)}
          className="inline-flex min-h-11 w-11 items-center justify-center rounded-l-control border border-rule text-ink-2 hover:bg-raised disabled:opacity-40 md:min-h-9 md:w-9"
        >
          <Minus size={16} aria-hidden="true" />
        </button>
        <input
          id={id}
          inputMode="numeric"
          className="min-h-11 w-16 border-y border-rule bg-page text-center text-ink focus:border-signal focus:outline-none md:min-h-9"
          value={value}
          onChange={(event) => {
            const parsed = Number(event.target.value)
            if (Number.isFinite(parsed)) set(parsed)
          }}
        />
        <button
          type="button"
          aria-label={`Raise ${label}`}
          disabled={value >= max}
          onClick={() => set(value + 1)}
          className="inline-flex min-h-11 w-11 items-center justify-center rounded-r-control border border-rule text-ink-2 hover:bg-raised disabled:opacity-40 md:min-h-9 md:w-9"
        >
          <Plus size={16} aria-hidden="true" />
        </button>
        {suffix ? <span className="ml-2 self-center text-13 text-ink-3">{suffix}</span> : null}
      </div>
    </div>
  )
}

export function Switch({
  label,
  description,
  checked,
  onChange,
  extra,
}: {
  label: ReactNode
  description?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  extra?: ReactNode
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        {description ? <div className="mt-0.5 text-13 text-ink-2">{description}</div> : null}
        {extra}
      </div>
      <RadixSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-rule-strong bg-page transition-colors duration-150 data-[state=checked]:border-signal data-[state=checked]:bg-signal-dim"
      >
        <RadixSwitch.Thumb className="block size-4 translate-x-1 rounded-full bg-ink-2 transition-transform duration-150 data-[state=checked]:translate-x-6 data-[state=checked]:bg-signal" />
      </RadixSwitch.Root>
    </div>
  )
}
