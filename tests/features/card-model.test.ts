import { describe, expect, it } from 'vitest'
import { simulateRotation } from '../../src/engine/rotation/simulate'
import { createSampleBuild } from '../../src/data/sample-build'
import { buildCardModel, cardStamp } from '../../src/features/card/card-model'
import { formatDamage } from '../../src/ui/format'
import { catalog } from '../engine/fixtures/builds'

// The card is a second view of the same build. No number on it is typed in by hand: this checks
// the layout model carries the engine's real score, damage and Echo data.

const build = createSampleBuild(catalog)
const simulation = simulateRotation(build, catalog)
const settings = { playerName: 'Rover', playerId: '100000001' }

describe('card model', () => {
  it('uses the simulation total, not a rounded copy', () => {
    const model = buildCardModel(build, catalog, simulation, { percent: 123.4, grade: 'A' }, settings)
    expect(model.damage).toBe(simulation.total.average)
    expect(model.damageText).toBe(formatDamage(simulation.total.average))
    expect(model.figures.map((figure) => figure.value)).toEqual([simulation.total.average, simulation.total.nonCrit, simulation.total.crit])
    expect(model.counterText).toBe(`${simulation.steps.length} counted ${simulation.steps.length === 1 ? 'step' : 'steps'}`)
  })

  it('shows the score, grade and player exactly as given', () => {
    const model = buildCardModel(build, catalog, simulation, { percent: 123.4, grade: 'A' }, settings)
    expect(model.scorePercent).toBe('123.4%')
    expect(model.grade).toBe('A')
    expect(model.scoreValue).toBe(123.4)
    expect(model.playerName).toBe('Rover')
    expect(model.playerId).toBe('100000001')
    expect(model.resonatorName).toBe('Jiyan')
    expect(model.element).toBe('Aero')
    expect(model.level).toBe(90)
    expect(model.weapon).toBe('Verdant Summit, rank 1')
  })

  it('carries every equipped Echo and the set line', () => {
    const model = buildCardModel(build, catalog, simulation, null, settings)
    expect(model.echoes).toHaveLength(5)
    expect(model.echoes.every((echo) => echo !== null)).toBe(true)
    expect(model.echoes[0]?.name).toBe('Feilian Beringal')
    expect(model.echoes[0]?.cost).toBe(4)
    expect(model.echoes[0]?.subs.length).toBeGreaterThan(0)
    expect(model.setLine).toBe('5-piece Sierra Gale')
  })

  it('says so plainly while the score is still being worked out', () => {
    const model = buildCardModel(build, catalog, simulation, null, { playerName: '  ', playerId: '' })
    expect(model.scorePercent).toBe('Scoring')
    expect(model.grade).toBeNull()
    expect(model.scoreValue).toBeNull()
    expect(model.playerName).toBe('A theWuthering player')
    expect(model.playerId).toBe('')
  })

  it('stamps the patch and data date, and names the unofficial nature', () => {
    const model = buildCardModel(build, catalog, simulation, null, settings)
    expect(model.stamp).toBe(cardStamp(catalog))
    expect(model.stamp).toMatch(/^Patch .*data from /)
    expect(model.disclaimer).toMatch(/Unofficial fan-made card/)
  })
})
