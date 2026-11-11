// One plain sentence under the score, worked out from the numbers: which stat group, raised to
// the 100% reference level, would add the most damage.
import { compileRotation, ECHO_STAT_KEYS, echoStatVector, stripEchoStats } from '../engine/compiled/compile'
import type { ScoreAnchors } from '../engine/score/score'
import type { Build } from '../engine/types/build'
import type { Catalog } from '../engine/types/catalog'
import { DAMAGE_TYPE_NAME, ELEMENT_NAME } from '../ui/format'

export interface Verdict {
  text: string
  /** The stat group named, when there is one. */
  stat?: string
  /** Damage gained by raising it to the reference level, as a fraction. */
  gain?: number
}

const index = (id: string) => ECHO_STAT_KEYS.findIndex((key) => key.id === id)

/** Stat groups a player thinks in. Each is a set of slots in the Echo stat vector. */
const GROUPS: { label: string; slots: number[] }[] = [
  { label: 'ATK', slots: [index('atkPct'), index('atkFlat')] },
  { label: 'HP', slots: [index('hpPct'), index('hpFlat')] },
  { label: 'DEF', slots: [index('defPct'), index('defFlat')] },
  { label: 'Crit. Rate', slots: [index('critRate')] },
  { label: 'Crit. DMG', slots: [index('critDmg')] },
  ...ECHO_STAT_KEYS.flatMap((key, slot) =>
    key.element
      ? [{ label: `${ELEMENT_NAME[key.element]} DMG Bonus`, slots: [slot] }]
      : key.damageType
        ? [{ label: `${DAMAGE_TYPE_NAME[key.damageType]} DMG Bonus`, slots: [slot] }]
        : [],
  ),
]

const MEANINGFUL = 0.005

export function buildVerdict(build: Build, catalog: Catalog, anchors: ScoreAnchors): Verdict {
  if (build.echoes.every((echo) => echo === null)) return { text: 'No Echoes equipped yet. Add Echoes to raise this score.' }

  const compiled = compileRotation(stripEchoStats(build), catalog)
  const current = echoStatVector(build.echoes)
  const reference = anchors.referenceLoadout.vector
  const now = compiled.evaluate(current)

  let best: { label: string; gain: number } | null = null
  for (const group of GROUPS) {
    if (!group.slots.some((slot) => (reference[slot] ?? 0) > (current[slot] ?? 0))) continue
    const trial = Float64Array.from(current)
    for (const slot of group.slots) trial[slot] = Math.max(current[slot] ?? 0, reference[slot] ?? 0)
    const gain = compiled.evaluate(trial) / now - 1
    if (!best || gain > best.gain) best = { label: group.label, gain }
  }

  if (!best || best.gain < MEANINGFUL) {
    return { text: 'Your Echo stats match or beat the reference in every stat that matters for this rotation.' }
  }
  const amount = best.gain * 100
  const shown = amount >= 10 ? Math.round(amount).toString() : amount.toFixed(1)
  return {
    text: `Held back most by low ${best.label}. Raising it to the reference level adds about ${shown}% damage.`,
    stat: best.label,
    gain: best.gain,
  }
}
