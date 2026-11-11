import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'quiet'

const VARIANT: Record<Variant, string> = {
  // The one accent-filled action per view (DESIGN.md).
  primary: 'bg-signal font-semibold text-on-signal hover:brightness-110',
  secondary: 'border border-rule font-medium text-ink hover:bg-raised',
  quiet: 'font-medium text-ink-2 hover:bg-raised hover:text-ink',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  /** Icon shown before the label. */
  icon?: ReactNode
}

export function Button({ variant = 'secondary', icon, className = '', children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-14 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-9 ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon buttons have no visible text. */
  label: string
  children: ReactNode
}

export function IconButton({ label, children, className = '', type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex size-11 items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 md:size-9 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
