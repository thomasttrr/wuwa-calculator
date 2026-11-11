// The whole-build "how this was calculated": every figure the app shows for a build, each
// with the parts it is made of and where each part came from. Built from the same functions
// that compute the results, so the explanation cannot drift from the numbers.
import { defMultiplier, enemyDefense } from '../formula/defense'
import { resMultiplier } from '../formula/resistance'
import { simulateRotation } from '../rotation/simulate'
import { resolveBaseStats } from '../stats/base'
import { collectModifiers } from '../stats/collect'
import { computeStatSheet } from '../stats/sheet'
import type { Build } from '../types/build'
import type { Catalog } from '../types/catalog'
import type { DamageType, Element, Modifier, SourceKind, StatKey } from '../types/stats'
import { ELEMENTS } from '../types/stats'

export interface LedgerPart {
  label: string
  value: number
  kind: SourceKind | 'action'
  /** False when this part comes from an unverified input. */
  verified: boolean
}

export interface LedgerEntry {
  id: string
  label: string
  value: number
  unit: 'number' | 'percent' | 'multiplier' | 'damage'
  /** "sum": value = startsFrom + sum of parts. "formula": worked out as `formula` says. */
  combine: 'sum' | 'formula'
  startsFrom?: number
  /** Plain-words working, for "formula" entries. */
  formula?: string
  note?: string
  parts: readonly LedgerPart[]
  hasUnverified: boolean
}

export interface Ledger {
  gameVersion: string
  dataDate: string
  entries: readonly LedgerEntry[]
  hasUnverified: boolean
}

const ELEMENT_NAME: Record<Element, string> = {
  physical: 'Physical',
  glacio: 'Glacio',
  fusion: 'Fusion',
  electro: 'Electro',
  aero: 'Aero',
  spectro: 'Spectro',
  havoc: 'Havoc',
}
const TYPE_NAME: Partial<Record<DamageType, string>> = {
  basic: 'Basic Attack',
  heavy: 'Heavy Attack',
  skill: 'Resonance Skill',
  liberation: 'Resonance Liberation',
  intro: 'Intro Skill',
  outro: 'Outro Skill',
  echo: 'Echo Skill',
}

function toPart(modifier: Modifier, label = modifier.source.name): LedgerPart {
  return { label, value: modifier.value, kind: modifier.source.kind, verified: modifier.source.verified !== false }
}

function sumEntry(
  id: string,
  label: string,
  unit: LedgerEntry['unit'],
  parts: LedgerPart[],
  startsFrom?: number,
  note?: string,
): LedgerEntry {
  const value = parts.reduce((total, part) => total + part.value, startsFrom ?? 0)
  return {
    id,
    label,
    value,
    unit,
    combine: 'sum',
    ...(startsFrom !== undefined ? { startsFrom } : {}),
    ...(note ? { note } : {}),
    parts,
    hasUnverified: parts.some((part) => !part.verified),
  }
}

/** Describes where a scoped modifier applies, in plain words. */
function scopeWords(modifier: Modifier): string {
  const scope = modifier.scope
  if (!scope) return 'every hit'
  const words: string[] = []
  if (scope.elements) words.push(scope.elements.map((e) => ELEMENT_NAME[e]).join(' or '))
  if (scope.damageTypes) words.push(scope.damageTypes.map((t) => TYPE_NAME[t] ?? t).join(' or '))
  if (scope.actionIds) words.push('specific skills')
  if (scope.tags) words.push(scope.tags.join(' or '))
  return `${words.join(', ')} only`
}

const OTHER_STATS: { stat: StatKey; label: string; unit: LedgerEntry['unit'] }[] = [
  { stat: 'amplify', label: 'DMG Amplify', unit: 'percent' },
  { stat: 'special', label: 'Special DMG bonus', unit: 'percent' },
  { stat: 'multiplierBonus', label: 'Skill multiplier bonus', unit: 'percent' },
  { stat: 'flatDmg', label: 'Flat damage added', unit: 'number' },
  { stat: 'defIgnore', label: 'Enemy DEF ignored', unit: 'percent' },
  { stat: 'defReduction', label: 'Enemy DEF reduced', unit: 'percent' },
  { stat: 'resReduction', label: 'Enemy RES reduced', unit: 'percent' },
]

