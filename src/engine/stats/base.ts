import type { Build } from '../types/build'
import type { Catalog } from '../types/catalog'
import type { BaseStats } from '../types/stats'

/**
 * The stats at one level. A level where ascension happens appears twice in the data
 * (before and after); `ascended` picks between them and is ignored elsewhere.
 */
export function findGrowthPoint<T extends { level: number; ascended: boolean }>(
  growth: readonly T[],
  level: number,
  ascended: boolean,
): T {
  const atLevel = growth.filter((point) => point.level === level)
  const point = atLevel.find((candidate) => candidate.ascended === ascended) ?? atLevel[0]
  if (!point) throw new Error(`No stats for level ${level}`)
  return point
}

/** Base ATK, HP and DEF before any percentage: the Resonator's own values plus the weapon's ATK. */
export function resolveBaseStats(build: Build, catalog: Catalog): BaseStats {
  const resonator = catalog.resonators[build.resonator.id]
  if (!resonator) throw new Error(`Unknown Resonator ${build.resonator.id}`)
  const own = findGrowthPoint(resonator.growth, build.resonator.level, build.resonator.ascended)

  const atkParts = [{ name: `${resonator.name} (level ${build.resonator.level})`, value: own.atk }]
  if (build.weapon) {
    const weapon = catalog.weapons[build.weapon.id]
    if (!weapon) throw new Error(`Unknown weapon ${build.weapon.id}`)
    const point = findGrowthPoint(weapon.growth, build.weapon.level, build.weapon.ascended)
    atkParts.push({ name: `${weapon.name} (level ${build.weapon.level})`, value: point.atk })
  }

  return {
    atk: atkParts.reduce((total, part) => total + part.value, 0),
    hp: own.hp,
    def: own.def,
    atkParts,
    hpParts: [{ name: `${resonator.name} (level ${build.resonator.level})`, value: own.hp }],
    defParts: [{ name: `${resonator.name} (level ${build.resonator.level})`, value: own.def }],
    critRate: resonator.baseCritRate,
    critDmg: resonator.baseCritDmg,
    energyRegen: 1,
  }
}
