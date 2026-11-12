import type { Build, EffectStates } from '../types/build'
import type { Catalog, EffectDef } from '../types/catalog'
import type { Modifier, SourceKind } from '../types/stats'
import { findGrowthPoint } from './base'

/** How many different Echoes of each Sonata set are equipped. The same Echo twice counts once. */
export function countSonataPieces(build: Build): Map<number, number> {
  if (build.piecesOverride) return new Map(Object.entries(build.piecesOverride).map(([id, count]) => [Number(id), count]))
  const distinct = new Map<number, Set<number>>()
  for (const echo of build.echoes) {
    if (!echo) continue
    const set = distinct.get(echo.sonataId) ?? new Set<number>()
    set.add(echo.echoId)
    distinct.set(echo.sonataId, set)
  }
  return new Map([...distinct].map(([sonataId, echoIds]) => [sonataId, echoIds.size]))
}

/** Does this build own the thing that grants the effect? */
export function ownsEffect(effect: EffectDef, build: Build, pieces: Map<number, number>): boolean {
  const owner = effect.owner
  switch (owner.kind) {
    case 'resonator':
      return owner.id === build.resonator.id && (owner.sequence ?? 0) <= build.resonator.sequence
    case 'weapon':
      return build.weapon?.id === owner.id
    case 'sonata':
      return (pieces.get(owner.id) ?? 0) >= owner.pieces
    case 'echo':
      return build.echoes[0]?.echoId === owner.id
  }
}

/** The effect-state key for a teammate's effect, so it can be switched apart from the build's own. */
export function teammateEffectKey(slot: number, effectId: string): string {
  return `teammate${slot}:${effectId}`
}

/** An effect that reaches this build, with the key its on/off state is stored under. */
export interface OwnedEffect {
  effect: EffectDef
  key: string
  /** Weapon refinement rank for weapon effects. */
  rank: number
  /** "self", or the teammate slot (0 or 1). */
  holder: 'self' | number
  /** Name shown in breakdowns: the effect, prefixed by the teammate's name when it is theirs. */
  label: string
}

/** Does this teammate own the thing that grants the effect? */
function teammateOwns(effect: EffectDef, teammate: NonNullable<Build['teammates'][number]>): boolean {
  const owner = effect.owner
  switch (owner.kind) {
    case 'resonator':
      return owner.id === teammate.resonatorId && (owner.sequence ?? 0) <= teammate.sequence
    case 'weapon':
      return teammate.weaponId === owner.id
    case 'sonata':
      return teammate.sonatas.some(([id, pieces]) => id === owner.id && pieces >= owner.pieces)
    case 'echo':
      return false
  }
}

/** Every effect that reaches the active Resonator: its own (except "next Resonator" ones) and its teammates' shared ones. */
export function ownedEffects(build: Build, catalog: Catalog): OwnedEffect[] {
  const pieces = countSonataPieces(build)
  const owned: OwnedEffect[] = []
  for (const effect of catalog.effects) {
    if (effect.target !== 'nextResonator' && ownsEffect(effect, build, pieces)) {
      owned.push({ effect, key: effect.id, rank: build.weapon?.rank ?? 1, holder: 'self', label: effect.name })
    }
  }
  build.teammates.forEach((teammate, slot) => {
    if (!teammate) return
    const name = catalog.resonators[teammate.resonatorId]?.name ?? 'Teammate'
    for (const effect of catalog.effects) {
      if (effect.target === 'self' || !teammateOwns(effect, teammate)) continue
      owned.push({
        effect,
        key: teammateEffectKey(slot, effect.id),
        rank: teammate.weaponRank ?? 1,
        holder: slot,
        // Effects read from a Resonator's own skills already start with its name.
        label: effect.name.startsWith(name) ? effect.name : `${name}: ${effect.name}`,
      })
    }
  })
  return owned
}

/** Active stack count of an effect: 0 when off, 1 for a plain toggle or an always-on effect. */
export function activeStacks(effect: EffectDef, states: EffectStates, key: string = effect.id): number {
  const state = states[key]
  switch (effect.control.kind) {
    case 'always':
      return 1
    case 'toggle':
      return (state?.on ?? effect.control.default) ? 1 : 0
    case 'stacks': {
      if (state && !state.on) return 0
      const stacks = state?.stacks ?? effect.control.default
      return Math.min(Math.max(stacks, 0), effect.control.max)
    }
  }
}

