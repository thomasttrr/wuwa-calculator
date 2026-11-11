// Turns data/raw (untrimmed source responses) into:
//   data/snapshots/<source>/<version>/  trimmed copies of exactly the fields read here
//   data/game/<version>/                the catalog the app imports
//   data/game/manifest.json             version, dates, sources, counts
// This script is the only writer of data/game. Nothing here is typed in by hand:
// every value is read from a source file. Hand-encoded effects live in data/authored.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type {
  ActionDef,
  ActionPart,
  EchoCost,
  EchoDef,
  EchoStatTables,
  EnemyDef,
  GrowthPoint,
  ResonatorDef,
  SkillDef,
  SkillType,
  SonataDef,
  TraceNodeDef,
  WeaponDef,
  WeaponType,
} from '../../src/engine/types/catalog'
import type { DamageType, Element, ScalingStat, Scope, StatKey } from '../../src/engine/types/stats'

/* eslint-disable @typescript-eslint/no-explicit-any -- raw source JSON is untyped by nature */

const RAW = 'data/raw'
const read = (path: string): any => JSON.parse(readFileSync(resolve(path), 'utf8'))
const list = (dir: string): string[] => (existsSync(resolve(dir)) ? readdirSync(resolve(dir)) : [])

const readme = readFileSync(resolve(RAW, 'arikatsu/README.md'), 'utf8')
const GAME_VERSION = readme.match(/Game Version:\s*([\d.]+)/)?.[1]
if (!GAME_VERSION) throw new Error('Could not read the game version from the Arikatsu README')
const NANOKA_VERSION = list(`${RAW}/nanoka`).find((name) => /^\d/.test(name)) ?? 'unknown'
const fetchLog = read(`${RAW}/fetch-log.json`)
const ARIKATSU_SHA = readFileSync(resolve(RAW, 'arikatsu/PINNED_COMMIT'), 'utf8').trim()

const OUT = `data/game/${GAME_VERSION}`
const SNAP = 'data/snapshots'
const warnings: string[] = []
const warn = (message: string) => warnings.push(message)

function write(path: string, value: unknown, pretty = false): void {
  const full = resolve(path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, `${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`)
}

/** Rounds away floating-point noise from parsing decimal strings. */
const tidy = (value: number): number => Math.round(value * 1e8) / 1e8
const pct = (text: string): number => tidy(parseFloat(text) / 100)

