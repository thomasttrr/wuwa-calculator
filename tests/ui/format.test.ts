import { describe, expect, it } from 'vitest'
import { formatDamage, formatPercent, formatStatValue, statLabel } from '../../src/ui/format'

describe('formatting', () => {
  it('damage is a whole number with thousands separators', () => {
    expect(formatDamage(198042.37)).toBe('198,042')
    expect(formatDamage(0)).toBe('0')
  })

  it('percentages take fractions and show one decimal place by default', () => {
    expect(formatPercent(0.928)).toBe('92.8%')
    expect(formatPercent(0.05)).toBe('5.0%')
    expect(formatPercent(1.2345, 2)).toBe('123.45%')
    expect(formatPercent(-0.1)).toBe('-10.0%')
  })

  it('stat values show as the game shows them', () => {
    expect(formatStatValue('atkFlat', 150)).toBe('150')
    expect(formatStatValue('atkPct', 0.116)).toBe('11.6%')
    expect(formatStatValue('critDmg', 0.21)).toBe('21.0%')
    expect(formatStatValue('hpFlat', 2280)).toBe('2,280')
  })

  it('stat labels use the game names, with the scope spelled out', () => {
    expect(statLabel('atkPct')).toBe('ATK%')
    expect(statLabel('dmgBonus', { elements: ['aero'] })).toBe('Aero DMG Bonus')
    expect(statLabel('dmgBonus', { damageTypes: ['liberation'] })).toBe('Resonance Liberation DMG Bonus')
    expect(statLabel('dmgBonus', { elements: ['glacio', 'fusion', 'electro', 'aero', 'spectro', 'havoc'] })).toBe('All-Attribute DMG Bonus')
    expect(statLabel('critRate', { damageTypes: ['heavy'] })).toBe('Crit. Rate (Heavy Attack)')
    expect(statLabel('amplify')).toBe('DMG Amplify')
  })
})
