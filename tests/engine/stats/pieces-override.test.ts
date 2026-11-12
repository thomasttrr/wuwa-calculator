import { describe, expect, it } from 'vitest'
import { createSampleBuild } from '../../../src/data/sample-build'
import { compileRotation, echoStatVector, stripEchoStats } from '../../../src/engine/compiled/compile'
import { countSonataPieces } from '../../../src/engine/stats/collect'
import { catalog } from '../fixtures/builds'

const sample = createSampleBuild(catalog)
const setId = sample.echoes[0]!.sonataId

describe('set pieces override (used only by the optimizer to bound its search)', () => {
  it('replaces the counted pieces when present', () => {
    expect(countSonataPieces(sample).get(setId)).toBe(5)
    expect([...countSonataPieces({ ...sample, piecesOverride: { [setId]: 2 } })]).toEqual([[setId, 2]])
  })

  it('changes which set bonuses apply, exactly as real pieces would', () => {
    const v = echoStatVector(sample.echoes)
    const real2 = { ...sample, echoes: sample.echoes.map((e, i) => (e && i >= 2 ? { ...e, sonataId: -1 } : e)) }
    const viaOverride = compileRotation(stripEchoStats({ ...sample, piecesOverride: { [setId]: 2 } }), catalog).evaluate(v)
    const viaEchoes = compileRotation(stripEchoStats(real2), catalog).evaluate(v)
    expect(viaOverride).toBeCloseTo(viaEchoes, 6)
    expect(viaOverride).toBeLessThan(compileRotation(stripEchoStats(sample), catalog).evaluate(v))
  })
})
