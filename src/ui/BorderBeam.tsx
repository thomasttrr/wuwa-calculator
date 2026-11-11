import type { CSSProperties } from 'react'

/** Beam colour pairs, all drawn from the stat tones (DESIGN.md, "The beam"). */
export const BEAM = {
  /** Jade into sky: the default, for the score. */
  tide: { from: 'var(--color-signal)', to: 'var(--color-tone-energy-regen)' },
  /** Coral into rose: the main Echo. */
  ember: { from: 'var(--color-tone-crit-rate)', to: 'var(--color-tone-crit-dmg)' },
  /** Ice into jade: a change you are trying out. */
  frost: { from: 'var(--color-tone-bonus)', to: 'var(--color-signal)' },
} as const

export interface BorderBeamProps {
  colours?: keyof typeof BEAM
  /** Seconds for one full lap. Slower reads calmer; DESIGN.md allows 6 to 14. */
  duration?: number
  /** Start part-way round, in seconds, so two beams on one screen never move in step. */
  delay?: number
  width?: number
  /** Length of the light band, in px. */
  size?: number
}

/**
 * A band of light travelling the border of its parent. The parent must be `relative`
 * and carry the corner radius. Decorative only: hidden from assistive technology,
 * removed under reduced motion and where the browser cannot draw it.
 */
export function BorderBeam({ colours = 'tide', duration = 9, delay = 0, width = 2, size = 180 }: BorderBeamProps) {
  const style = {
    '--beam-from': BEAM[colours].from,
    '--beam-to': BEAM[colours].to,
    '--beam-duration': `${duration}s`,
    '--beam-delay': `${-delay}s`,
    '--beam-width': `${width}px`,
    '--beam-size': `${size}px`,
  } as CSSProperties
  return <span aria-hidden="true" className="border-beam" style={style} />
}
