import type { ReactNode } from 'react'

/** A section is a panel on the page; its items are raised rows inside it (DESIGN.md, "Layout"). */
export function Section({
  title,
  id,
  action,
  description,
  children,
  className = '',
}: {
  title: string
  id: string
  action?: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section aria-labelledby={id} className={`mb-3 rounded-section bg-panel p-4 md:p-6 ${className}`}>
      <div className="flex min-h-9 items-center justify-between gap-3">
        <h2 id={id} className="font-display text-16 md:text-20">
          {title}
        </h2>
        {action}
      </div>
      {description ? <p className="mt-1 max-w-[64ch] text-ink-2">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  )
}

/** One plain sentence saying what to do next, and the action that does it. */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-panel border border-dashed border-rule-strong px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-ink-2">{children}</p>
      {action}
    </div>
  )
}
