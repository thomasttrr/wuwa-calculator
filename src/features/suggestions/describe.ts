// Plain names for a suggested change, for the list and for undo history.
import type { Change } from '../../engine/suggest/change'
import type { Build } from '../../engine/types/build'
import type { Catalog } from '../../engine/types/catalog'
import { formatStatValue, statLabel } from '../../ui/format'

export interface ChangeText {
  title: string
  detail: string
}

/** The words used for undo history and the "Trying" strip, matching how the Build page names the same edit. */
export function changeLabel(change: Change, build: Build, catalog: Catalog): string {
  switch (change.kind) {
    case 'weapon':
      return `Equipped ${catalog.weapons[change.weaponId]?.name ?? 'a weapon'}${change.rank > 1 ? ` at rank ${change.rank}` : ''}`
    case 'mainStat': {
      const echo = build.echoes[change.slot]
      const main = echo ? catalog.echoStats.mainStats[echo.cost][change.option] : undefined
      return `Set Echo ${change.slot + 1} main stat to ${main?.label ?? 'another stat'}`
    }
    case 'set':
      return `Moved every Echo to ${catalog.sonatas[change.sonataId]?.name ?? 'another set'}`
    case 'combo':
      return change.changes.map((part) => changeLabel(part, build, catalog)).join('; ')
  }
}

export function describeChange(change: Change, build: Build, catalog: Catalog): ChangeText {
  switch (change.kind) {
    case 'weapon': {
      const weapon = catalog.weapons[change.weaponId]
      const current = build.weapon ? catalog.weapons[build.weapon.id]?.name : undefined
      return {
        title: weapon?.name ?? 'Weapon',
        detail: `${weapon?.rarity ?? '?'} star, rank ${change.rank}, at your weapon level. ${current ? `Instead of ${current}.` : 'You have no weapon equipped.'}`,
      }
    }
    case 'mainStat': {
      const echo = build.echoes[change.slot]
      const main = echo ? catalog.echoStats.mainStats[echo.cost][change.option] : undefined
      const name = echo ? (catalog.echoes[echo.echoId]?.name ?? 'Echo') : 'Echo'
      return {
        title: `Echo ${change.slot + 1}, ${name}: ${main ? `${main.label} ${formatStatValue(main.stat, main.value)}` : 'main stat'}`,
        detail: echo ? `Main stat instead of ${statLabel(echo.mainStat.stat, echo.mainStat.scope)} ${formatStatValue(echo.mainStat.stat, echo.mainStat.value)}.` : '',
      }
    }
    case 'set': {
      const set = catalog.sonatas[change.sonataId]
      const misfits = build.echoes.filter((e) => e && !catalog.echoes[e.echoId]?.sonataIds.includes(change.sonataId)).length
      return {
        title: `${set?.name ?? 'Set'}, 5 pieces`,
        detail:
          misfits > 0
            ? `Keeps your Echoes' stats. ${misfits} of your Echoes cannot be in this set, so you would need others with the same stats.`
            : "Keeps your Echoes' stats; each of your Echoes can come in this set.",
      }
    }
    case 'combo': {
      const parts = change.changes.map((part) => describeChange(part, build, catalog).title)
      return { title: parts.join(' + '), detail: parts.length === 1 ? 'On its own, with your other choices kept.' : `${parts.length} changes made together.` }
    }
  }
}
