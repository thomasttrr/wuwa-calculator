// The fast path. Score references, Suggestions and the Optimizer all ask the same question
// thousands of times: "same build, different Echo stats: how much damage?". This folds
// everything except Echo stats into constants once, then answers each question with a short
// loop over a handful of groups.
//
// It relies on one property, checked by tests/engine/compiled/compiled-equals-full.test.ts:
// Echo stats only ever add to ATK/HP/DEF (percent and flat), Crit. Rate, Crit. DMG,
// Energy Regen, Healing Bonus and element or attack-type DMG Bonus. Set bonuses and the main
// Echo's effect are part of the frozen build (see stripEchoStats), not of the Echo stats.
import { computeAction } from '../rotation/action'
import type { ActionResult } from '../rotation/action'
import { simulateRotation } from '../rotation/simulate'
import type { Build, EchoInstance } from '../types/build'
import type { Catalog } from '../types/catalog'
import type { DamageType, Element, Scope, StatKey } from '../types/stats'
import { ELEMENTS } from '../types/stats'

export interface EchoStatKey {
  id: string
  stat: StatKey
  element?: Element
  damageType?: DamageType
}

const TYPED_BONUSES = ['basic', 'heavy', 'skill', 'liberation'] as const

/** Every stat an Echo can carry, in a fixed order. An Echo stat vector is indexed by this list. */
export const ECHO_STAT_KEYS: readonly EchoStatKey[] = [
  { id: 'atkPct', stat: 'atkPct' },
  { id: 'atkFlat', stat: 'atkFlat' },
  { id: 'hpPct', stat: 'hpPct' },
  { id: 'hpFlat', stat: 'hpFlat' },
  { id: 'defPct', stat: 'defPct' },
  { id: 'defFlat', stat: 'defFlat' },
  { id: 'critRate', stat: 'critRate' },
  { id: 'critDmg', stat: 'critDmg' },
  { id: 'energyRegen', stat: 'energyRegen' },
  { id: 'healingBonus', stat: 'healingBonus' },
  ...ELEMENTS.map((element) => ({ id: `dmgBonus:${element}`, stat: 'dmgBonus' as const, element })),
  ...TYPED_BONUSES.map((damageType) => ({ id: `dmgBonus:${damageType}`, stat: 'dmgBonus' as const, damageType })),
]

const INDEX = new Map(ECHO_STAT_KEYS.map((key, index) => [key.id, index]))
const at = (id: string): number => {
  const index = INDEX.get(id)
  if (index === undefined) throw new Error(`No Echo stat slot ${id}`)
  return index
}

/** The vector slot for one Echo stat. Throws for a stat an Echo cannot carry. */
export function echoStatIndex(stat: StatKey, scope?: Scope): number {
  if (stat === 'dmgBonus') {
    const element = scope?.elements?.length === 1 ? scope.elements[0] : undefined
    const type = scope?.damageTypes?.length === 1 ? scope.damageTypes[0] : undefined
    const id = element && !type ? `dmgBonus:${element}` : type && !element ? `dmgBonus:${type}` : undefined
    const index = id === undefined ? undefined : INDEX.get(id)
    if (index === undefined) throw new Error(`An Echo cannot carry dmgBonus with scope ${JSON.stringify(scope)}`)
    return index
  }
  if (scope) throw new Error(`An Echo cannot carry a scoped ${stat}`)
  const index = INDEX.get(stat)
  if (index === undefined) throw new Error(`An Echo cannot carry ${stat}`)
  return index
}

/** Adds up the stats of a set of Echoes into one vector. */
export function echoStatVector(echoes: readonly (EchoInstance | null)[]): Float64Array {
  const vector = new Float64Array(ECHO_STAT_KEYS.length)
  for (const echo of echoes) {
    if (!echo) continue
    vector[echoStatIndex(echo.mainStat.stat, echo.mainStat.scope)]! += echo.mainStat.value
    vector[echoStatIndex(echo.fixedStat.stat)]! += echo.fixedStat.value
    for (const substat of echo.substats) vector[echoStatIndex(substat.stat, substat.scope)]! += substat.value
  }
  return vector
}

/**
 * The build with every Echo stat set to zero, keeping which Echoes and sets are equipped,
 * so set bonuses and the main Echo's effect still apply.
 */
export function stripEchoStats(build: Build): Build {
  return {
    ...build,
    echoes: build.echoes.map((echo) =>
      echo
        ? {
            ...echo,
            mainStat: { ...echo.mainStat, value: 0 },
            fixedStat: { ...echo.fixedStat, value: 0 },
            substats: [],
          }
        : null,
    ),
  }
}

