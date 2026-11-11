// Starting points: the default target, a starting rotation, and a fresh build for any Resonator.
import type { Build, EnemyConfig, Rotation, RotationStep } from '../engine/types/build'
import type { ActionDef, Catalog, ResonatorDef } from '../engine/types/catalog'
import type { Element } from '../engine/types/stats'

const ELEMENTS: Element[] = ['physical', 'glacio', 'fusion', 'electro', 'aero', 'spectro', 'havoc']

/**
 * A level 100 target with 10% resistance to everything. Source: Wuthering Waves Wiki,
 * "Damage": "For most enemies in the game, the base resistance is equal to 0.1 (10%)."
 */
export const DEFAULT_ENEMY: EnemyConfig = {
  name: 'Level 100 target',
  level: 100,
  resistance: Object.fromEntries(ELEMENTS.map((element) => [element, 0.1])) as Record<Element, number>,
}

/** Actions left out of a starting rotation: situational moves a player chooses to add. */
const SITUATIONAL = /mid-air|plunging|dodge|counter|follow-up|healing|shield|per /i

const STAGE = /^(?:Basic Attack )?Stage \d+ DMG$/i
const HEAVY = /^Heavy Attack/i

/**
 * A plain starting rotation: Intro, the Basic Attack stages, Resonance Skill, Heavy Attack, two
 * Forte hits and the Liberation. It is a starting point to edit, not a recommended rotation.
 */
export function startingRotation(resonator: ResonatorDef): Rotation {
  const counted = resonator.actions.filter((action) => action.kind === 'damage' && action.modelled)
  const plain = counted.filter((action) => !SITUATIONAL.test(action.name))
  const of = (type: ActionDef['skillType']) => plain.filter((action) => action.skillType === type)

  const stages = of('normal').filter((action) => STAGE.test(action.name)).slice(0, 5)
  const picked: ActionDef[] = [
    ...of('intro').slice(0, 1),
    ...(stages.length > 0 ? stages : of('normal').slice(0, 1)),
    ...of('skill').slice(0, 1),
    ...of('normal').filter((action) => HEAVY.test(action.name)).slice(0, 1),
    ...of('forte').slice(0, 2),
    ...of('liberation').slice(0, 1),
  ]
  const unique = picked.filter((action, index) => picked.findIndex((other) => other.id === action.id) === index)
  const chosen = unique.length > 0 ? unique : counted.slice(0, 6)

  const items: RotationStep[] = chosen.map((action, index) => ({
    kind: 'step',
    id: `s${index + 1}`,
    actionId: action.id,
    enabled: true,
  }))
  return { id: `rotation-${resonator.id}`, name: `${resonator.name} starting rotation`, items }
}

/** A fresh level 90 build with every skill at 10 and every skill-tree node unlocked, nothing equipped. */
export function defaultBuildFor(resonatorId: number, catalog: Catalog, name?: string): Build {
  const resonator = catalog.resonators[resonatorId]
  if (!resonator) throw new Error(`Unknown Resonator ${resonatorId}`)
  return {
    id: globalThis.crypto.randomUUID(),
    name: name ?? resonator.name,
    resonator: {
      id: resonatorId,
      level: 90,
      ascended: false,
      sequence: 0,
      skillLevels: { normal: 10, skill: 10, forte: 10, liberation: 10, intro: 10 },
      traceNodeIds: resonator.traceNodes.map((node) => node.id),
    },
    weapon: null,
    echoes: [null, null, null, null, null],
    teammates: [null, null],
    effects: {},
    customModifiers: [],
    enemy: DEFAULT_ENEMY,
    rotation: startingRotation(resonator),
  }
}