/** The modifiers an owned effect grants in its current state (none when switched off). */
export function effectModifiers(owned: OwnedEffect, states: EffectStates): Modifier[] {
  const { effect, rank, label } = owned
  const stacks = activeStacks(effect, states, owned.key)
  if (stacks === 0) return []
  const kind: SourceKind =
    owned.holder !== 'self'
      ? 'teammate'
      : effect.owner.kind === 'weapon'
        ? 'weaponPassive'
        : effect.owner.kind === 'sonata'
          ? 'sonata'
          : effect.owner.kind === 'echo'
            ? 'echoEffect'
            : effect.owner.sequence
              ? 'sequence'
              : 'resonatorEffect'
  return effect.modifiers.map((modifier) => {
    const perRank = effect.owner.kind === 'weapon' && modifier.values.length === 5
    const value = (perRank ? modifier.values[rank - 1] : modifier.values[0]) ?? 0
    return {
      stat: modifier.stat,
      value: modifier.perStack ? value * stacks : value,
      scope: modifier.scope,
      source: {
        kind,
        id: owned.key,
        name: modifier.perStack && stacks > 1 ? `${label} (${stacks} stacks)` : label,
        verified: effect.provenance.verified,
      },
    }
  })
}

/**
 * Every contribution to every stat for this build, each with the name of what granted it.
 * `effectStates` replaces the build's own effect switches (the rotation uses this per step).
 */
export function collectModifiers(build: Build, catalog: Catalog, effectStates: EffectStates = build.effects): Modifier[] {
  const modifiers: Modifier[] = []
  const resonator = catalog.resonators[build.resonator.id]
  if (!resonator) throw new Error(`Unknown Resonator ${build.resonator.id}`)

  // Skill tree stat nodes.
  for (const node of resonator.traceNodes) {
    if (!build.resonator.traceNodeIds.includes(node.id)) continue
    modifiers.push({
      stat: node.stat,
      value: node.value,
      scope: node.scope,
      source: { kind: 'trace', id: node.id, name: `Skill tree: ${node.label}`, verified: resonator.provenance.verified },
    })
  }

  // Weapon secondary stat.
  if (build.weapon) {
    const weapon = catalog.weapons[build.weapon.id]
    if (!weapon) throw new Error(`Unknown weapon ${build.weapon.id}`)
    const point = findGrowthPoint(weapon.growth, build.weapon.level, build.weapon.ascended)
    modifiers.push({
      stat: weapon.secondaryStat,
      value: point.secondary,
      source: { kind: 'weapon', id: weapon.id, name: `${weapon.name} (secondary stat)`, verified: weapon.provenance.verified },
    })
  }

  // Echo main stats, fixed stats and substats.
  build.echoes.forEach((echo, slot) => {
    if (!echo) return
    const name = catalog.echoes[echo.echoId]?.name ?? `Echo ${slot + 1}`
    modifiers.push({
      stat: echo.mainStat.stat,
      value: echo.mainStat.value,
      scope: echo.mainStat.scope,
      source: { kind: 'echoMain', id: echo.uid, name: `${name} (main stat)` },
    })
    modifiers.push({
      stat: echo.fixedStat.stat,
      value: echo.fixedStat.value,
      source: { kind: 'echoFixed', id: echo.uid, name: `${name} (fixed stat)` },
    })
    for (const substat of echo.substats) {
      modifiers.push({
        stat: substat.stat,
        value: substat.value,
        scope: substat.scope,
        source: { kind: 'echoSub', id: echo.uid, name: `${name} (substat)` },
      })
    }
  })

  // Plain set bonuses the game stores as structured data.
  const pieces = countSonataPieces(build)
  for (const [sonataId, count] of pieces) {
    const sonata = catalog.sonatas[sonataId]
    if (!sonata) continue
    for (const effect of sonata.effects) {
      if (count < effect.pieces) continue
      for (const fixed of effect.fixed) {
        modifiers.push({
          stat: fixed.stat,
          value: fixed.value,
          scope: fixed.scope,
          source: { kind: 'sonata', id: sonataId, name: `${sonata.name} (${effect.pieces} pieces)` },
        })
      }
    }
  }

  // Hand-encoded effects: weapon passives, set effects, Sequence nodes, Resonator mechanics,
  // and teammates' shared buffs.
  for (const owned of ownedEffects(build, catalog)) {
    modifiers.push(...effectModifiers(owned, effectStates))
  }

  // Modifiers the user typed in.
  for (const custom of build.customModifiers) {
    if (!custom.on) continue
    modifiers.push({
      stat: custom.stat,
      value: custom.value,
      scope: custom.scope,
      source: { kind: 'custom', id: custom.id, name: custom.label },
    })
  }

  return modifiers
}
