import { useMemo } from 'react'
import { useCatalog } from '../../app/context'
import type { Build } from '../../engine/types/build'
import { bloomEchoes, type SubstatTone } from '../../explain/echo-bloom'
import { arcPath, BLOOM, bloomWedges, petalStart } from '../../ui/bloom-geometry'

/** The CSS colour for each stat tone (DESIGN.md, "Stat tones"). */
export const TONE_COLOUR: Record<SubstatTone, string> = {
  critRate: 'var(--color-tone-crit-rate)',
  critDmg: 'var(--color-tone-crit-dmg)',
  atk: 'var(--color-tone-atk)',
  energyRegen: 'var(--color-tone-energy-regen)',
  bonus: 'var(--color-tone-bonus)',
  hp: 'var(--color-tone-hp)',
  def: 'var(--color-tone-def)',
  other: 'var(--color-ink-3)',
}
export const UNUSED_COLOUR = 'var(--color-tone-unused)'

export const TONE_LEGEND: { label: string; colour: string }[] = [
  { label: 'Crit. Rate', colour: TONE_COLOUR.critRate },
  { label: 'Crit. DMG', colour: TONE_COLOUR.critDmg },
  { label: 'ATK', colour: TONE_COLOUR.atk },
  { label: 'Energy Regen', colour: TONE_COLOUR.energyRegen },
  { label: 'DMG Bonus', colour: TONE_COLOUR.bonus },
  { label: 'HP', colour: TONE_COLOUR.hp },
  { label: 'DEF', colour: TONE_COLOUR.def },
  { label: 'Adds no damage here', colour: UNUSED_COLOUR },
]

/**
 * The signature (DESIGN.md): five petals, one per Echo slot, clockwise from the top.
 * Each wedge is a substat: tone for what it is, length for its roll tier, slate when it adds no damage.
 */
export function EchoBloom({ build, children }: { build: Build; children?: React.ReactNode }) {
  const catalog = useCatalog()
  const echoes = useMemo(() => bloomEchoes(build, catalog), [build, catalog])
  const wedges = bloomWedges(echoes)
  const c = BLOOM.centre
  const summary = echoes
    .map((echo, slot) =>
      echo
        ? `Echo ${slot + 1}, ${echo.name}: ${echo.subs.map((s) => `${s.label} ${s.valueText}, tier ${s.tier} of ${s.tiers}${s.addsDamage ? '' : ', adds no damage'}`).join('; ') || 'no substats'}.`
        : `Echo ${slot + 1}: empty.`,
    )
    .join(' ')

  return (
    <figure className="relative m-0 w-full">
      <svg viewBox={`0 0 ${BLOOM.size} ${BLOOM.size}`} className="block h-auto w-full" role="img" aria-label={`Echo bloom. ${summary}`}>
        {[150, 200, 250, 300].map((r) => (
          <circle key={r} cx={c} cy={c} r={r} fill="none" stroke="var(--color-rule)" strokeWidth={1} />
        ))}
        {echoes.map((echo, slot) =>
          echo ? null : (
            <path
              key={`empty-${slot}`}
              d={arcPath(petalStart(slot) + 3, petalStart(slot) + BLOOM.petal - 3, BLOOM.inner + 20)}
              fill="none"
              stroke="var(--color-rule-strong)"
              strokeWidth={2}
              strokeDasharray="4 6"
            />
          ),
        )}
        {wedges.map((w) => (
          <path key={`${w.slot}-${w.index}`} d={w.d} fill={w.sub.addsDamage ? TONE_COLOUR[w.sub.tone] : UNUSED_COLOUR} />
        ))}
        {echoes[0] ? (
          <path
            d={arcPath(petalStart(0) + 3, petalStart(0) + BLOOM.petal - 3, BLOOM.inner - 10)}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth={3}
            strokeLinecap="round"
          />
        ) : null}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">{children}</div>
    </figure>
  )
}
