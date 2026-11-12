// A change Suggestions can propose, and the pure function that makes it.
import type { Build, EchoInstance, EffectStates } from '../types/build'
import type { Catalog, EffectDef } from '../types/catalog'
import type { Scope } from '../types/stats'

export type Change =
  | { kind: 'weapon'; weaponId: number; rank: number }
  /** `option` indexes `catalog.echoStats.mainStats[cost]` for that slot's Echo. */
  | { kind: 'mainStat'; slot: number; option: number }
  /** Every equipped Echo moved into this Sonata set, keeping its stats. */
  | { kind: 'set'; sonataId: number }
  | { kind: 'combo'; changes: readonly Change[] }

export interface SuggestOptions {
  /** Switch the suggested weapon's or set's own effects fully on, instead of their default state. */
  assumeConditionsMet?: boolean
  /** When given, weapons are limited to these. */
  ownedWeaponIds?: readonly number[] | null
}

export function changeKey(change: Change): string {
  switch (change.kind) {
    case 'weapon':
      return `weapon:${change.weaponId}:${change.rank}`
    case 'mainStat':
      return `main:${change.slot}:${change.option}`
    case 'set':
      return `set:${change.sonataId}`
    case 'combo':
      return change.changes.map(changeKey).join('+')
  }
}

const sameScope = (a?: Scope, b?: Scope) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** Which row of the main stat table an Echo's main stat is, or -1. */
export function mainStatOption(echo: EchoInstance, catalog: Catalog): number {
  return catalog.echoStats.mainStats[echo.cost].findIndex((main) => main.stat === echo.mainStat.stat && sameScope(main.scope, echo.mainStat.scope))
}

function switchedOn(effects: EffectStates, owned: readonly EffectDef[]): EffectStates {
  const next: Record<string, { on: boolean; stacks?: number }> = { ...effects }
  for (const effect of owned) {
    if (effect.control.kind === 'toggle') next[effect.id] = { on: true }
    else if (effect.control.kind === 'stacks') next[effect.id] = { on: true, stacks: effect.control.max }
  }
  return next
}

export function applyChange(build: Build, change: Change, catalog: Catalog, options: SuggestOptions = {}): Build {
  switch (change.kind) {
    case 'weapon': {
      const next: Build = {
        ...build,
        weapon: { id: change.weaponId, level: build.weapon?.level ?? 90, ascended: build.weapon?.ascended ?? false, rank: change.rank },
      }
      if (!options.assumeConditionsMet) return next
      const owned = catalog.effects.filter((e) => e.owner.kind === 'weapon' && e.owner.id === change.weaponId)
      return { ...next, effects: switchedOn(build.effects, owned) }
    }
    case 'mainStat': {
      const echo = build.echoes[change.slot]
      const main = echo ? catalog.echoStats.mainStats[echo.cost][change.option] : undefined
      if (!echo || !main) throw new Error(`No main stat ${change.option} for slot ${change.slot}`)
      const echoes = build.echoes.map((e, slot) =>
        e && slot === change.slot ? { ...e, mainStat: { stat: main.stat, ...(main.scope ? { scope: main.scope } : {}), value: main.value } } : e,
      )
      return { ...build, echoes }
    }
    case 'set': {
      const next: Build = { ...build, echoes: build.echoes.map((e) => (e ? { ...e, sonataId: change.sonataId } : e)) }
      if (!options.assumeConditionsMet) return next
      const owned = catalog.effects.filter((e) => e.owner.kind === 'sonata' && e.owner.id === change.sonataId)
      return { ...next, effects: switchedOn(build.effects, owned) }
    }
    case 'combo':
      return change.changes.reduce((current, part) => applyChange(current, part, catalog, options), build)
  }
}
