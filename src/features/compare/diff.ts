// What makes two builds' setups differ. Scores are on each setup's own scale, so they can only
// be compared directly when this list is empty.
import type { Build } from '../../engine/types/build'
import type { Catalog } from '../../engine/types/catalog'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function setupDifferences(a: Build, b: Build, catalog: Catalog): string[] {
  const lines: string[] = []
  const name = (id: number) => catalog.resonators[id]?.name ?? 'Unknown'
  const weapon = (build: Build) =>
    build.weapon ? `${catalog.weapons[build.weapon.id]?.name ?? 'weapon'} rank ${build.weapon.rank}` : 'no weapon'

  if (a.resonator.id !== b.resonator.id) lines.push(`Different Resonators: ${name(a.resonator.id)}, and ${name(b.resonator.id)}.`)
  if (a.resonator.id === b.resonator.id && !same(a.resonator, b.resonator)) lines.push('Different level, Sequence, skill levels or skill tree.')
  if (!same(a.weapon, b.weapon)) lines.push(`Different weapon or refinement: ${weapon(a)}, and ${weapon(b)}.`)
  const frame = (build: Build) => build.echoes.map((echo) => (echo ? [echo.echoId, echo.cost, echo.sonataId] : null))
  if (!same(frame(a), frame(b))) lines.push('Different Echoes or Sonata sets.')
  if (!same(a.teammates, b.teammates)) lines.push('Different team.')
  const sorted = (build: Build) => Object.entries(build.effects).sort(([x], [y]) => x.localeCompare(y))
  if (!same(sorted(a), sorted(b)) || !same(a.customModifiers, b.customModifiers)) lines.push('Different effects switched on.')
  if (!same(a.enemy, b.enemy)) {
    lines.push(`Different target: ${a.enemy.name} at level ${a.enemy.level}, and ${b.enemy.name} at level ${b.enemy.level}.`)
  }
  if (!same(a.rotation.items, b.rotation.items)) lines.push('Different rotation.')
  return lines
}
