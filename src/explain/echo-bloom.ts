// Data for the Echo bloom (DESIGN.md, "The signature"): every substat of every equipped Echo,
// with its roll tier, a colour group, and whether it adds any damage to this rotation.
import { compileRotation, echoStatIndex, echoStatVector, stripEchoStats } from '../engine/compiled/compile'
import type { Build } from '../engine/types/build'
import type { Catalog } from '../engine/types/catalog'
import type { Scope, StatKey } from '../engine/types/stats'
import { formatStatValue, statLabel } from '../ui/format'

export type SubstatTone = 'critRate' | 'critDmg' | 'atk' | 'energyRegen' | 'bonus' | 'hp' | 'def' | 'other'

export interface BloomSubstat {
  label: string
  valueText: string
  tone: SubstatTone
  /** 1 is the lowest possible roll, `tiers` the highest. */
  tier: number
  tiers: number
  /** False when taking this substat away leaves the rotation's damage unchanged. */
  addsDamage: boolean
}

export interface BloomEcho {
  name: string
  cost: number
  main: { label: string; valueText: string; tone: SubstatTone }
  subs: BloomSubstat[]
}

type SubstatRow = Catalog['echoStats']['substats'][number]

export function substatTone(stat: StatKey): SubstatTone {
  switch (stat) {
    case 'critRate':
      return 'critRate'
    case 'critDmg':
      return 'critDmg'
    case 'atkPct':
    case 'atkFlat':
      return 'atk'
    case 'energyRegen':
      return 'energyRegen'
    case 'dmgBonus':
      return 'bonus'
    case 'hpPct':
    case 'hpFlat':
      return 'hp'
    case 'defPct':
    case 'defFlat':
      return 'def'
    default:
      return 'other'
  }
}

/** Which of a stat's possible rolls this value is, counting from 1. */
export function rollTier(row: Pick<SubstatRow, 'rolls'>, value: number): { tier: number; tiers: number } {
  let best = 0
  row.rolls.forEach((roll, i) => {
    if (Math.abs(roll - value) < Math.abs((row.rolls[best] ?? 0) - value)) best = i
  })
  return { tier: best + 1, tiers: row.rolls.length }
}

const sameScope = (a?: Scope, b?: Scope) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const NO_CHANGE = 1e-9

export function bloomEchoes(build: Build, catalog: Catalog): (BloomEcho | null)[] {
  const compiled = compileRotation(stripEchoStats(build), catalog)
  const current = echoStatVector(build.echoes)
  const now = compiled.evaluate(current)

  return build.echoes.map((echo) => {
    if (!echo) return null
    const def = catalog.echoes[echo.echoId]
    return {
      name: def?.name ?? 'Echo',
      cost: echo.cost,
      main: {
        label: statLabel(echo.mainStat.stat, echo.mainStat.scope),
        valueText: formatStatValue(echo.mainStat.stat, echo.mainStat.value),
        tone: substatTone(echo.mainStat.stat),
      },
      subs: echo.substats.map((sub) => {
        const row = catalog.echoStats.substats.find((r) => r.stat === sub.stat && sameScope(r.scope, sub.scope))
        const without = Float64Array.from(current)
        const slot = echoStatIndex(sub.stat, sub.scope)
        without[slot] = (without[slot] ?? 0) - sub.value
        const change = now > 0 ? Math.abs(now - compiled.evaluate(without)) / now : 0
        return {
          label: row?.label ?? statLabel(sub.stat, sub.scope),
          valueText: formatStatValue(sub.stat, sub.value),
          tone: substatTone(sub.stat),
          ...(row ? rollTier(row, sub.value) : { tier: 1, tiers: 1 }),
          addsDamage: change > NO_CHANGE,
        }
      }),
    }
  })
}
