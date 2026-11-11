// The Build Score: how good this build's Echo stats are, on a fixed scale for its own setup.
//   0%   baseline   the build with no Echoes at all
//   100% reference  the same Echoes and sets, best main stats, 3 useful substats each at average rolls
//   200% maximum    the same Echoes and sets, best main stats, 5 useful substats each at maximum rolls
// The percentage is linear between those points and keeps going past them.
import { compileRotation, stripEchoStats } from '../compiled/compile'
import { simulateRotation } from '../rotation/simulate'
import type { Build } from '../types/build'
import type { Catalog } from '../types/catalog'
import { frameCosts, searchIdealLoadout } from './ideal'
import type { IdealLoadout } from './ideal'

export interface Anchors {
  baseline: number
  reference: number
  maximum: number
}

export const GRADE_BANDS = [
  { grade: 'F', from: -Infinity },
  { grade: 'D', from: 25 },
  { grade: 'C', from: 50 },
  { grade: 'B', from: 75 },
  { grade: 'A', from: 100 },
  { grade: 'S', from: 125 },
  { grade: 'SS', from: 150 },
  { grade: 'SSS', from: 175 },
  { grade: 'SSS+', from: 200 },
] as const

export type Grade = (typeof GRADE_BANDS)[number]['grade']

export function percentFor(damage: number, anchors: Anchors): number {
  const { baseline, reference, maximum } = anchors
  if (damage <= reference) return reference > baseline ? ((damage - baseline) / (reference - baseline)) * 100 : 0
  return maximum > reference ? 100 + ((damage - reference) / (maximum - reference)) * 100 : 100
}

export function gradeFor(percent: number): Grade {
  let grade: Grade = 'F'
  for (const band of GRADE_BANDS) if (percent >= band.from) grade = band.grade
  return grade
}

export interface ScoreAnchors extends Anchors {
  referenceLoadout: IdealLoadout
  maximumLoadout: IdealLoadout
}

export interface Score extends ScoreAnchors {
  current: number
  percent: number
  grade: Grade
  /** Same fingerprint means the same setup: scores can be compared. */
  fingerprint: string
  hasUnverified: boolean
}

/** FNV-1a, enough to tell setups apart. */
function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** Everything that decides the anchors: the build without names, ids or Echo stats. */
export function setupFingerprint(build: Build, catalog: Catalog): string {
  const stripped = stripEchoStats(build)
  const setup = {
    patch: catalog.gameVersion,
    resonator: stripped.resonator,
    weapon: stripped.weapon,
    echoes: stripped.echoes.map((echo) => (echo ? { echoId: echo.echoId, cost: echo.cost, sonataId: echo.sonataId } : null)),
    teammates: stripped.teammates,
    effects: Object.entries(stripped.effects).sort(([a], [b]) => a.localeCompare(b)),
    custom: stripped.customModifiers,
    enemy: { level: stripped.enemy.level, resistance: stripped.enemy.resistance },
    rotation: stripped.rotation.items,
  }
  return hash(JSON.stringify(setup))
}

/** Works out the three anchors for a build's setup. The slow part; cached by fingerprint. */
export function computeAnchors(build: Build, catalog: Catalog): ScoreAnchors {
  const baseline = simulateRotation({ ...build, echoes: build.echoes.map(() => null) }, catalog).total.average
  const compiled = compileRotation(stripEchoStats(build), catalog)
  const costs = frameCosts(build.echoes)
  const maximumLoadout = searchIdealLoadout(compiled, costs, catalog.echoStats, { substatsPerEcho: 5, roll: 'max' })
  const referenceLoadout = searchIdealLoadout(compiled, costs, catalog.echoStats, { substatsPerEcho: 3, roll: 'mean' })
  return { baseline, reference: referenceLoadout.damage, maximum: maximumLoadout.damage, referenceLoadout, maximumLoadout }
}

export function scoreBuild(build: Build, catalog: Catalog, cache?: Map<string, ScoreAnchors>): Score {
  const fingerprint = setupFingerprint(build, catalog)
  let anchors = cache?.get(fingerprint)
  if (!anchors) {
    anchors = computeAnchors(build, catalog)
    cache?.set(fingerprint, anchors)
  }
  const result = simulateRotation(build, catalog)
  const percent = percentFor(result.total.average, anchors)
  return {
    ...anchors,
    current: result.total.average,
    percent,
    grade: gradeFor(percent),
    fingerprint,
    hasUnverified: result.hasUnverified,
  }
}
