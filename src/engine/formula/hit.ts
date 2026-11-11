import type { Element, HitFacets, ScalingStat, StatSheet } from '../types/stats'
import { critAverage } from './crit'
import { defMultiplier, enemyDefense } from './defense'
import { resMultiplier } from './resistance'

// One hit. Source: Wuthering Waves Wiki (Fandom, CC-BY-SA), "Damage".
//   DMG = (Stat x MV + Flat) x (1 + DMG Bonus) x (1 + Amplify) x (1 + Special) x Crit x DEF mult x RES mult

export interface HitInput {
  /** The skill's multiplier as a fraction: 0.4473 for 44.73%. */
  multiplier: number
  /** Flat part of the skill value ("96" in "48.00%+96"). Usually 0. */
  flat: number
  /** How many times this hit lands. */
  count: number
  scalingStat: ScalingStat
  facets: HitFacets
}

export interface EnemyState {
  level: number
  /** Resistance per element, as fractions (0.1 = 10%). */
  resistance: Record<Element, number>
}

export interface FormulaTerm {
  key: 'base' | 'dmgBonus' | 'amplify' | 'special' | 'defense' | 'resistance'
  value: number
}

/** Everything a person needs to re-derive the number by hand. */
export interface FormulaTrace {
  scalingStat: ScalingStat
  scalingValue: number
  /** The skill multiplier after any multiplier bonus. */
  multiplier: number
  flat: number
  critRate: number
  critDmg: number
  critAverage: number
  defense: { attackerLevel: number; enemyLevel: number; enemyDef: number; ignore: number; reduction: number }
  resistance: { base: number; reduction: number; total: number }
  /** The multiplied terms, in order. Their product is the non-crit damage of one hit. */
  terms: readonly FormulaTerm[]
}

export interface HitDamage {
  nonCrit: number
  crit: number
  average: number
}

export interface HitResult extends HitDamage {
  /** Damage of a single landing, before multiplying by count. */
  perHit: HitDamage
  count: number
  /** Element, damage type and tags of the hit, for breakdowns. */
  facets: HitFacets
  formula: FormulaTrace
  /** The stats this hit was computed from, with every contribution listed. */
  sheet: StatSheet
  hasUnverified: boolean
}

function scalingValue(sheet: StatSheet, stat: ScalingStat): number {
  switch (stat) {
    case 'atk':
      return sheet.atk.total
    case 'hp':
      return sheet.hp.total
    case 'def':
      return sheet.def.total
    case 'energyRegen':
      return sheet.energyRegen.total
  }
}

/**
 * Damage of one hit. `sheet` must already be scoped to this hit
 * (computeStatSheet called with the hit's facets).
 */
export function computeHit(hit: HitInput, sheet: StatSheet, attackerLevel: number, enemy: EnemyState): HitResult {
  const stat = scalingValue(sheet, hit.scalingStat)
  const multiplier = hit.multiplier * (1 + sheet.multiplierBonus.total)
  const base = stat * multiplier + hit.flat + sheet.flatDmg.total

  const baseRes = enemy.resistance[hit.facets.element]
  const totalRes = baseRes - sheet.resReduction.total
  const defIgnore = sheet.defIgnore.total
  const defReduction = sheet.defReduction.total

  const terms: FormulaTerm[] = [
    { key: 'base', value: base },
    { key: 'dmgBonus', value: 1 + sheet.dmgBonus.total },
    { key: 'amplify', value: 1 + sheet.amplify.total },
    { key: 'special', value: 1 + sheet.special.total },
    { key: 'defense', value: defMultiplier(attackerLevel, enemy.level, defIgnore, defReduction) },
    { key: 'resistance', value: resMultiplier(totalRes) },
  ]

  const nonCrit = terms.reduce((total, term) => total * term.value, 1)
  const critDmg = sheet.critDmg.total
  const average = critAverage(sheet.critRate.total, critDmg)
  const perHit: HitDamage = { nonCrit, crit: nonCrit * critDmg, average: nonCrit * average }

  return {
    nonCrit: perHit.nonCrit * hit.count,
    crit: perHit.crit * hit.count,
    average: perHit.average * hit.count,
    perHit,
    count: hit.count,
    facets: hit.facets,
    formula: {
      scalingStat: hit.scalingStat,
      scalingValue: stat,
      multiplier,
      flat: hit.flat + sheet.flatDmg.total,
      critRate: Math.min(Math.max(sheet.critRate.total, 0), 1),
      critDmg,
      critAverage: average,
      defense: {
        attackerLevel,
        enemyLevel: enemy.level,
        enemyDef: enemyDefense(enemy.level),
        ignore: defIgnore,
        reduction: defReduction,
      },
      resistance: { base: baseRes, reduction: sheet.resReduction.total, total: totalRes },
      terms,
    },
    sheet,
    hasUnverified: sheet.hasUnverified,
  }
}