function plain(html: unknown): string {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const ELEMENT_BY_ID: Record<number, Element> = {
  0: 'physical',
  1: 'glacio',
  2: 'fusion',
  3: 'electro',
  4: 'aero',
  5: 'spectro',
  6: 'havoc',
}
const WEAPON_BY_ID: Record<number, WeaponType> = {
  1: 'broadblade',
  2: 'sword',
  3: 'pistols',
  4: 'gauntlets',
  5: 'rectifier',
}
const SKILL_TYPE: Record<string, SkillType> = {
  'Normal Attack': 'normal',
  'Resonance Skill': 'skill',
  'Forte Circuit': 'forte',
  'Resonance Liberation': 'liberation',
  'Intro Skill': 'intro',
  'Outro Skill': 'outro',
  'Inherent Skill': 'inherent',
  'Tune Break': 'tuneBreak',
}
const DAMAGE_TYPE: Record<string, DamageType> = {
  'Basic Attack': 'basic',
  'Heavy Attack': 'heavy',
  'Resonance Skill': 'skill',
  'Resonance Liberation': 'liberation',
  'Intro Skill': 'intro',
  'Outro Skill': 'outro',
  'Echo Skill': 'echo',
  'Tune Rupture - Shifting': 'tuneRupture',
  '': 'other',
}
const FALLBACK_DAMAGE_TYPE: Record<SkillType, DamageType> = {
  normal: 'basic',
  skill: 'skill',
  forte: 'other',
  liberation: 'liberation',
  intro: 'intro',
  outro: 'outro',
  inherent: 'other',
  tuneBreak: 'other',
}
const SCALING: Record<string, ScalingStat> = { ATK: 'atk', HP: 'hp', DEF: 'def', 'Energy Regen': 'energyRegen' }
const SUBTYPE_TAG: Record<string, string> = { 'Spectro Frazzle': 'spectroFrazzle', 'Glacio Chafe': 'glacioChafe' }

/**
 * The game's stat ids. Confirmed two ways: each 2-piece set bonus's id against its
 * description, and the id order of the game's English stat-name table
 * (data/raw/arikatsu/Textmaps/en/property/PropertyIndex.json).
 */
function statForProp(propId: number, isRatio: boolean): { stat: StatKey; scope?: Scope } | null {
  switch (propId) {
    case 7:
    case 10007:
      return { stat: isRatio ? 'atkPct' : 'atkFlat' }
    case 2:
    case 10002:
      return { stat: isRatio ? 'hpPct' : 'hpFlat' }
    case 10:
    case 10010:
      return { stat: isRatio ? 'defPct' : 'defFlat' }
    case 8:
      return { stat: 'critRate' }
    case 9:
      return { stat: 'critDmg' }
    case 11:
      return { stat: 'energyRegen' }
    case 35:
      return { stat: 'healingBonus' }
    case 14:
      return { stat: 'dmgBonus', scope: { damageTypes: ['skill'] } }
    case 15:
      return { stat: 'dmgBonus' }
    case 17:
      return { stat: 'dmgBonus', scope: { damageTypes: ['basic'] } }
    case 18:
      return { stat: 'dmgBonus', scope: { damageTypes: ['heavy'] } }
    case 19:
      return { stat: 'dmgBonus', scope: { damageTypes: ['liberation'] } }
    case 21:
    case 22:
    case 23:
    case 24:
    case 25:
    case 26:
    case 27: {
      const element = ELEMENT_BY_ID[propId - 21]
      return element ? { stat: 'dmgBonus', scope: { elements: [element] } } : null
    }
    default:
      return null
  }
}

const ELEMENT_NAME: Record<Element, string> = {
  physical: 'Physical',
  glacio: 'Glacio',
  fusion: 'Fusion',
  electro: 'Electro',
  aero: 'Aero',
  spectro: 'Spectro',
  havoc: 'Havoc',
}
const TYPE_NAME: Partial<Record<DamageType, string>> = {
  basic: 'Basic Attack',
  heavy: 'Heavy Attack',
  skill: 'Resonance Skill',
  liberation: 'Resonance Liberation',
}

function statLabel(stat: StatKey, scope?: Scope): string {
  const plainLabels: Partial<Record<StatKey, string>> = {
    atkPct: 'ATK%',
    atkFlat: 'ATK',
    hpPct: 'HP%',
    hpFlat: 'HP',
    defPct: 'DEF%',
    defFlat: 'DEF',
    critRate: 'Crit. Rate',
    critDmg: 'Crit. DMG',
    energyRegen: 'Energy Regen',
    healingBonus: 'Healing Bonus',
  }
  if (stat !== 'dmgBonus') return plainLabels[stat] ?? stat
  const element = scope?.elements?.[0]
  const type = scope?.damageTypes?.[0]
  if (element) return `${ELEMENT_NAME[element]} DMG Bonus`
  if (type) return `${TYPE_NAME[type] ?? type} DMG Bonus`
  return 'DMG Bonus'
}

// ---------------------------------------------------------------- Resonators

interface ParsedTerm {
  multiplier: number
  flat: number
  count: number
}

/** "29.86%*2+39.81%" -> terms. Returns null when a term is not understood. */
function parseSkillValue(text: string): ParsedTerm[] | null {
  const terms: ParsedTerm[] = []
  for (const raw of text.split('+')) {
    const term = raw.trim()
    const percent = term.match(/^(\d+(?:\.\d+)?)%+(?:\*(\d+))?$/)
    if (percent) {
      terms.push({ multiplier: pct(percent[1] ?? '0'), flat: 0, count: Number(percent[2] ?? 1) })
      continue
    }
    const flat = term.match(/^(\d+(?:\.\d+)?)$/)
    if (flat) {
      terms.push({ multiplier: 0, flat: Number(flat[1]), count: 1 })
      continue
    }
    return null
  }
  return terms
}

interface DamageRow {
  id: number
  rates: number[]
  damageType: DamageType
  element: Element
  scalingStat: ScalingStat
  energy?: number
  tag?: string
  formulaType: number
  heal: boolean
}

/**
 * Element of every damage row, from the raw game table. The encore.moe API has no element field
 * on its damage rows (its ElementPowerType is a different thing and is 0 on many elemental hits).
 */
const ELEMENT_BY_ROW = new Map<number, number>(
  read(`${RAW}/arikatsu/BinData/damage/damage.json`).map((row: any) => [row.Id, row.Element]),
)

function parseRows(skill: any): DamageRow[] {
  return (skill.DamageList ?? []).map((row: any): DamageRow => {
    const damageType = DAMAGE_TYPE[row.Type as string]
    if (damageType === undefined) warn(`Unknown damage type "${row.Type}" on row ${row.Id}`)
    const scalingStat = SCALING[row.PropertyName as string]
    if (scalingStat === undefined) warn(`Unknown scaling stat "${row.PropertyName}" on row ${row.Id}`)
    return {
      id: row.Id,
      rates: (row.RateLv ?? []).map((rate: string) => pct(rate)),
      damageType: damageType ?? 'other',
      element: rowElement(row.Id),
      scalingStat: scalingStat ?? 'atk',
      energy: typeof row.Energy?.[0] === 'number' ? row.Energy[0] : undefined,
      tag: SUBTYPE_TAG[row.SubType as string],
      formulaType: row.FormulaType ?? 0,
      heal: row.DmgType === 'Heal',
    }
  })
}

function rowElement(rowId: number): Element {
  const element = ELEMENT_BY_ID[ELEMENT_BY_ROW.get(rowId) ?? -1]
  if (!element) warn(`Damage row ${rowId} has no element in the raw damage table`)
  return element ?? 'physical'
}

/** A value named like a hit ("Stage 1 DMG") rather than a bonus or a reduction. */
function looksLikeHit(name: string): boolean {
  return /\bDMG\b|Damage/i.test(name) && !/Reduction|Increase|Multiplier|Bonus|Shield|per /i.test(name)
}

function rowMatches(row: DamageRow, multipliers: number[]): boolean {
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-6
  if (row.rates.length === multipliers.length) return row.rates.every((rate, i) => close(rate, multipliers[i] ?? NaN))
  if (row.rates.length === 1) return multipliers.every((m) => close(m, row.rates[0] ?? NaN))
  return false
}

const LEVELS = 10

/**
 * Matches each term of a skill value to a raw damage row: first among the skill's own rows,
 * then among all of the Resonator's rows (some hits, such as Outro Skills, list their damage
 * row under another skill).
 */
function buildActions(raw: any, skill: any, skillType: SkillType, element: Element, allRows: DamageRow[]): ActionDef[] {
  const rows = parseRows(skill)
  const used = new Set<number>()
  const actions: ActionDef[] = []

  for (const attribute of skill.SkillAttributes ?? []) {
    const values: string[] = (attribute.values ?? []).slice(0, LEVELS)
    if (values.length === 0 || !String(values[0]).includes('%')) continue

    const base = {
      id: attribute.attributeId as number,
      skillId: skill.SkillId as number,
      skillType,
      name: String(attribute.attributeName).trim(),
    }
    const sourceId = `character/${raw.Id}.json#Skills[${skill.SkillId}].SkillAttributes[${attribute.attributeId}]`

    const perLevel = values.map((value) => parseSkillValue(String(value)))
    const first = perLevel[0]
    const consistent =
      first != null &&
      perLevel.every((terms) => terms != null && terms.length === first.length && terms.every((t, i) => t.count === first[i]?.count))
    if (!first || !consistent) {
      actions.push({
        ...base,
        kind: 'damage',
        parts: [],
        modelled: false,
        notModelledReason: `The value "${values[0]}" is in a form this app does not read yet.`,
        provenance: { source: 'encore', sourceId, verified: false },
      })
      continue
    }

    const parts: ActionPart[] = []
    let heal = /\bheal/i.test(base.name)
    let specialFormula = 0
    let ambiguous = false
    let unmatched = false

    first.forEach((term, index) => {
      const multipliers = perLevel.map((terms) => terms?.[index]?.multiplier ?? 0)
      const flats = perLevel.map((terms) => terms?.[index]?.flat ?? 0)
      const isFlatOnly = multipliers.every((m) => m === 0)
      const own = isFlatOnly ? [] : rows.filter((row) => rowMatches(row, multipliers))
      const candidates = own.length > 0 || isFlatOnly ? own : allRows.filter((row) => rowMatches(row, multipliers))
      const row = candidates.find((candidate) => !used.has(candidate.id)) ?? candidates[0]
      if (row) {
        used.add(row.id)
        if (new Set(candidates.map((c) => `${c.damageType}/${c.element}/${c.scalingStat}`)).size > 1) ambiguous = true
        if (row.heal) heal = true
        if (row.formulaType !== 0) specialFormula = row.formulaType
      } else if (!isFlatOnly) {
        unmatched = true
      }
      const anchor = row ?? parts.find((part) => part.matched)
      parts.push({
        multipliers,
        flats,
        count: term.count,
        damageType: anchor?.damageType ?? FALLBACK_DAMAGE_TYPE[skillType],
        element: anchor?.element ?? element,
        scalingStat: anchor?.scalingStat ?? 'atk',
        tags: row?.tag ? [row.tag] : [],
        energy: row?.energy,
        rowId: row?.id,
        matched: row !== undefined,
      })
    })

    const notes: string[] = []
    if (ambiguous) notes.push('Several raw damage rows match this value with different types; the first was used.')
    if (unmatched) notes.push('No raw damage row matches this value; its damage type is assumed from the skill.')
    if (parts.some((part) => part.tags.length > 0)) notes.push('Counts as a negative-status damage type; its treatment is unverified.')
    if (parts.some((part) => part.damageType === 'tuneRupture'))
      notes.push('Tune Rupture damage may use extra multipliers (such as Tune Break Boost) that no public formula describes.')
    const anyMatched = parts.some((part) => part.matched)
    const notModelledReason =
      specialFormula !== 0
        ? `Uses a special formula (type ${specialFormula}) that has no public description.`
        : !anyMatched && !heal
          ? looksLikeHit(base.name)
            ? 'The game data splits this hit into smaller parts that could not be matched to it, so it is left out of totals.'
            : 'No damage entry in the game data matches this value, so it may not be a hit (for example a shield, a speed change or a bonus per stack).'
          : undefined

    actions.push({
      ...base,
      kind: heal ? 'heal' : 'damage',
      parts,
      modelled: notModelledReason === undefined,
      ...(notModelledReason ? { notModelledReason } : {}),
      provenance: { source: 'encore', sourceId, verified: false, note: notes.length > 0 ? notes.join(' ') : undefined },
    })
  }
  return actions
}

function buildTraceNodes(raw: any): TraceNodeDef[] {
  const nodes: TraceNodeDef[] = []
  for (const node of raw.SkillTree ?? []) {
    const title = String(node.PropertyNodeTitle ?? '')
    const value = String(node.PropertyNodeDescribe ?? '').match(/(\d+(?:\.\d+)?)%/)?.[1]
    const name = title.replace(/\s*(\+|Up)\s*$/, '').trim()
    let target: { stat: StatKey; scope?: Scope } | null = null
    if (name === 'ATK') target = { stat: 'atkPct' }
    else if (name === 'HP') target = { stat: 'hpPct' }
    else if (name === 'DEF') target = { stat: 'defPct' }
    else if (name === 'Crit. Rate') target = { stat: 'critRate' }
    else if (name === 'Crit. DMG') target = { stat: 'critDmg' }
    else if (name === 'Healing Bonus') target = { stat: 'healingBonus' }
    else {
      const element = (Object.keys(ELEMENT_NAME) as Element[]).find((key) => name === `${ELEMENT_NAME[key]} DMG Bonus`)
      if (element) target = { stat: 'dmgBonus', scope: { elements: [element] } }
    }
    if (!target || !value) {
      warn(`Skill tree node ${node.Id} of ${raw.Id} not understood: "${title}" / "${node.PropertyNodeDescribe}"`)
      continue
    }
    nodes.push({ id: node.Id, ...target, value: pct(value), label: plain(node.PropertyNodeDescribe) })
  }
  return nodes
}

function buildGrowth(raw: any): GrowthPoint[] {
  const prop = (name: string) => (raw.Properties ?? []).find((p: any) => p.Name === name)?.GrowthValues ?? []
  const hp = prop('HP')
  const atk = prop('ATK')
  const def = prop('DEF')
  return hp.map((point: any, index: number): GrowthPoint => ({
    level: point.level,
    ascended: index > 0 && hp[index - 1].level === point.level,
    hp: tidy(point.value),
    atk: tidy(atk[index]?.value ?? NaN),
    def: tidy(def[index]?.value ?? NaN),
  }))
}

function normaliseResonator(raw: any): ResonatorDef {
  const element = ELEMENT_BY_ID[raw.ElementId as number]
  const weaponId = typeof raw.WeaponType === 'number' ? raw.WeaponType : raw.WeaponType?.Id
  const weaponType = WEAPON_BY_ID[weaponId as number]
  if (!element || !weaponType) throw new Error(`Resonator ${raw.Id}: unknown element ${raw.ElementId} or weapon ${weaponId}`)

  const skills: SkillDef[] = []
  const actions: ActionDef[] = []
  const allRows = (raw.Skills ?? []).flatMap((skill: any) => parseRows(skill))
  for (const skill of raw.Skills ?? []) {
    const type = SKILL_TYPE[skill.SkillType as string]
    if (!type) {
      warn(`Resonator ${raw.Id}: unknown skill type "${skill.SkillType}"`)
      continue
    }
    const skillActions = buildActions(raw, skill, type, element, allRows)
    actions.push(...skillActions)
    skills.push({
      id: skill.SkillId,
      type,
      name: plain(skill.SkillName),
      description: plain(skill.SkillDescribe),
      actionIds: skillActions.map((action) => action.id),
    })
  }

  const baseProp = (name: string) => (raw.Properties ?? []).find((p: any) => p.Name === name)?.BaseValue ?? NaN
  return {
    id: raw.Id,
    name: plain(raw.Name?.Content ?? raw.Name),
    rarity: raw.QualityId === 5 ? 5 : 4,
    element,
    weaponType,
    growth: buildGrowth(raw),
    baseCritRate: tidy(baseProp('Crit. Rate') / 10000),
    baseCritDmg: tidy(baseProp('Crit. DMG') / 10000),
    traceNodes: buildTraceNodes(raw),
    skills,
    actions,
    sequences: (raw.ResonantChain ?? []).map((node: any) => ({
      index: node.GroupIndex,
      name: plain(node.NodeName).replace(/\s*\n\s*/g, ' '),
      description: plain(node.AttributesDescription),
      params: node.AttributesDescriptionParams ?? [],
    })),
    model: 'basic',
    provenance: { source: 'encore', sourceId: `character/${raw.Id}.json`, verified: false },
  }
}

function resonatorSnapshot(raw: any): unknown {
  return {
    Id: raw.Id,
    Name: raw.Name,
    QualityId: raw.QualityId,
    ElementId: raw.ElementId,
    WeaponType: raw.WeaponType,
    Properties: (raw.Properties ?? []).map((p: any) => ({ Name: p.Name, BaseValue: p.BaseValue, GrowthValues: p.GrowthValues })),
    Skills: (raw.Skills ?? []).map((s: any) => ({
      SkillId: s.SkillId,
      SkillType: s.SkillType,
      SkillName: s.SkillName,
      SkillDescribe: s.SkillDescribe,
      SkillAttributes: (s.SkillAttributes ?? []).map((a: any) => ({
        attributeId: a.attributeId,
        attributeName: a.attributeName,
        values: a.values,
      })),
      DamageList: (s.DamageList ?? []).map((d: any) => ({
        Id: d.Id,
        Type: d.Type,
        DmgType: d.DmgType,
        PropertyName: d.PropertyName,
        SubType: d.SubType,
        RateLv: d.RateLv,
        Energy: d.Energy,
        // Not in the API response: joined in from Arikatsu BinData/damage/damage.json by row id.
        ElementFromRawTable: ELEMENT_BY_ROW.get(d.Id),
        FormulaType: d.FormulaType,
      })),
    })),
    SkillTree: (raw.SkillTree ?? []).map((n: any) => ({
      Id: n.Id,
      PropertyNodeTitle: n.PropertyNodeTitle,
      PropertyNodeDescribe: n.PropertyNodeDescribe,
    })),
    ResonantChain: (raw.ResonantChain ?? []).map((c: any) => ({
      GroupIndex: c.GroupIndex,
      NodeName: c.NodeName,
      AttributesDescription: c.AttributesDescription,
      AttributesDescriptionParams: c.AttributesDescriptionParams,
    })),
  }
}

// ---------------------------------------------------------------- Weapons

const WEAPON_SECONDARY: Record<string, StatKey> = {
  ATK: 'atkPct',
  HP: 'hpPct',
  DEF: 'defPct',
  'Crit. Rate': 'critRate',
  'Crit. DMG': 'critDmg',
  'Energy Regen': 'energyRegen',
}

function normaliseWeapon(raw: any): WeaponDef | null {
  const weaponId = typeof raw.WeaponType === 'number' ? raw.WeaponType : raw.WeaponType?.Id
  const weaponType = WEAPON_BY_ID[weaponId as number]
  const [atk, secondary] = raw.Properties ?? []
  const secondaryStat = WEAPON_SECONDARY[secondary?.Name as string]
  if (!weaponType || !atk || !secondary || !secondaryStat) {
    warn(`Weapon ${raw.ItemId} skipped: type ${weaponId}, secondary "${secondary?.Name}"`)
    return null
  }
  const growth = atk.GrowthValues.map((point: any, index: number) => {
    const text = String(secondary.GrowthValues[index]?.Value ?? '')
    if (!text.includes('%')) warn(`Weapon ${raw.ItemId}: secondary value "${text}" is not a percentage`)
    return {
      level: Math.floor(Number(point.Level)),
      ascended: !Number.isInteger(Number(point.Level)),
      atk: tidy(parseFloat(point.Value)),
      secondary: pct(text),
    }
  })
  return {
    id: raw.ItemId,
    name: plain(raw.WeaponName),
    rarity: raw.QualityId,
    weaponType,
    growth,
    secondaryStat,
    passive: {
      name: plain(raw.ResonName),
      description: plain(raw.Desc),
      params: (raw.DescParams ?? []).map((param: any) => param.ArrayString ?? []),
    },
    provenance: { source: 'encore', sourceId: `weapon/${raw.ItemId}.json`, verified: false },
  }
}

function weaponSnapshot(raw: any): unknown {
  return {
    ItemId: raw.ItemId,
    WeaponName: raw.WeaponName,
    QualityId: raw.QualityId,
    WeaponType: raw.WeaponType,
    ResonName: raw.ResonName,
    Desc: raw.Desc,
    DescParams: raw.DescParams,
    Properties: (raw.Properties ?? []).map((p: any) => ({ Name: p.Name, BaseValue: p.BaseValue, GrowthValues: p.GrowthValues })),
  }
}

// ---------------------------------------------------------------- Echoes, sets, stat tables

const phantom = (file: string) => read(`${RAW}/arikatsu/BinData/phantom/${file}`)

function buildEchoes(): { echoes: EchoDef[]; sonatas: SonataDef[] } {
  const costByRarity = new Map<number, number>(phantom('phantomrarity.json').map((r: any) => [r.Rare, r.Cost]))
  const fetters = new Map<number, any>(phantom('phantomfetter.json').map((f: any) => [f.Id, f]))
  const echoes: EchoDef[] = []
  const sonatas = new Map<number, SonataDef>()
  const seen = new Set<string>()
  const snapshot: unknown[] = []

  for (const item of read(`${RAW}/encore/echo.json`).Echo) {
    for (const group of item.FetterGroups ?? []) {
      if (sonatas.has(group.Id)) continue
      sonatas.set(group.Id, {
        id: group.Id,
        name: plain(group.Name),
        effects: (group.Fetters ?? []).map((fetter: any) => {
          const table = fetters.get(fetter.Id)
          const params: string[] = table?.EffectDescriptionParam ?? []
          const fixed = (table?.AddProp ?? []).flatMap((prop: any) => {
            const target = statForProp(prop.Id, prop.IsRatio === true)
            if (!target) {
              warn(`Set ${group.Name}: stat id ${prop.Id} not understood`)
              return []
            }
            return [{ ...target, value: tidy(prop.IsRatio ? prop.Value : prop.Value / 10000) }]
          })
          return {
            pieces: fetter.Key,
            description: plain(fetter.EffectDescription).replace(/\{(\d+)\}/g, (_, i) => params[Number(i)] ?? '?'),
            params,
            fixed,
          }
        }),
        provenance: { source: 'encore', sourceId: `echo.json#FetterGroups[${group.Id}]`, verified: false },
      })
    }

    if (item.PhantomType !== 1) continue
    const cost = costByRarity.get(item.Rarity)
    if (cost !== 1 && cost !== 3 && cost !== 4) {
      warn(`Echo ${item.Id}: no cost for rarity class ${item.Rarity}`)
      continue
    }
    const key = `${item.Name}|${cost}`
    if (seen.has(key)) continue
    seen.add(key)
    const detail = read(`${RAW}/encore/echo/${item.Id}.json`)
    echoes.push({
      id: item.Id,
      name: plain(item.Name),
      cost: cost as EchoCost,
      sonataIds: (item.FetterGroups ?? []).map((group: any) => group.Id),
      element: ELEMENT_BY_ID[item.Element?.Id as number],
      skill: {
        description: plain(detail.Skill?.DescriptionEx),
        cooldown: detail.Skill?.SkillCD ?? 0,
        params: (detail.Skill?.LevelDescStrArray ?? []).map((level: any) => level.ArrayString ?? []),
      },
      provenance: { source: 'encore', sourceId: `echo/${item.Id}.json`, verified: false },
    })
    snapshot.push({
      Id: item.Id,
      Name: item.Name,
      Rarity: item.Rarity,
      PhantomType: item.PhantomType,
      Element: item.Element ? { Id: item.Element.Id, Name: item.Element.Name } : undefined,
      FetterGroups: item.FetterGroups,
      Skill: {
        DescriptionEx: detail.Skill?.DescriptionEx,
        SkillCD: detail.Skill?.SkillCD,
        LevelDescStrArray: detail.Skill?.LevelDescStrArray,
      },
    })
  }
  write(`${SNAP}/encore/${GAME_VERSION}/echoes.json`, snapshot)
  return { echoes, sonatas: [...sonatas.values()] }
}

function buildEchoStatTables(): EchoStatTables {
  const groups: any[] = phantom('phantommainproperty.json')
  const items = new Map<number, any>(phantom('phantommainpropitem.json').map((i: any) => [i.Id, i]))
  const growth: any[] = phantom('phantomgrowth.json')
  const costByRarity = new Map<number, number>(phantom('phantomrarity.json').map((r: any) => [r.Rare, r.Cost]))
  const maxLevel = Math.max(...growth.map((g) => g.Level))

  const valueAtMax = (item: any) => {
    const factor = growth.find((g) => g.GrowthId === item.GrowthId && g.Level === maxLevel)?.Value ?? NaN
    const scaled = (item.StandardProperty * factor) / 10000
    const target = statForProp(item.PropId, item.AddType === 2)
    if (!target) throw new Error(`Echo main stat item ${item.Id}: stat id ${item.PropId} not understood`)
    const isFlat = target.stat === 'atkFlat' || target.stat === 'hpFlat' || target.stat === 'defFlat'
    return { ...target, value: tidy(isFlat ? scaled : scaled / 10000), label: statLabel(target.stat, target.scope) }
  }

  // The main-stat group used by 5-star Echoes of each cost is read from the Echo data itself.
  const votes = new Map<number, Map<number, number>>()
  for (const file of list(`${RAW}/encore/echo`)) {
    const echo = read(`${RAW}/encore/echo/${file}`)
    const cost = costByRarity.get(echo.Rarity)
    const group = echo.MainProp?.RandGroupId
    if (echo.QualityId !== 5 || cost === undefined || group === undefined) continue
    const tally = votes.get(cost) ?? new Map<number, number>()
    tally.set(group, (tally.get(group) ?? 0) + 1)
    votes.set(cost, tally)
  }

  const mainStats = {} as EchoStatTables['mainStats']
  const fixedStats = {} as EchoStatTables['fixedStats']
  for (const cost of [1, 3, 4] as const) {
    const tally = votes.get(cost)
    const groupId = tally ? [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] : undefined
    const rows = groups.filter((g) => g.RandGroupId === groupId)
    if (rows.length === 0) throw new Error(`No main stat group found for ${cost}-cost Echoes`)
    mainStats[cost] = rows.map((row) => valueAtMax(items.get(row.PropGroup[0])))
    const fixed = valueAtMax(items.get(rows[0].PropGroup[1]))
    fixedStats[cost] = { stat: fixed.stat, value: fixed.value, label: fixed.label }
  }

  // Cross-check the computed maximums against the wiki's Mainstats table.
  const wiki = read(`${SNAP}/wiki/echo-stats.json`)
  let agrees = true
  for (const cost of [1, 3, 4] as const) {
    for (const [label, expected] of Object.entries(wiki.mainStatMaxRarity5[String(cost)] as Record<string, number>)) {
      const isFixed = label.startsWith('fixed ')
      const name = isFixed ? label.slice(6) : label
      const found = isFixed
        ? fixedStats[cost].label === name
          ? fixedStats[cost].value
          : undefined
        : mainStats[cost].find((m) => m.label === name || (name === 'Element DMG Bonus' && m.scope?.elements))?.value
      const scaled = found === undefined ? undefined : isFixed ? found : found * 100
      if (scaled === undefined || Math.abs(scaled - expected) > 0.051) {
        agrees = false
        warn(`Echo main stat mismatch, ${cost}-cost ${label}: raw tables ${scaled}, wiki ${expected}`)
      }
    }
  }

  const SUB: Record<string, { stat: StatKey; scope?: Scope }> = {
    ATK: { stat: 'atkFlat' },
    HP: { stat: 'hpFlat' },
    DEF: { stat: 'defFlat' },
    'ATK%': { stat: 'atkPct' },
    'HP%': { stat: 'hpPct' },
    'DEF%': { stat: 'defPct' },
    'Crit. Rate': { stat: 'critRate' },
    'Crit. DMG': { stat: 'critDmg' },
    'Energy Regen': { stat: 'energyRegen' },
    'Basic Attack DMG Bonus': { stat: 'dmgBonus', scope: { damageTypes: ['basic'] } },
    'Heavy Attack DMG Bonus': { stat: 'dmgBonus', scope: { damageTypes: ['heavy'] } },
    'Resonance Skill DMG Bonus': { stat: 'dmgBonus', scope: { damageTypes: ['skill'] } },
    'Resonance Liberation DMG Bonus': { stat: 'dmgBonus', scope: { damageTypes: ['liberation'] } },
  }
  const substats = (wiki.substats as any[]).map((row) => {
    const target = SUB[row.label as string]
    if (!target) throw new Error(`Wiki substat "${row.label}" not understood`)
    return {
      ...target,
      label: row.label as string,
      rolls: (row.values as number[]).map((v) => (row.percent ? tidy(v / 100) : v)),
      chances: (row.chances as number[]).map((c) => tidy(c / 100)),
    }
  })

  return {
    mainStats,
    fixedStats,
    substats,
    provenance: {
      source: 'arikatsu',
      sourceId: `BinData/phantom/* @ ${ARIKATSU_SHA.slice(0, 7)}; substats: snapshots/wiki/echo-stats.json`,
      verified: agrees,
      note: 'Main stats: raw game tables, checked against the wiki. Substat rolls and chances: wiki only (it cites Kuro Games published rates).',
    },
  }
}

// ---------------------------------------------------------------- Enemies

function buildEnemies(): EnemyDef[] {
  const enemies: EnemyDef[] = []
  const seen = new Set<string>()
  const snapshot: unknown[] = []
  const keys = ['Phys', 'Element1', 'Element2', 'Element3', 'Element4', 'Element5', 'Element6']
  for (const item of read(`${RAW}/encore/monster.json`).monsterList) {
    const detail = read(`${RAW}/encore/monster/${item.Id}.json`)
    const values = keys.map((key) => detail.Properties?.[`DamageResistance${key}`]?.Value)
    if (values.some((value) => typeof value !== 'number')) continue
    const resistance = Object.fromEntries(
      values.map((value, index) => [ELEMENT_BY_ID[index], tidy((value as number) / 10000)]),
    ) as Record<Element, number>
    const key = `${item.Name}|${item.Rarity}|${values.join('/')}`
    if (seen.has(key)) continue
    seen.add(key)
    enemies.push({
      id: item.Id,
      name: plain(item.Name),
      rank: plain(item.Rarity),
      resistance,
      provenance: { source: 'encore', sourceId: `monster/${item.Id}.json`, verified: false },
    })
    snapshot.push({ Id: item.Id, Name: item.Name, Rarity: item.Rarity, Resistances: Object.fromEntries(keys.map((k, i) => [`DamageResistance${k}`, values[i]])) })
  }
  write(`${SNAP}/encore/${GAME_VERSION}/monsters.json`, snapshot)
  return enemies
}

// ---------------------------------------------------------------- Run

rmSync(resolve(OUT), { recursive: true, force: true })
rmSync(resolve(SNAP, 'encore', GAME_VERSION), { recursive: true, force: true })

const resonators: ResonatorDef[] = []
const seenNames = new Set<string>()
for (const file of list(`${RAW}/encore/character`).sort((a, b) => parseInt(a) - parseInt(b))) {
  const raw = read(`${RAW}/encore/character/${file}`)
  const resonator = normaliseResonator(raw)
  if (seenNames.has(resonator.name)) continue // Rover's two body types share one kit; keep the first id.
  seenNames.add(resonator.name)
  resonators.push(resonator)
  write(`${SNAP}/encore/${GAME_VERSION}/character/${raw.Id}.json`, resonatorSnapshot(raw))
  write(`${OUT}/resonators/${resonator.id}.json`, resonator)
}
write(
  `${OUT}/resonators-index.json`,
  resonators.map(({ id, name, rarity, element, weaponType, model }) => ({ id, name, rarity, element, weaponType, model })),
  true,
)

const weapons: WeaponDef[] = []
const weaponSnapshots: unknown[] = []
for (const file of list(`${RAW}/encore/weapon`).sort()) {
  const raw = read(`${RAW}/encore/weapon/${file}`)
  const weapon = normaliseWeapon(raw)
  if (!weapon) continue
  weapons.push(weapon)
  weaponSnapshots.push(weaponSnapshot(raw))
}
write(`${SNAP}/encore/${GAME_VERSION}/weapons.json`, weaponSnapshots)
write(`${OUT}/weapons.json`, weapons)

const { echoes, sonatas } = buildEchoes()
write(`${OUT}/echoes.json`, echoes)
write(`${OUT}/sonatas.json`, sonatas, true)

const echoStats = buildEchoStatTables()
write(`${OUT}/echo-stat-tables.json`, echoStats, true)

const enemies = buildEnemies()
write(`${OUT}/enemies.json`, enemies)

const allActions = resonators.flatMap((r) => r.actions)
const manifest = {
  gameVersion: GAME_VERSION,
  dataDate: String(fetchLog.finishedAt).slice(0, 10),
  fetchedAt: fetchLog.finishedAt,
  sources: [
    { name: 'encore.moe', url: 'https://api-v2.encore.moe/api/en', role: 'primary' },
    { name: 'nanoka.cc', url: `https://static.nanoka.cc/ww/${NANOKA_VERSION}`, role: 'cross-check' },
    { name: 'Arikatsu/WutheringWaves_Data', url: `https://github.com/Arikatsu/WutheringWaves_Data/tree/${ARIKATSU_SHA}`, role: 'Echo stat tables' },
    { name: 'Wuthering Waves Wiki (Fandom, CC-BY-SA)', url: 'https://wutheringwaves.fandom.com/wiki/Echo/Stats', role: 'substat rolls, formula text' },
  ],
  counts: {
    resonators: resonators.length,
    weapons: weapons.length,
    echoes: echoes.length,
    sonatas: sonatas.length,
    enemies: enemies.length,
    actions: allActions.length,
    actionsNotModelled: allActions.filter((a) => !a.modelled).length,
    actionsWithNotes: allActions.filter((a) => a.provenance.note).length,
    healActions: allActions.filter((a) => a.kind === 'heal').length,
  },
  warnings,
}
write('data/game/manifest.json', manifest, true)

console.log(JSON.stringify(manifest.counts, null, 2))
console.log(`${warnings.length} warnings${warnings.length > 0 ? ':\n' + warnings.slice(0, 25).join('\n') : ''}`)
