import type { Element } from '../engine/types/stats'
import { ELEMENT_NAME } from './format'

const SWATCH: Record<Element, string> = {
  physical: 'bg-physical',
  glacio: 'bg-glacio',
  fusion: 'bg-fusion',
  electro: 'bg-electro',
  aero: 'bg-aero',
  spectro: 'bg-spectro',
  havoc: 'bg-havoc',
}

/** Element colour is a data colour: always shown with its name (DESIGN.md). */
export function ElementChip({ element, showName = true }: { element: Element; showName?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-13 text-ink-2">
      <span className={`inline-block size-2.5 rounded-[2px] ${SWATCH[element]}`} aria-hidden="true" />
      {showName ? ELEMENT_NAME[element] : <span className="sr-only">{ELEMENT_NAME[element]}</span>}
    </span>
  )
}

/** A square placeholder used where game art would go: initials on the element colour edge. */
export function Portrait({ name, element, size = 40 }: { name: string; element: Element; size?: number }) {
  const initials = name
    .replace(/^Rover: /, 'R ')
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-control border border-rule bg-raised font-display text-13 text-ink"
    >
      {initials}
      <span className={`absolute inset-x-0 bottom-0 h-0.5 ${SWATCH[element]}`} />
    </span>
  )
}
