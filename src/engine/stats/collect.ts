import type { Build, EffectStates } from '../types/build'
import type { Catalog, EffectDef } from '../types/catalog'
import type { Modifier } from '../types/stats'
import { findGrowthPoint } from './base'

/** How many different Echoes of each Sonata set are equipped. The same Echo twice counts once. */
export function countSonataPieces(build: Build): Map<number, number> {
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

/** Active stack count of an effect: 0 when off, 1 for a plain toggle or an always-on effect. */
export function activeStacks(effect: EffectDef, states: EffectStates): number {
  const state = states[effect.id]
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

  // Hand-encoded effects: weapon passives, set effects, Sequence nodes, Resonator mechanics.
  const rank = build.weapon?.rank ?? 1
  for (const effect of catalog.effects) {
    if (effect.target === 'nextResonator') continue // benefits whoever comes in next, not this Resonator
    if (!ownsEffect(effect, build, pieces)) continue
    const stacks = activeStacks(effect, effectStates)
    if (stacks === 0) continue
    for (const modifier of effect.modifiers) {
      const perRank = effect.owner.kind === 'weapon' && modifier.values.length === 5
      const value = (perRank ? modifier.values[rank - 1] : modifier.values[0]) ?? 0
      modifiers.push({
        stat: modifier.stat,
        value: modifier.perStack ? value * stacks : value,
        scope: modifier.scope,
        source: {
          kind:
            effect.owner.kind === 'weapon'
              ? 'weaponPassive'
              : effect.owner.kind === 'sonata'
                ? 'sonata'
                : effect.owner.kind === 'echo'
                  ? 'echoEffect'
                  : effect.owner.sequence
                    ? 'sequence'
                    : 'resonatorEffect',
          id: effect.id,
          name: modifier.perStack && stacks > 1 ? `${effect.name} (${stacks} stacks)` : effect.name,
          verified: effect.provenance.verified,
        },
      })
    }
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
