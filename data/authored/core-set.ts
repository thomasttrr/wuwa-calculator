// The Resonators whose mechanics are hand-encoded in v1 ("full" model). Everyone else is
// listed with real stats and multipliers as a "basic" model.
//
// Chosen at the end of Phase 0 (11 Nov 2026) by one rule: every damage value in the
// Resonator's kit must be computable from a public formula and agree across both data
// sources (0 not modelled, 0 unverified in data/game/3.8.0). Elements: Aero 2, Fusion 2,
// Electro 2, Spectro 3, Glacio 2, Havoc 1.
//
// Left out of the plan's first list, with the reason from the data:
//   Jinhsi      main hit "Stella Glamor" uses an undocumented special formula
//   Camellya    17 of 20 damage values use an undocumented special formula
//   Carlotta    3 key hits (Skill, Death Knell, Fatal Finale) use one too
//   Zani        7 values unmatched or special; relies on Spectro Frazzle, which has no full public formula
//   Taoqi       8 values have no matching damage entry in the game data
//   Cartethyia  4 hits carry the Glacio Chafe negative-status type, which has no public formula
// Jinhsi and Taoqi stay as hand-checked engine test cases; those tests use hits that are fully verified.

export const CORE_RESONATORS = [
  { id: 1402, name: 'Yangyang' },
  { id: 1404, name: 'Jiyan' },
  { id: 1205, name: 'Changli' },
  { id: 1203, name: 'Encore' },
  { id: 1305, name: 'Xiangli Yao' },
  { id: 1301, name: 'Calcharo' },
  { id: 1506, name: 'Phoebe' },
  { id: 1505, name: 'Shorekeeper' },
  { id: 1503, name: 'Verina' },
  { id: 1105, name: 'Zhezhi' },
  { id: 1606, name: 'Roccia' },
  { id: 1102, name: 'Sanhua' },
] as const

export const CORE_RESONATOR_IDS: readonly number[] = CORE_RESONATORS.map((resonator) => resonator.id)