export function buildLedger(build: Build, catalog: Catalog): Ledger {
  const resonator = catalog.resonators[build.resonator.id]
  if (!resonator) throw new Error(`Unknown Resonator ${build.resonator.id}`)
  const base = resolveBaseStats(build, catalog)
  const modifiers = collectModifiers(build, catalog)
  const sheet = computeStatSheet(base, modifiers)
  const entries: LedgerEntry[] = []

  // ATK, HP and DEF: base x (1 + percent) + flat.
  const scaled = [
    { key: 'atk', name: 'ATK', trace: sheet.atk, baseParts: base.atkParts },
    { key: 'hp', name: 'HP', trace: sheet.hp, baseParts: base.hpParts },
    { key: 'def', name: 'DEF', trace: sheet.def, baseParts: base.defParts },
  ] as const
  for (const { key, name, trace, baseParts } of scaled) {
    entries.push(
      sumEntry(`${key}.base`, `Base ${name}`, 'number', baseParts.map((part) => ({ label: part.name, value: part.value, kind: 'base', verified: true }))),
      sumEntry(`${key}.percent`, `${name} bonus`, 'percent', trace.percent.parts.map((m) => toPart(m))),
      sumEntry(`${key}.flat`, `Flat ${name}`, 'number', trace.flat.parts.map((m) => toPart(m))),
    )
    entries.push({
      id: key,
      label: name,
      value: trace.total,
      unit: 'number',
      combine: 'formula',
      formula: `Base ${name} x (1 + ${name} bonus) + flat ${name}`,
      parts: [],
      hasUnverified: trace.percent.parts.concat(trace.flat.parts).some((m) => m.source.verified === false),
    })
  }

  entries.push(
    sumEntry('critRate', 'Crit. Rate', 'percent', sheet.critRate.parts.map((m) => toPart(m)), base.critRate, 'Counted up to 100%.'),
    sumEntry('critDmg', 'Crit. DMG', 'percent', sheet.critDmg.parts.map((m) => toPart(m)), base.critDmg),
    sumEntry('energyRegen', 'Energy Regen', 'percent', sheet.energyRegen.parts.map((m) => toPart(m)), base.energyRegen),
    sumEntry('healingBonus', 'Healing Bonus', 'percent', sheet.healingBonus.parts.map((m) => toPart(m))),
  )

  // DMG Bonus, grouped by what it applies to.
  const bonuses = modifiers.filter((m) => m.stat === 'dmgBonus')
  const onlyElement = (m: Modifier) =>
    m.scope?.elements?.length === 1 && !m.scope.damageTypes && !m.scope.actionIds && !m.scope.tags
  const onlyType = (m: Modifier) =>
    m.scope?.damageTypes?.length === 1 && !m.scope.elements && !m.scope.actionIds && !m.scope.tags
  const unscoped = bonuses.filter((m) => !m.scope)
  if (unscoped.length > 0) entries.push(sumEntry('dmgBonus.all', 'DMG Bonus on every hit', 'percent', unscoped.map((m) => toPart(m))))
  for (const element of ELEMENTS) {
    const parts = bonuses.filter((m) => onlyElement(m) && m.scope?.elements?.[0] === element)
    if (parts.length > 0 || element === resonator.element) {
      entries.push(sumEntry(`dmgBonus.${element}`, `${ELEMENT_NAME[element]} DMG Bonus`, 'percent', parts.map((m) => toPart(m))))
    }
  }
  for (const [type, name] of Object.entries(TYPE_NAME) as [DamageType, string][]) {
    const parts = bonuses.filter((m) => onlyType(m) && m.scope?.damageTypes?.[0] === type)
    if (parts.length > 0) entries.push(sumEntry(`dmgBonus.${type}`, `${name} DMG Bonus`, 'percent', parts.map((m) => toPart(m))))
  }
  const conditional = bonuses.filter((m) => m.scope && !onlyElement(m) && !onlyType(m))
  if (conditional.length > 0) {
    entries.push(
      sumEntry(
        'dmgBonus.conditional',
        'DMG Bonus on some hits',
        'percent',
        conditional.map((m) => toPart(m, `${m.source.name} (${scopeWords(m)})`)),
        undefined,
        'Each applies only to the hits named beside it.',
      ),
    )
  }

  for (const { stat, label, unit } of OTHER_STATS) {
    const parts = modifiers.filter((m) => m.stat === stat)
    if (parts.length === 0) continue
    const scopedNote = parts.some((m) => m.scope) ? 'Some of these apply only to the hits named beside them.' : undefined
    entries.push(sumEntry(stat, label, unit, parts.map((m) => toPart(m, m.scope ? `${m.source.name} (${scopeWords(m)})` : m.source.name)), undefined, scopedNote))
  }

  // Enemy terms, for hits with no conditional DEF or RES changes.
  const attackerLevel = build.resonator.level
  const enemyLevel = build.enemy.level
  const enemyDef = enemyDefense(enemyLevel)
  entries.push({
    id: 'enemy.defense',
    label: 'Enemy defence',
    value: defMultiplier(attackerLevel, enemyLevel, sheet.defIgnore.total, sheet.defReduction.total),
    unit: 'multiplier',
    combine: 'formula',
    formula: `(800 + 8 x ${attackerLevel}) / (800 + 8 x ${attackerLevel} + ${enemyDef} enemy DEF)`,
    note: `Your level ${attackerLevel} against a level ${enemyLevel} enemy. Enemy DEF is 8 x level + 792.`,
    parts: [],
    hasUnverified: false,
  })
  for (const element of ELEMENTS) {
    const reduction = modifiers
      .filter((m) => m.stat === 'resReduction' && (!m.scope || onlyElement(m)) && (!m.scope || m.scope.elements?.[0] === element))
      .reduce((total, m) => total + m.value, 0)
    const total = build.enemy.resistance[element] - reduction
    entries.push({
      id: `enemy.resistance.${element}`,
      label: `Enemy resistance (${ELEMENT_NAME[element]})`,
      value: resMultiplier(total),
      unit: 'multiplier',
      combine: 'formula',
      formula: total < 0 ? '1 - RES / 2 (resistance below zero)' : total < 0.8 ? '1 - RES' : '1 / (1 + 5 x RES)',
      note: `Resistance ${Math.round(total * 1000) / 10}% after reductions.`,
      parts: [],
      hasUnverified: false,
    })
  }

  // The rotation total, by action.
  const rotation = simulateRotation(build, catalog)
  entries.push(
    sumEntry(
      'rotation.total',
      'Rotation damage (average)',
      'damage',
      rotation.byAction.map((row) => ({
        label: `${row.label} (${row.count} ${row.count === 1 ? 'time' : 'times'})`,
        value: row.average,
        kind: 'action' as const,
        verified: !rotation.steps.some((step) => step.action.actionId === row.key && step.action.hasUnverified),
      })),
      undefined,
      rotation.uncounted.length > 0 ? `${rotation.uncounted.length} step(s) are not counted: healing or not modelled.` : undefined,
    ),
  )

  return {
    gameVersion: catalog.gameVersion,
    dataDate: catalog.dataDate,
    entries,
    hasUnverified: entries.some((entry) => entry.hasUnverified),
  }
}
