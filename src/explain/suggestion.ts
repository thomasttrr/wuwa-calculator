// One plain sentence per suggestion: which part of the damage formula moved most, and how crowded
// that part already was. Worked out from the two simulations, hit by hit, weighted by damage.
import type { RotationResult } from '../engine/rotation/simulate'
import type { SubstatValue } from '../engine/suggest/rank'
import type { Catalog } from '../engine/types/catalog'
import type { HitResult } from '../engine/formula/hit'

export type Term = 'scaling' | 'multiplier' | 'dmgBonus' | 'amplify' | 'special' | 'crit' | 'defense' | 'resistance'

export interface Explanation {
  text: string
  term?: Term
}

const SCALING_LABEL = { atk: 'ATK', hp: 'HP', def: 'DEF', energyRegen: 'Energy Regen' } as const

function factor(hit: HitResult, term: Term): number {
  const f = hit.formula
  const t = (key: string) => f.terms.find((x) => x.key === key)?.value ?? 1
  switch (term) {
    case 'scaling':
      return f.scalingValue
    case 'multiplier':
      return f.multiplier
    case 'crit':
      return f.critAverage
    default:
      return t(term)
  }
}

function hits(result: RotationResult): HitResult[] {
  return result.steps.flatMap((step) => (step.action.counted ? step.action.parts : []))
}

const NO_DIFFERENCE = 0.001
const TERMS: Term[] = ['scaling', 'multiplier', 'dmgBonus', 'amplify', 'special', 'crit', 'defense', 'resistance']
const ADDITIVE: Term[] = ['dmgBonus', 'amplify']

const whole = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const pct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`

function format(term: Term, value: number): string {
  if (term === 'scaling') return whole.format(value)
  if (ADDITIVE.includes(term)) return pct(value - 1)
  return `×${value.toFixed(2)}`
}

export function explainChange(before: RotationResult, after: RotationResult): Explanation {
  const gain = before.total.average > 0 ? after.total.average / before.total.average - 1 : 0
  if (Math.abs(gain) < NO_DIFFERENCE) return { text: 'No real difference for this rotation.' }

  const a = hits(before)
  const b = hits(after)
  const pairs = a.map((hit, i) => [hit, b[i]] as const).filter((p): p is readonly [HitResult, HitResult] => p[1] !== undefined && p[0].average > 0)
  const weight = pairs.reduce((sum, [hit]) => sum + hit.average, 0)
  if (weight <= 0 || a.length !== b.length) return { text: `${gain > 0 ? 'Adds' : 'Loses'} about ${(Math.abs(gain) * 100).toFixed(1)}% damage.` }

  let best: { term: Term; log: number; from: number; to: number } | null = null
  for (const term of TERMS) {
    let log = 0
    let from = 0
    let to = 0
    for (const [x, y] of pairs) {
      const w = x.average / weight
      const fx = factor(x, term)
      const fy = factor(y, term)
      if (fx > 0 && fy > 0) log += w * Math.log(fy / fx)
      from += w * fx
      to += w * fy
    }
    if (Math.sign(log) === Math.sign(gain) && (!best || Math.abs(log) > Math.abs(best.log))) best = { term, log, from, to }
  }
  if (!best) return { text: `${gain > 0 ? 'Adds' : 'Loses'} about ${(Math.abs(gain) * 100).toFixed(1)}% damage.` }

  const scalingStats = new Set(pairs.map(([hit]) => hit.formula.scalingStat))
  if (best.term === 'scaling' && scalingStats.size > 1) {
    // ATK and HP cannot be averaged into one number, so say how much they grew instead.
    return {
      text: `${gain > 0 ? 'Mostly' : 'Loses mostly'} through the stats your hits scale on: ${pct(Math.exp(best.log) - 1)} on average.`,
      term: 'scaling',
    }
  }
  const label = best.term === 'scaling' ? SCALING_LABEL[pairs[0]![0].formula.scalingStat] : LABEL[best.term]
  let text = `${gain > 0 ? 'Mostly' : 'Loses mostly'} through ${label}: ${format(best.term, best.from)} to ${format(best.term, best.to)} on average.`
  if (gain > 0 && ADDITIVE.includes(best.term)) {
    const nominal = best.to - best.from
    const lift = best.to / best.from - 1
    if (lift < nominal * 0.5) {
      const shown = lift * 100 >= 10 ? Math.round(lift * 100).toString() : (lift * 100).toFixed(1)
      text += ` It was already high, so that lifts damage by about ${shown}%.`
    }
  }
  return { text, term: best.term }
}

const LABEL: Record<Exclude<Term, 'scaling'>, string> = {
  multiplier: 'skill multiplier',
  dmgBonus: 'DMG Bonus',
  amplify: 'DMG Amplify',
  special: 'special DMG bonus',
  crit: 'average crit',
  defense: 'enemy defence',
  resistance: 'enemy resistance',
}

export function farmingGoal(values: readonly SubstatValue[], catalog: Catalog): string {
  const top = values[0]
  if (!top || top.perRoll <= 0) return 'No substat adds damage to this rotation.'
  return `Your next best roll is ${catalog.echoStats.substats[top.row]?.label ?? 'that stat'} on any Echo.`
}
