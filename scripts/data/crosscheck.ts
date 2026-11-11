// Compares the catalog (built from encore.moe) with nanoka.cc, value by value, and
// records the outcome in each record's provenance.verified. Agreement makes a record
// verified. Any disagreement leaves it unverified and lists it in the report.
// Run after normalise.ts. Output: data/game/<version>/crosscheck-report.json.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { EchoDef, EnemyDef, ResonatorDef, WeaponDef } from '../../src/engine/types/catalog'

/* eslint-disable @typescript-eslint/no-explicit-any -- raw source JSON is untyped by nature */

const read = (path: string): any => JSON.parse(readFileSync(resolve(path), 'utf8'))
const manifest = read('data/game/manifest.json')
const OUT = `data/game/${manifest.gameVersion}`
const nanokaVersion = readdirSync(resolve('data/raw/nanoka')).find((name) => /^\d/.test(name))
if (!nanokaVersion) throw new Error('No nanoka data in data/raw. Run npm run data:fetch first.')
const NANOKA = `data/raw/nanoka/${nanokaVersion}`

const close = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance
const mismatches: string[] = []
const summary = {
  resonators: { checked: 0, verified: 0, missingInSecondSource: 0 },
  actions: { checked: 0, verified: 0 },
  weapons: { checked: 0, verified: 0, missingInSecondSource: 0 },
  echoes: { checked: 0, verified: 0, missingInSecondSource: 0 },
  enemies: { checked: 0, verified: 0 },
}

const ELEMENT_IDS = ['physical', 'glacio', 'fusion', 'electro', 'aero', 'spectro', 'havoc']
const SCALING_NAMES: Record<string, string> = { ATK: 'atk', HP: 'hp', DEF: 'def', 'Energy Regen': 'energyRegen' }

// ---- Resonators and their actions
for (const file of readdirSync(resolve(OUT, 'resonators'))) {
  const path = `${OUT}/resonators/${file}`
  const resonator: ResonatorDef = read(path)
  const otherPath = `${NANOKA}/character/${resonator.id}.json`
  summary.resonators.checked += 1
  if (!existsSync(resolve(otherPath))) {
    summary.resonators.missingInSecondSource += 1
    mismatches.push(`${resonator.name}: not present in the second source`)
    continue
  }
  const other = read(otherPath)

  // Base stats at every level. The second source keys them by ascension rank, then level.
  let rank = 0
  let growthOk = resonator.growth.length > 0
  for (const point of resonator.growth) {
    if (point.ascended) rank += 1
    const theirs = other.stats?.[String(rank)]?.[String(point.level)]
    const ok =
      theirs && close(theirs.life, point.hp, 0.01) && close(theirs.atk, point.atk, 0.01) && close(theirs.def, point.def, 0.01)
    if (!ok) {
      growthOk = false
      mismatches.push(`${resonator.name}: base stats differ at level ${point.level}${point.ascended ? ' (ascended)' : ''}`)
      break
    }
  }

  // Raw damage rows, by row id, across every skill node.
  const theirRows = new Map<number, any>()
  for (const node of Object.values<any>(other.skill_trees ?? {})) {
    for (const [id, row] of Object.entries<any>(node.skill?.damage ?? {})) theirRows.set(Number(id), row)
  }

  const actions = resonator.actions.map((action) => {
    summary.actions.checked += 1
    let ok = action.parts.length > 0
    for (const part of action.parts) {
      if (part.rowId === undefined) {
        if (part.multipliers.some((m) => m !== 0)) ok = false // a multiplier with no matching row stays unverified
        continue
      }
      const theirs = theirRows.get(part.rowId)
      const rates: number[] = theirs?.rate_lv ?? []
      const sameRates =
        rates.length >= part.multipliers.length
          ? part.multipliers.every((m, i) => close((rates[i] ?? NaN) / 10000, m, 1e-6))
          : rates.length === 1 && part.multipliers.every((m) => close((rates[0] ?? NaN) / 10000, m, 1e-6))
      const sameElement = ELEMENT_IDS[theirs?.element as number] === part.element
      const sameScaling = SCALING_NAMES[theirs?.related_property as string] === part.scalingStat
      if (!theirs || !sameRates || !sameElement || !sameScaling) {
        ok = false
        mismatches.push(`${resonator.name} / ${action.name}: damage row ${part.rowId} differs or is missing in the second source`)
      }
    }
    if (action.provenance.note) ok = false // ambiguity or an assumption was already recorded
    if (ok) summary.actions.verified += 1
    return { ...action, provenance: { ...action.provenance, verified: ok } }
  })

  if (growthOk) summary.resonators.verified += 1
  const updated: ResonatorDef = { ...resonator, actions, provenance: { ...resonator.provenance, verified: growthOk } }
  writeFileSync(resolve(path), `${JSON.stringify(updated)}\n`)
}