export type CompileTarget = { kind: 'rotation' } | { kind: 'action'; actionId: number }

export interface CompiledRotation {
  /** Average damage for the given Echo stat vector (indexed by ECHO_STAT_KEYS). */
  evaluate(echoStats: Float64Array): number
  /** How many hits went in, and how many groups they folded into. */
  hitCount: number
  groupCount: number
  /** Echo stat slots that can change the result at all. */
  touchedKeys: ReadonlySet<number>
}

const SCALING_SLOTS = {
  atk: { pct: at('atkPct'), flat: at('atkFlat') },
  hp: { pct: at('hpPct'), flat: at('hpFlat') },
  def: { pct: at('defPct'), flat: at('defFlat') },
} as const
const ER = at('energyRegen')
const CR = at('critRate')
const CD = at('critDmg')

interface Group {
  /** -1 for Energy Regen scaling, which has no percent or flat split. */
  pctSlot: number
  flatSlot: number
  base: number
  pct: number
  flat: number
  elementSlot: number
  typeSlot: number
  bonus: number
  critRate: number
  critDmg: number
  /** Sum of multiplier x count x constant terms over the group's hits. */
  multiplierWeight: number
  /** Sum of flat damage x count x constant terms. */
  flatWeight: number
}

/**
 * Folds a build whose Echo stats were stripped (stripEchoStats) into a fast evaluator.
 * Pass the stripped build; supply the Echo stats to evaluate().
 */
export function compileRotation(frozen: Build, catalog: Catalog, target: CompileTarget = { kind: 'rotation' }): CompiledRotation {
  const actions: ActionResult[] =
    target.kind === 'rotation'
      ? simulateRotation(frozen, catalog).steps.map((step) => step.action)
      : [computeAction(frozen, catalog, target.actionId)]

  const groups = new Map<string, Group>()
  let hitCount = 0
  const touched = new Set<number>([CR, CD])

  for (const action of actions) {
    for (const part of action.parts) {
      hitCount += 1
      const { sheet, formula, facets } = part
      const scaling = formula.scalingStat
      const slots = scaling === 'energyRegen' ? { pct: -1, flat: ER } : SCALING_SLOTS[scaling]
      const stat =
        scaling === 'energyRegen'
          ? { base: sheet.energyRegen.total, pct: 0, flat: 0 }
          : { base: sheet[scaling].base, pct: sheet[scaling].percent.total, flat: sheet[scaling].flat.total }
      const elementSlot = at(`dmgBonus:${facets.element}`)
      const typeSlot = (TYPED_BONUSES as readonly string[]).includes(facets.damageType) ? at(`dmgBonus:${facets.damageType}`) : -1
      const constant = formula.terms
        .filter((term) => term.key !== 'base' && term.key !== 'dmgBonus')
        .reduce((product, term) => product * term.value, 1)

      for (const slot of [slots.pct, slots.flat, elementSlot, typeSlot]) if (slot >= 0) touched.add(slot)

      const key = [scaling, stat.base, stat.pct, stat.flat, elementSlot, typeSlot, sheet.dmgBonus.total, sheet.critRate.total, sheet.critDmg.total].join('|')
      const group = groups.get(key) ?? {
        pctSlot: slots.pct,
        flatSlot: slots.flat,
        base: stat.base,
        pct: stat.pct,
        flat: stat.flat,
        elementSlot,
        typeSlot,
        bonus: sheet.dmgBonus.total,
        critRate: sheet.critRate.total,
        critDmg: sheet.critDmg.total,
        multiplierWeight: 0,
        flatWeight: 0,
      }
      group.multiplierWeight += formula.multiplier * part.count * constant
      group.flatWeight += formula.flat * part.count * constant
      groups.set(key, group)
    }
  }

  const list = [...groups.values()]
  return {
    hitCount,
    groupCount: list.length,
    touchedKeys: touched,
    evaluate(v: Float64Array): number {
      let total = 0
      for (const g of list) {
        const statValue = g.pctSlot < 0 ? g.base + v[g.flatSlot]! : g.base * (1 + g.pct + v[g.pctSlot]!) + g.flat + v[g.flatSlot]!
        const bonus = 1 + g.bonus + v[g.elementSlot]! + (g.typeSlot >= 0 ? v[g.typeSlot]! : 0)
        const rate = Math.min(Math.max(g.critRate + v[CR]!, 0), 1)
        const crit = 1 + rate * (g.critDmg + v[CD]! - 1)
        total += (statValue * g.multiplierWeight + g.flatWeight) * bonus * crit
      }
      return total
    },
  }
}
