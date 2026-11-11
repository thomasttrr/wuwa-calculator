import { Search } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

export interface PickerItem {
  id: string
  label: string
  /** Second line, plain words. */
  detail?: string
  /** Shown before the label (an element chip, a cost). */
  lead?: ReactNode
  /** Shown after the label (marks). */
  trail?: ReactNode
  /** Extra words the search matches (element, weapon type, set names). */
  keywords?: string
  /** Facet values this item has, for the filter chips: { element: 'aero', rarity: '5' }. */
  facets?: Record<string, string>
}

export interface PickerFilter {
  facet: string
  label: string
  options: readonly { value: string; label: string }[]
}

/**
 * A searchable list that works with a keyboard (type, arrows, Enter) and by touch.
 * Filters are rows of toggle chips; choosing one again clears it.
 */
export function Picker({
  items,
  onPick,
  filters = [],
  searchLabel,
  emptyText,
  selectedId,
}: {
  items: readonly PickerItem[]
  onPick: (id: string) => void
  filters?: readonly PickerFilter[]
  searchLabel: string
  emptyText: string
  selectedId?: string
}) {
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const [active, setActive] = useState(0)
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)

  const visible = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return items.filter((item) => {
      for (const [facet, value] of Object.entries(chosen)) if (item.facets?.[facet] !== value) return false
      const haystack = `${item.label} ${item.detail ?? ''} ${item.keywords ?? ''}`.toLowerCase()
      return words.every((word) => haystack.includes(word))
    })
  }, [items, query, chosen])

  const activeIndex = Math.min(active, Math.max(visible.length - 1, 0))
  const optionId = (index: number) => `${listId}-option-${index}`

  const move = (index: number) => {
    const next = Math.min(Math.max(index, 0), visible.length - 1)
    setActive(next)
    listRef.current?.querySelector(`#${CSS.escape(optionId(next))}`)?.scrollIntoView({ block: 'nearest' })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(activeIndex + 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(activeIndex - 1)
    } else if (event.key === 'Enter') {
      const item = visible[activeIndex]
      if (item) {
        event.preventDefault()
        onPick(item.id)
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          role="combobox"
          aria-label={searchLabel}
          aria-controls={listId}
          aria-expanded="true"
          aria-activedescendant={visible.length > 0 ? optionId(activeIndex) : undefined}
          autoComplete="off"
          placeholder={searchLabel}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          className="min-h-11 w-full rounded-control border border-rule bg-page pr-3 pl-9 text-ink placeholder:text-ink-3 focus:border-signal focus:outline-none md:min-h-10"
        />
      </div>

      {filters.map((filter) => (
        <div key={filter.facet} role="group" aria-label={filter.label} className="flex flex-wrap gap-1.5">
          {filter.options.map((option) => {
            const on = chosen[filter.facet] === option.value
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setChosen((current) => {
                    const next = { ...current }
                    if (on) delete next[filter.facet]
                    else next[filter.facet] = option.value
                    return next
                  })
                  setActive(0)
                }}
                className={`min-h-9 rounded-control border px-2.5 text-13 transition-colors duration-150 ${
                  on ? 'border-signal bg-signal-dim text-ink' : 'border-rule text-ink-2 hover:bg-raised hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      ))}

      <p className="text-12 text-ink-3" aria-live="polite">
        {visible.length} {visible.length === 1 ? 'result' : 'results'}
      </p>

      {visible.length === 0 ? (
        <p className="text-ink-2">{emptyText}</p>
      ) : (
        <ul id={listId} ref={listRef} role="listbox" aria-label={searchLabel} className="-mx-2">
          {visible.map((item, index) => {
            const isActive = index === activeIndex
            const isSelected = item.id === selectedId
            return (
              <li
                key={item.id}
                id={optionId(index)}
                role="option"
                aria-selected={isSelected}
                onMouseMove={() => setActive(index)}
                onClick={() => onPick(item.id)}
                className={`flex min-h-12 cursor-pointer items-center gap-3 border-b border-rule px-2 py-2 ${
                  isActive ? 'bg-raised' : ''
                } ${isSelected ? 'shadow-[inset_2px_0_0_var(--color-signal)]' : ''}`}
              >
                {item.lead}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{item.label}</div>
                  {item.detail ? <div className="truncate text-13 text-ink-3">{item.detail}</div> : null}
                </div>
                {item.trail}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
