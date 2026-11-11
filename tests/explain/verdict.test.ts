import { describe, expect, it } from 'vitest'
import { buildVerdict } from '../../src/explain/verdict'
import { computeAnchors } from '../../src/engine/score/score'
import type { Build } from '../../src/engine/types/build'
import { createSampleBuild } from '../../src/data/sample-build'
import { catalog } from '../engine/fixtures/builds'

const sample = createSampleBuild(catalog)
const anchors = computeAnchors(sample, catalog)

describe('buildVerdict', () => {
  it('with no Echoes, says to add Echoes', () => {
    const empty: Build = { ...sample, echoes: [null, null, null, null, null] }
    expect(buildVerdict(empty, catalog, computeAnchors(empty, catalog)).text).toBe('No Echoes equipped yet. Add Echoes to raise this score.')
  })

  it('names Crit. Rate when the build has none from its Echoes', () => {
    const noCrit: Build = {
      ...sample,
      echoes: sample.echoes.map((echo, slot) =>
        echo
          ? {
              ...echo,
              mainStat: slot === 0 ? { stat: 'atkPct', value: 0.33 } : echo.mainStat,
              substats: echo.substats.filter((sub) => sub.stat !== 'critRate'),
            }
          : null,
      ),
    }
    const verdict = buildVerdict(noCrit, catalog, anchors)
    expect(verdict.stat).toBe('Crit. Rate')
    expect(verdict.text).toMatch(/^Held back most by low Crit\. Rate\. Raising it to the reference level adds about \d+(\.\d)?% damage\.$/)
  })

  it('names the stat whose shortfall costs the most, by measuring every one', () => {
    const verdict = buildVerdict(sample, catalog, anchors)
    expect(verdict.gain).toBeGreaterThan(0)
    expect(verdict.text.startsWith(`Held back most by low ${verdict.stat}.`)).toBe(true)
  })

  it('says so when every stat that matters is at or above the reference', () => {
    const generous = { ...anchors, referenceLoadout: { ...anchors.referenceLoadout, vector: new Float64Array(anchors.referenceLoadout.vector.length) } }
    expect(buildVerdict(sample, catalog, generous).text).toBe('Your Echo stats match or beat the reference in every stat that matters for this rotation.')
  })
})