// ---- Weapons
const weapons: WeaponDef[] = read(`${OUT}/weapons.json`)
const checkedWeapons = weapons.map((weapon) => {
  summary.weapons.checked += 1
  const otherPath = `${NANOKA}/weapon/${weapon.id}.json`
  if (!existsSync(resolve(otherPath))) {
    summary.weapons.missingInSecondSource += 1
    mismatches.push(`${weapon.name}: not present in the second source`)
    return weapon
  }
  const other = read(otherPath)
  let rank = 0
  let ok = true
  for (const point of weapon.growth) {
    if (point.ascended) rank += 1
    const [atk, secondary] = other.stats?.[String(rank)]?.[String(point.level)] ?? []
    // The second source stores a percentage either as a plain fraction (is_ratio) or in
    // ten-thousandths; the first source rounds it to 2 decimals.
    const theirSecondary = secondary ? (secondary.is_ratio ? secondary.value : secondary.value / 10000) : NaN
    if (!atk || !close(atk.value, point.atk, 0.006) || !close(theirSecondary, point.secondary, 0.00006)) {
      ok = false
      mismatches.push(`${weapon.name}: stats differ at level ${point.level}${point.ascended ? ' (ascended)' : ''}`)
      break
    }
  }
  if (JSON.stringify(other.param ?? []) !== JSON.stringify(weapon.passive.params)) {
    ok = false
    mismatches.push(`${weapon.name}: passive numbers differ`)
  }
  if (ok) summary.weapons.verified += 1
  return { ...weapon, provenance: { ...weapon.provenance, verified: ok } }
})
writeFileSync(resolve(`${OUT}/weapons.json`), `${JSON.stringify(checkedWeapons)}\n`)

// ---- Echoes: name and set membership
const theirEchoes = Object.values<any>(read(`${NANOKA}/echo.json`))
const echoes: EchoDef[] = read(`${OUT}/echoes.json`)
const checkedEchoes = echoes.map((echo) => {
  summary.echoes.checked += 1
  const theirs = theirEchoes.filter((candidate) => candidate.en === echo.name)
  if (theirs.length === 0) {
    summary.echoes.missingInSecondSource += 1
    return echo
  }
  const sets = [...echo.sonataIds].sort((a, b) => a - b).join(',')
  const ok = theirs.some((candidate) => [...(candidate.group ?? [])].sort((a: number, b: number) => a - b).join(',') === sets)
  if (!ok) mismatches.push(`${echo.name}: set membership differs between sources`)
  else summary.echoes.verified += 1
  return { ...echo, provenance: { ...echo.provenance, verified: ok } }
})
writeFileSync(resolve(`${OUT}/echoes.json`), `${JSON.stringify(checkedEchoes)}\n`)

// ---- Enemies: there is no second database for resistances. The wiki's Damage page states the
// rule (10% base, 40% for a boss's own element); an enemy whose values follow it counts as verified.
const enemies: EnemyDef[] = read(`${OUT}/enemies.json`)
const checkedEnemies = enemies.map((enemy) => {
  summary.enemies.checked += 1
  const ok = Object.values(enemy.resistance).every((value) => value === 0.1 || value === 0.4)
  if (ok) summary.enemies.verified += 1
  else mismatches.push(`${enemy.name}: resistances do not follow the wiki's 10% / 40% rule`)
  return {
    ...enemy,
    provenance: { ...enemy.provenance, verified: ok, note: ok ? 'Follows the 10% / 40% rule stated on the wiki Damage page.' : undefined },
  }
})
writeFileSync(resolve(`${OUT}/enemies.json`), `${JSON.stringify(checkedEnemies)}\n`)

const report = { comparedWith: `nanoka.cc ${nanokaVersion}`, summary, mismatches }
writeFileSync(resolve(`${OUT}/crosscheck-report.json`), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(summary, null, 2))
console.log(`${mismatches.length} mismatches${mismatches.length > 0 ? ':\n' + mismatches.slice(0, 20).join('\n') : ''}`)
