import { describe, expect, it } from 'vitest'
import { AUTHORED_EFFECTS } from '../../data/authored/effects'
import { loadCatalog } from '../../scripts/data/load-catalog'
import type { Catalog, EffectDef } from '../../src/engine/types/catalog'

// The integrity rule: never invent a number. Every value in a hand-encoded effect must equal
// the description parameter it cites, as given by the source data.

const catalog = loadCatalog(AUTHORED_EFFECTS)

/** "12.8%" -> 0.128, "5" -> 5. */
function parseParam(text: string): number {
  const number = parseFloat(text)
  return text.trim().endsWith('%') ? Math.round(number * 1e6) / 1e8 : number
}

/** The description parameters an effect's owner has: params[index][rank - 1] (one column if not ranked). */
function ownerParams(effect: EffectDef, data: Catalog): readonly (readonly string[])[] | undefined {
  switch (effect.owner.kind) {
    case 'weapon':
      return data.weapons[effect.owner.id]?.passive.params
    case 'sonata': {
      const owner = effect.owner
      return data.sonatas[owner.id]?.effects.find((e) => e.pieces === owner.pieces)?.params.map((p) => [p])
    }
    case 'resonator': {
      const owner = effect.owner
      if (owner.skillId !== undefined) return []
      if (owner.sequence === undefined) return undefined
      return data.resonators[owner.id]?.sequences.find((s) => s.index === owner.sequence)?.params.map((p) => [p])
    }
    case 'echo':
      return data.echoes[effect.owner.id]?.skill.params.at(-1)?.map((p) => [p])
  }
}

/** The description an effect with no parameters must quote its numbers from. */
function ownerDescription(effect: EffectDef, data: Catalog): string | undefined {
  const owner = effect.owner
  if (owner.kind !== 'resonator' || owner.skillId === undefined) return undefined
  return data.resonators[owner.id]?.skills.find((skill) => skill.id === owner.skillId)?.description
}

/** Every percentage written in a text, as fractions. */
const percentsIn = (text: string): number[] => [...text.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => parseParam(`${m[1]}%`))

describe('hand-encoded effects cite real description parameters', () => {
  it('there is at least one authored effect to check', () => {
    expect(AUTHORED_EFFECTS.length).toBeGreaterThan(0)
  })

  it('effect ids are unique', () => {
    const ids = AUTHORED_EFFECTS.map((effect) => effect.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  for (const effect of AUTHORED_EFFECTS) {
    describe(effect.id, () => {
      const params = ownerParams(effect, catalog)

      it('belongs to something that exists in the catalog', () => {
        expect(params, `no description parameters found for ${effect.id}`).toBeDefined()
      })

      effect.modifiers.forEach((modifier, index) => {
        if (modifier.paramIndex === -1) {
          it(`modifier ${index} (${modifier.stat}) is quoted word for word in the description`, () => {
            const description = ownerDescription(effect, catalog)
            expect(description, 'a literal value needs a skill description to quote from').toBeDefined()
            expect(modifier.values).toHaveLength(1)
            expect(percentsIn(description ?? '')).toContainEqual(modifier.values[0])
          })
          return
        }
        it(`modifier ${index} (${modifier.stat}) equals parameter ${modifier.paramIndex}`, () => {
          const cited = params?.[modifier.paramIndex]
          expect(cited, `parameter ${modifier.paramIndex} does not exist`).toBeDefined()
          expect(modifier.values).toHaveLength(cited?.length ?? -1)
          modifier.values.forEach((value, rank) => {
            expect(value, `rank ${rank + 1}: source says "${cited?.[rank]}"`).toBeCloseTo(parseParam(cited?.[rank] ?? ''), 9)
          })
        })
      })

      if (effect.control.kind === 'stacks' && effect.control.maxParamIndex !== undefined) {
        const control = effect.control
        it('its stack limit equals the parameter it cites', () => {
          const cited = params?.[control.maxParamIndex ?? -1]
          expect(cited?.every((text) => parseParam(text) === control.max)).toBe(true)
        })
      }
    })
  }
})
