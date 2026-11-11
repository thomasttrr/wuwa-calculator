// Every number on screen goes through these, so the app shows numbers one way everywhere.
import type { DamageType, Element, Scope, StatKey } from '../engine/types/stats'

const whole = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })

export function formatDamage(value: number): string {
  return whole.format(Math.round(value))
}

/** A fraction as a percentage: 0.928 -> "92.8%". */
export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`
}

const FLAT: ReadonlySet<StatKey> = new Set(['atkFlat', 'hpFlat', 'defFlat', 'flatDmg'])

export function formatStatValue(stat: StatKey, value: number): string {
  return FLAT.has(stat) ? whole.format(Math.round(value)) : formatPercent(value)
}

export const ELEMENT_NAME: Record<Element, string> = {
  physical: 'Physical',
  glacio: 'Glacio',
  fusion: 'Fusion',
  electro: 'Electro',
  aero: 'Aero',
  spectro: 'Spectro',
  havoc: 'Havoc',
}

export const DAMAGE_TYPE_NAME: Record<DamageType, string> = {
  basic: 'Basic Attack',
  heavy: 'Heavy Attack',
  skill: 'Resonance Skill',
  liberation: 'Resonance Liberation',
  intro: 'Intro Skill',
  outro: 'Outro Skill',
  echo: 'Echo Skill',
  tuneRupture: 'Tune Rupture',
  other: 'Other',
}

const PLAIN: Record<StatKey, string> = {
  atkPct: 'ATK%',
  atkFlat: 'ATK',
  hpPct: 'HP%',
  hpFlat: 'HP',
  defPct: 'DEF%',
  defFlat: 'DEF',
  critRate: 'Crit. Rate',
  critDmg: 'Crit. DMG',
  energyRegen: 'Energy Regen',
  healingBonus: 'Healing Bonus',
  dmgBonus: 'DMG Bonus',
  amplify: 'DMG Amplify',
  special: 'Special DMG bonus',
  multiplierBonus: 'Skill multiplier bonus',
  flatDmg: 'Flat damage',
  defIgnore: 'Enemy DEF ignored',
  defReduction: 'Enemy DEF reduced',
  resReduction: 'Enemy RES reduced',
}

const ALL_ATTRIBUTES = 6

/** The game's name for a stat, with its scope spelled out. */
export function statLabel(stat: StatKey, scope?: Scope): string {
  const elements = scope?.elements
  const types = scope?.damageTypes
  if (stat === 'dmgBonus' || stat === 'amplify') {
    const suffix = stat === 'dmgBonus' ? 'DMG Bonus' : 'DMG Amplify'
    if (elements && elements.length >= ALL_ATTRIBUTES && !types) return `All-Attribute ${suffix}`
    if (elements?.length === 1 && !types) return `${ELEMENT_NAME[elements[0] ?? 'physical']} ${suffix}`
    if (types?.length === 1 && !elements) return `${DAMAGE_TYPE_NAME[types[0] ?? 'other']} ${suffix}`
  }
  const base = PLAIN[stat]
  const parts = [
    ...(elements && elements.length < ALL_ATTRIBUTES ? elements.map((e) => ELEMENT_NAME[e]) : []),
    ...(types ?? []).map((t) => DAMAGE_TYPE_NAME[t]),
  ]
  return parts.length > 0 ? `${base} (${parts.join(', ')})` : base
}
