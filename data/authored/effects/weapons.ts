// Hand-encoded weapon passives.
// Every number here is read from the weapon's description parameters in the catalog
// (WeaponDef.passive.params[paramIndex][rank - 1]). tests/data/provenance.test.ts fails
// if a value below does not match the parameter it cites.
import type { EffectDef } from '../../../src/engine/types/catalog'

export const WEAPON_EFFECTS: readonly EffectDef[] = [
  {
    id: 'weapon:21010074:edge-direction',
    owner: { kind: 'weapon', id: 21010074 },
    name: 'Edge Direction',
    target: 'self',
    control: { kind: 'stacks', max: 5, default: 0, maxParamIndex: 1 },
    modifiers: [{ stat: 'atkPct', values: [0.04, 0.062, 0.084, 0.106, 0.128], perStack: true, paramIndex: 0 }],
    condition: 'Gains a stack when dealing Basic Attack or Heavy Attack damage. Up to 5 stacks.',
    provenance: { source: 'authored', sourceId: 'weapons.json#21010074.passive', verified: true },
  },
  {
    id: 'weapon:21020044:unyielding',
    owner: { kind: 'weapon', id: 21020044 },
    name: 'Unyielding',
    target: 'self',
    control: { kind: 'toggle', default: false },
    modifiers: [{ stat: 'atkPct', values: [0.15, 0.1875, 0.225, 0.2625, 0.3], paramIndex: 0 }],
    condition: 'Active for 15 seconds after the Intro Skill is cast.',
    provenance: { source: 'authored', sourceId: 'weapons.json#21020044.passive', verified: true },
  },
]
