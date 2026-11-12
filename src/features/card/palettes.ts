// Card palettes are scoped to the exported image (DESIGN.md, "The Card tool is the one
// exception"). They still obey the no-yellow, no-purple rule, and the card test checks contrast.
import type { SubstatTone } from '../../explain/echo-bloom'

export interface CardPalette {
  id: 'calm' | 'bold' | 'minimal'
  name: string
  page: string
  panel: string
  raised: string
  rule: string
  ink: string
  ink2: string
  ink3: string
  signal: string
  onSignal: string
  tones: Record<SubstatTone, string>
  unused: string
}

const TONES: Record<SubstatTone, string> = {
  critRate: '#FF7F66',
  critDmg: '#FF5C8A',
  atk: '#3FD49B',
  energyRegen: '#6CB8FF',
  bonus: '#A6EAF2',
  hp: '#F2A98A',
  def: '#93AACB',
  other: '#A2B4C6',
}

export const CARD_PALETTES: readonly CardPalette[] = [
  {
    id: 'calm',
    name: 'Calm',
    page: '#111B26',
    panel: '#172433',
    raised: '#1E2E40',
    rule: '#2A3B50',
    ink: '#EAF0F5',
    ink2: '#C6D3DF',
    ink3: '#A2B4C6',
    signal: '#3FD49B',
    onSignal: '#0A2A1E',
    tones: TONES,
    unused: '#45556A',
  },
  {
    id: 'bold',
    name: 'Bold',
    page: '#1A1214',
    panel: '#261719',
    raised: '#332023',
    rule: '#4A3135',
    ink: '#F6ECE9',
    ink2: '#DCCAC5',
    ink3: '#C0ACA8',
    signal: '#FF7F66',
    onSignal: '#2A0D08',
    tones: TONES,
    unused: '#5B4A4D',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    page: '#0B1118',
    panel: '#111A23',
    raised: '#17232E',
    rule: '#2A3947',
    ink: '#F1F5F8',
    ink2: '#D2DCE5',
    ink3: '#AEBBC8',
    signal: '#A6EAF2',
    onSignal: '#082229',
    tones: TONES,
    unused: '#45556A',
  },
]

export function paletteById(id: CardPalette['id']): CardPalette {
  return CARD_PALETTES.find((palette) => palette.id === id) ?? CARD_PALETTES[0]!
}
