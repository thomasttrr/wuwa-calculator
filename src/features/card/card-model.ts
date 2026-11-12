// Everything the exported card says, worked out from the same build, simulation and score the
// app shows. No number here is typed in by hand; the drawing code only lays these out.
import type { Build } from '../../engine/types/build'
import type { Catalog } from '../../engine/types/catalog'
import type { RotationResult } from '../../engine/rotation/simulate'
import type { Grade } from '../../engine/score/score'
import type { BloomEcho } from '../../explain/echo-bloom'
import { bloomEchoes } from '../../explain/echo-bloom'
import type { Settings } from '../../state/types'
import { formatDamage } from '../../ui/format'
import { ELEMENT_NAME } from '../../ui/format'

export interface CardFigure {
  label: string
  value: number
  text: string
}

export interface CardEcho {
  name: string
  cost: number
  main: string
  subs: string[]
}

export interface CardModel {
  buildName: string
  resonatorName: string
  element: string
  level: number
  sequence: number
  weapon: string
  playerName: string
  playerId: string
  scorePercent: string
  grade: Grade | null
  scoreValue: number | null
  damage: number
  damageText: string
  figures: CardFigure[]
  counterText: string
  rotationName: string
  rotationSteps: number
  team: string[]
  setLine: string
  echoes: (CardEcho | null)[]
  bloom: (BloomEcho | null)[]
  marks: string[]
  stamp: string
  disclaimer: string
}

export interface CardScore {
  percent: number
  grade: Grade
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export function cardStamp(catalog: Catalog): string {
  const date = new Date(`${catalog.dataDate}T00:00:00Z`)
  return `Patch ${catalog.gameVersion}, data from ${dateFormatter.format(date)}`
}

/** The most common complete set among the equipped Echoes, or a plain "loose Echoes" line. */
function setLine(build: Build, catalog: Catalog): string {
  const counts = new Map<number, number>()
  for (const echo of build.echoes) {
    if (echo) counts.set(echo.sonataId, (counts.get(echo.sonataId) ?? 0) + 1)
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  if (!best) return 'No Echoes equipped'
  const name = catalog.sonatas[best[0]]?.name ?? 'Echo set'
  return `${best[1]}-piece ${name}`
}

export function buildCardModel(
  build: Build,
  catalog: Catalog,
  simulation: RotationResult,
  score: CardScore | null,
  settings: Pick<Settings, 'playerName' | 'playerId'>,
): CardModel {
  const resonator = catalog.resonators[build.resonator.id]
  const weapon = build.weapon ? catalog.weapons[build.weapon.id] : undefined
  const bloom = bloomEchoes(build, catalog)
  const echoes: (CardEcho | null)[] = bloom.map((echo) =>
    echo
      ? {
          name: echo.name,
          cost: echo.cost,
          main: `${echo.main.label} ${echo.main.valueText}`,
          subs: echo.subs.map((sub) => `${sub.label} ${sub.valueText}`),
        }
      : null,
  )
  const team = build.teammates
    .map((mate) => (mate ? catalog.resonators[mate.resonatorId]?.name : undefined))
    .filter((name): name is string => Boolean(name))
  const marks: string[] = []
  if (resonator?.model === 'basic') marks.push('Basic model')
  if (simulation.hasUnverified) marks.push('Unverified')

  return {
    buildName: build.name,
    resonatorName: resonator?.name ?? 'Resonator',
    element: resonator ? ELEMENT_NAME[resonator.element] : 'Unknown element',
    level: build.resonator.level,
    sequence: build.resonator.sequence,
    weapon: weapon && build.weapon ? `${weapon.name}, rank ${build.weapon.rank}` : 'No weapon',
    playerName: settings.playerName.trim() || 'A theWuthering player',
    playerId: settings.playerId.trim(),
    scorePercent: score ? `${score.percent.toFixed(1)}%` : 'Scoring',
    grade: score?.grade ?? null,
    scoreValue: score?.percent ?? null,
    damage: simulation.total.average,
    damageText: formatDamage(simulation.total.average),
    figures: [
      { label: 'Rotation damage', value: simulation.total.average, text: formatDamage(simulation.total.average) },
      { label: 'If nothing crits', value: simulation.total.nonCrit, text: formatDamage(simulation.total.nonCrit) },
      { label: 'If everything crits', value: simulation.total.crit, text: formatDamage(simulation.total.crit) },
    ],
    counterText: `${simulation.steps.length} counted ${simulation.steps.length === 1 ? 'step' : 'steps'}`,
    rotationName: build.rotation.name,
    rotationSteps: simulation.steps.length,
    team,
    setLine: setLine(build, catalog),
    echoes,
    bloom,
    marks,
    stamp: cardStamp(catalog),
    disclaimer: 'Unofficial fan-made card. Not affiliated with Kuro Games.',
  }
}
