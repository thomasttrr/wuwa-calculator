// Reads game descriptions (weapon passives, set effects, Sequence nodes, passive and Outro
// skills, Echo skills) and turns the sentences it fully understands into effects.
//
// Rules that keep it honest:
//  - A number becomes a modifier only when its stat words are on the known list below AND the
//    number is one of the source's own parameters (or, for skills with no parameters, appears
//    word for word in the description). tests/data/provenance.test.ts checks every value.
//  - A sentence with no condition is always on. A sentence with a condition becomes a switch,
//    off by default, whose label is the game's own sentence. Stated stack limits become stacks.
//  - Anything else is reported in `unparsed` and shown in the app as "Effect not modelled".
//  - A set piece whose bonus already arrives as structured data is skipped (it would count twice).
//  - Owners with hand-encoded effects (data/authored/effects/*.ts) are skipped.
import { WEAPON_EFFECTS } from '../../data/authored/effects/weapons'
import type { Catalog, EffectControl, EffectDef, EffectModifier, EffectOwner } from '../../src/engine/types/catalog'
import type { DamageType, Element, Scope, StatKey } from '../../src/engine/types/stats'

export interface UnparsedSentence {
  owner: string
  ownerKind: EffectOwner['kind']
  sentence: string
}

export interface ExtractOptions {
  coreResonatorIds: readonly number[]
  /** Owners already hand-encoded; the reader leaves them alone. */
  skipOwners?: readonly EffectOwner[]
}

const ELEMENTS_BY_NAME: Record<string, Element> = {
  glacio: 'glacio',
  fusion: 'fusion',
  electro: 'electro',
  aero: 'aero',
  spectro: 'spectro',
  havoc: 'havoc',
  physical: 'physical',
}
const ATTRIBUTE_ELEMENTS: Element[] = ['glacio', 'fusion', 'electro', 'aero', 'spectro', 'havoc']
const TYPES_BY_NAME: Record<string, DamageType | null> = {
  'basic attack': 'basic',
  'heavy attack': 'heavy',
  'resonance skill': 'skill',
  'resonance liberation': 'liberation',
  'echo skill': 'echo',
  'intro skill': 'intro',
  'outro skill': 'outro',
  basic: 'basic', // "Basic DMG Bonus"
  'coordinated attack': null, // a damage type the engine does not model
}

const TYPE_WORDS = 'Basic Attack|Heavy Attack|Resonance Skill|Resonance Liberation|Echo Skill|Intro Skill|Outro Skill|Coordinated Attack|Basic'
const ELEMENT_WORDS = 'Glacio|Fusion|Electro|Aero|Spectro|Havoc|Physical'
/** Longest phrases first so "Resonance Liberation" wins over "DMG". */
const STAT_WORDS = [
  `(?:${TYPE_WORDS}) Crit\\. (?:Rate|DMG)`,
  'All-Attribute',
  'all-Attribute',
  'all Attribute',
  'Attribute',
  TYPE_WORDS,
  ELEMENT_WORDS,
  'Crit\\. Rate',
  'Crit\\. DMG',
  'Energy Regen',
  'Healing Bonus',
  'ATK',
  'HP',
  'DEF',
  'DMG',
].join('|')

/** Words that turn "Spectro" into a negative status ("Spectro Frazzle"), which is not an element bonus. */
const NOT_STATUS = '(?!\\s+(?:Frazzle|Erosion|Chafe|Burst|Flare|Bane|Rage)\\b)'
const STAT = `(?<stat>${STAT_WORDS})${NOT_STATUS}`
const TAIL = '(?:\\s+DMG)?(?:\\s+Bonus)?'
const POSSESSIVE = "(?:the\\s+)?(?:current\\s+character's\\s+|all\\s+team\\s+members'\\s+|their\\s+|[A-Z][\\w-]*'s\\s+)?"
const BY = '\\s+by\\s+(?:an\\s+additional\\s+)?$'
const VERB = '(?<verb>increased|increases|increase|amplified)'

/** "of all nearby Resonators in the team", "dealt by nearby Resonators on the field", "of Heavy Attack DMG" */
const WHOSE = '(?<whose>\\s+(?:of|dealt\\s+by)\\s+[^,.]+?)?'

/** Patterns over the text just before a number. */
const LEFT_FORMS = [
  // "Resonance Skill DMG Bonus is increased by", "ATK increases by", "the ATK of all team members is increased by",
  // "DMG Amplified by", "Aero DMG dealt by nearby Resonators on the field is Amplified by"
  new RegExp(`(?:^|[\\s(,'])${STAT}${TAIL}${WHOSE}\\s+(?:(?:is|are)\\s+)?${VERB}${BY}`, 'i'),
  // "Increases ATK by", "increases Yangyang's Aero DMG Bonus by an additional",
  // "increase the current character's Electro DMG by", "increases Crit. DMG of all nearby Resonators in the team by"
  new RegExp(`(?:^|\\s)(?<verb>increases|increase)\\s+${POSSESSIVE}${STAT}${TAIL}${WHOSE}${BY}`, 'i'),
  // "Outro Skill DMG + ", "ATK +"
  new RegExp(`(?:^|[\\s(,'])${STAT}${TAIL}\\s*\\+\\s*$`, 'i'),
]
/** The second half of "increase X by N and Y by M". Only used right after a buff was read in the same sentence. */
const CONTINUATION = new RegExp(`^\\s*(?:,\\s*)?and\\s+${POSSESSIVE}${STAT}${TAIL}\\s+by\\s+$`, 'i')
/** "grants 12% Attribute DMG Bonus", "grant the incoming Resonator 15% Havoc DMG Bonus", "gives 4% additional ... Bonus" */
const GRANT_LEFT = /\b(?:grants?|gains?|gives?|granting|gaining)\b[^,.;]*?\s$/i
const GRANT_RIGHT = new RegExp(`^\\s*(?:additional\\s+)?${STAT}${TAIL}`, 'i')

const CONDITION =
  /\b(?:when|whenever|upon|after|while|within|during|if|now|casting|cast|dealing|performing|every time|each time|each successful|reaching|holding|attacking|inflicting|obtaining|gaining|switching|lasting|at max stacks|triggered|hits?|consum\w*|for [\d./]+s)\b|^[A-Z][\w' -]+: |^With [\d/]+ (?:times|stacks?)\b/i
/** A Resonator effect is always on only when the whole sentence is a plain stat increase. */
const PLAIN_STAT_SENTENCE = /^[\w .']+ (?:is|are) increased by \d+(?:\.\d+)?%\.$/
/** "reducing the Spectro RES of nearby targets by" */
const RES_REDUCTION = new RegExp(`reduc(?:ing|es|e)\\s+(?:the\\s+)?(?<element>${ELEMENT_WORDS})\\s+RES\\b[^,.]*?\\s+by\\s+$`, 'i')
/** "X is increased by 4%/5%/..., up to 24%/30%/...": a per-stack bonus whose cap gives the stack limit. */
const CAP = /,?\s*up to (\d+(?:\.\d+)?%(?:\/\d+(?:\.\d+)?%)*)/i
const TEAM = /all (?:nearby )?Resonators in the team|all team members|team members'|Resonators on nearby teams|nearby Resonators|all Resonators\b|party members/i
const NEXT = /incoming Resonator|next Resonator/i
const BOOKKEEPING = /lasts? for|can be triggered|cannot be stacked|^This effect stacks up to|cooldown|\bCD\b|resets its duration/i

/** "12.8%" -> 0.128 (same rounding as the provenance test). */
const percent = (text: string): number => Math.round(parseFloat(text) * 1e6) / 1e8

function mapStat(phrase: string, amplify: boolean): { stat: StatKey; scope?: Scope } | null {
  const text = phrase.toLowerCase()
  const typed = text.match(/^(.+?) crit\. (rate|dmg)$/)
  if (typed) {
    const type = TYPES_BY_NAME[typed[1] ?? '']
    if (!type) return null
    return { stat: typed[2] === 'rate' ? 'critRate' : 'critDmg', scope: { damageTypes: [type] } }
  }
  const bonus = (scope?: Scope) => ({ stat: (amplify ? 'amplify' : 'dmgBonus') as StatKey, ...(scope ? { scope } : {}) })
  if (text.includes('attribute')) return bonus({ elements: ATTRIBUTE_ELEMENTS })
  if (text in TYPES_BY_NAME) {
    const type = TYPES_BY_NAME[text]
    return type ? bonus({ damageTypes: [type] }) : null
  }
  const element = ELEMENTS_BY_NAME[text]
  if (element) return bonus({ elements: [element] })
  if (amplify) return text === 'dmg' ? bonus() : null
  // Bare "DMG" without "Amplified" usually belongs to one named skill ("Radiance of Fealty DMG"): not read.
  if (text === 'dmg') return null
  switch (text) {
    case 'crit. rate':
      return { stat: 'critRate' }
    case 'crit. dmg':
      return { stat: 'critDmg' }
    case 'energy regen':
      return { stat: 'energyRegen' }
    case 'healing bonus':
      return { stat: 'healingBonus' }
    case 'atk':
      return { stat: 'atkPct' }
    case 'hp':
      return { stat: 'hpPct' }
    case 'def':
      return { stat: 'defPct' }
    default:
      return null
  }
}

function sentences(text: string): string[] {
  return text
    .replace(/\{Cus:[^}]*\}/g, 'times')
    .replace(/\s+/g, ' ')
    .replace(/\s-\s(?=[A-Z])/g, ' ') // bullet lists: "targets. - Absolution Enhancement: ..."
    .replace(/Crit\. /g, 'Crit\u0000 ')
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((sentence) => sentence.replace(/Crit\u0000/g, 'Crit.').trim())
    .filter((sentence) => sentence.length > 0)
}

/** How a description's numbers map to parameters. */
interface ParamSource {
  /** Ranked (weapons): each token looks like "a/b/c/d/e". Single: plain values. */
  ranked: boolean
  params: readonly (readonly string[])[]
  /** When true, a percentage not in params may still be used if quoted word for word (paramIndex -1). */
  allowLiteral: boolean
}

const RANKED_TOKEN = /\d+(?:\.\d+)?%?(?:\/\d+(?:\.\d+)?%?){4}/g
const SINGLE_TOKEN = /\d+(?:\.\d+)?%?/g

interface Token {
  text: string
  start: number
  end: number
}

function tokens(sentence: string, ranked: boolean): Token[] {
  const pattern = new RegExp(ranked ? RANKED_TOKEN.source : SINGLE_TOKEN.source, 'g')
  return [...sentence.matchAll(pattern)].map((match) => ({ text: match[0], start: match.index ?? 0, end: (match.index ?? 0) + match[0].length }))
}

class ParamCursor {
  private used = new Set<number>()
  constructor(private readonly source: ParamSource) {}

  /** Index of the parameter this token is, or -1 for a literal, or null when it is neither. */
  take(token: string): { index: number; values: number[] } | null {
    const { params, ranked, allowLiteral } = this.source
    const index = params.findIndex((param, i) => !this.used.has(i) && (ranked ? param.join('/') : param[0]) === token)
    const fallback = index >= 0 ? index : params.findIndex((param) => (ranked ? param.join('/') : param[0]) === token)
    if (fallback >= 0) {
      this.used.add(fallback)
      const param = params[fallback] ?? []
      return { index: fallback, values: param.map(percent) }
    }
    if (allowLiteral && !ranked && token.endsWith('%')) return { index: -1, values: [percent(token)] }
    return null
  }
}

interface Parsed {
  modifiers: EffectModifier[]
  hadNumbers: boolean
}

function parseSentence(sentence: string, cursor: ParamCursor, ranked: boolean): Parsed {
  const modifiers: EffectModifier[] = []
  const found = tokens(sentence, ranked)
  let clauseStart = 0
  let previousAmplify = false
  let previousWasGrant = false
  for (const token of found) {
    const left = sentence.slice(clauseStart, token.start)
    const right = sentence.slice(token.end)
    clauseStart = token.end
    if (!token.text.split('/')[0]?.endsWith('%')) continue

    let phrase: string | undefined
    let amplify = false
    let whose = ''
    for (const form of LEFT_FORMS) {
      const match = left.match(form)
      if (match?.groups?.stat) {
        phrase = match.groups.stat
        amplify = /amplif/i.test(match.groups.verb ?? '')
        whose = match.groups.whose ?? ''
        break
      }
    }
    if (!phrase && modifiers.length > 0 && !previousWasGrant) {
      const match = left.match(CONTINUATION)
      if (match?.groups?.stat) {
        phrase = match.groups.stat
        amplify = previousAmplify
      }
    }
    let grant = false
    if (!phrase && (GRANT_LEFT.test(left) || (previousWasGrant && /\band\s+$/i.test(left)))) {
      phrase = right.match(GRANT_RIGHT)?.groups?.stat
      grant = phrase !== undefined
    }

    // "...of Forte Circuit Ice Burst": a bonus to one named skill, not read.
    if (phrase && /^\s+of\s/i.test(whose) && !TEAM.test(whose) && !new RegExp(`\\bof (${TYPE_WORDS}) DMG`, 'i').test(whose)) continue
    // Bare "DMG Amplified" only counts when it is the Resonators' own ("have their DMG Amplified").
    if (phrase?.toLowerCase() === 'dmg' && amplify && !/(?:their|the)\s+DMG\s+(?:(?:is|are)\s+)?amplified\s+by\s+$/i.test(left)) continue

    let target: { stat: StatKey; scope?: Scope } | null = null
    const resReduction = phrase ? null : left.match(RES_REDUCTION)?.groups?.element
    if (phrase) target = mapStat(phrase, amplify)
    else if (resReduction) target = { stat: 'resReduction', scope: { elements: [ELEMENTS_BY_NAME[resReduction.toLowerCase()] ?? 'physical'] } }
    else if (/\bignores?\s+$/i.test(left) && /^\s+of the target's DEF/i.test(right)) {
      const typed = left.match(new RegExp(`(${TYPE_WORDS}) DMG (?:to )?ignores?\\s+$`, 'i'))
      const type = typed ? TYPES_BY_NAME[(typed[1] ?? '').toLowerCase()] : undefined
      target = { stat: 'defIgnore', ...(type ? { scope: { damageTypes: [type] } } : {}) }
    }
    if (!target) continue
    // "the Crit. Rate of Heavy Attack DMG": narrow an unscoped stat to the attack type named after "of".
    const ofType = whose.match(new RegExp(`\\bof (${TYPE_WORDS}) DMG`, 'i'))?.[1]
    const narrowed = ofType ? TYPES_BY_NAME[ofType.toLowerCase()] : undefined
    if (narrowed && !target.scope) target = { ...target, scope: { damageTypes: [narrowed] } }
    const param = cursor.take(token.text)
    if (!param) continue
    previousAmplify = amplify
    previousWasGrant = grant
    modifiers.push({ stat: target.stat, ...(target.scope ? { scope: target.scope } : {}), values: param.values, paramIndex: param.index })
  }
  return { modifiers, hadNumbers: found.length > 0 }
}

/** Stack limit stated in this sentence ("stacking up to 3/3/3/3/3 times") or the next ("This effect stacks up to 4 times"). */
function stackLimit(sentence: string, next: string | undefined, cursor: ParamCursor, ranked: boolean): { max: number; paramIndex?: number } | null {
  const pattern = ranked
    ? /(?:stack(?:ing|s)? up to|up to) (\d+(?:\/\d+){4})(?: stacks| times| time\(s\))?/i
    : /stack(?:ing|s)? up to (\d+)/i
  /** "for up to 14 stacks": a plain number even in a ranked description. */
  const literal = /up to (\d+) stacks/i
  const own = sentence.match(pattern)?.[1] ?? sentence.match(literal)?.[1]
  const following = next && /^This effect stacks up to/i.test(next) ? next.match(pattern)?.[1] : undefined
  const text = own ?? following
  if (!text) return null
  const values = text.split('/').map(Number)
  if (new Set(values).size !== 1 || !values[0]) return null
  const param = cursor.take(text)
  return { max: values[0], ...(param && param.index >= 0 ? { paramIndex: param.index } : {}) }
}

/**
 * "increased by 4%/5%/..., up to 24%/30%/...": stacks up to cap / value, when that is the same
 * whole number at every rank. Returns null when there is no cap, undefined when the cap does
 * not divide evenly (the sentence is then reported, not guessed).
 */
function capLimit(sentence: string, modifiers: readonly EffectModifier[]): { max: number } | null | undefined {
  const cap = sentence.match(CAP)?.[1]
  if (!cap || modifiers.length !== 1) return null
  const caps = cap.split('/').map(percent)
  const values = modifiers[0]?.values ?? []
  if (caps.length !== values.length) return undefined
  const ratios = caps.map((c, i) => c / (values[i] ?? NaN))
  const first = Math.round(ratios[0] ?? NaN)
  return ratios.every((r) => Math.abs(r - first) < 1e-9) && first >= 2 ? { max: first } : undefined
}

export interface ExtractResult {
  effects: EffectDef[]
  unparsed: UnparsedSentence[]
}

export function extractEffects(catalog: Catalog, options: ExtractOptions): ExtractResult {
  const effects: EffectDef[] = []
  const unparsed: UnparsedSentence[] = []
  const skip = new Set((options.skipOwners ?? WEAPON_EFFECTS.map((effect) => effect.owner)).map((owner) => JSON.stringify(owner)))

  const read = (owner: EffectOwner, ownerName: string, idPrefix: string, text: string, source: ParamSource, verified: boolean, sourceId: string, forceTarget?: EffectDef['target']) => {
    if (skip.has(JSON.stringify(owner))) return
    const cursor = new ParamCursor(source)
    const list = sentences(text)
    let count = 0
    list.forEach((sentence, index) => {
      const { modifiers, hadNumbers } = parseSentence(sentence, cursor, source.ranked)
      if (modifiers.length === 0) {
        if (hadNumbers && !BOOKKEEPING.test(sentence)) unparsed.push({ owner: ownerName, ownerKind: owner.kind, sentence })
        return
      }
      const stacks = stackLimit(sentence, list[index + 1], cursor, source.ranked) ?? capLimit(sentence, modifiers)
      if (stacks === undefined) {
        unparsed.push({ owner: ownerName, ownerKind: owner.kind, sentence })
        return
      }
      const conditional =
        CONDITION.test(sentence) || stacks !== null || (owner.kind === 'resonator' && !PLAIN_STAT_SENTENCE.test(sentence))
      const control: EffectControl = stacks
        ? { kind: 'stacks', max: stacks.max, default: 0, ...(stacks.paramIndex !== undefined ? { maxParamIndex: stacks.paramIndex } : {}) }
        : conditional
          ? { kind: 'toggle', default: false }
          : { kind: 'always' }
      count += 1
      effects.push({
        id: `${idPrefix}:${count}`,
        owner,
        name: count === 1 ? ownerName : `${ownerName} (${count})`,
        target: forceTarget ?? (NEXT.test(sentence) ? 'nextResonator' : TEAM.test(sentence) ? 'team' : 'self'),
        control,
        modifiers: stacks ? modifiers.map((m) => ({ ...m, perStack: true })) : modifiers,
        condition: conditional ? sentence : 'Always active.',
        provenance: {
          source: 'authored',
          sourceId: `${sourceId} (read by scripts/data/extract-effects.ts)`,
          verified,
          note: `From: ${sentence}`,
        },
      })
    })
  }

  for (const weapon of Object.values(catalog.weapons)) {
    if (weapon.rarity < 4) continue
    read(
      { kind: 'weapon', id: weapon.id },
      weapon.passive.name ? `${weapon.name}: ${weapon.passive.name}` : weapon.name,
      `weapon:${weapon.id}`,
      weapon.passive.description,
      { ranked: true, params: weapon.passive.params, allowLiteral: false },
      weapon.provenance.verified,
      `weapons.json#${weapon.id}.passive`,
    )
  }

  for (const sonata of Object.values(catalog.sonatas)) {
    for (const piece of sonata.effects) {
      if (piece.fixed.length > 0) continue
      read(
        { kind: 'sonata', id: sonata.id, pieces: piece.pieces },
        `${sonata.name} (${piece.pieces} pieces)`,
        `sonata:${sonata.id}:${piece.pieces}p`,
        piece.description,
        { ranked: false, params: piece.params.map((p) => [p]), allowLiteral: false },
        sonata.provenance.verified,
        `sonatas.json#${sonata.id}.${piece.pieces}`,
      )
    }
  }

  for (const id of options.coreResonatorIds) {
    const resonator = catalog.resonators[id]
    if (!resonator) continue
    for (const node of resonator.sequences) {
      read(
        { kind: 'resonator', id, sequence: node.index },
        `${resonator.name} Sequence ${node.index}: ${node.name}`,
        `resonator:${id}:s${node.index}`,
        node.description,
        { ranked: false, params: node.params.map((p) => [p]), allowLiteral: false },
        resonator.provenance.verified,
        `resonators/${id}.json#sequences[${node.index}]`,
      )
    }
    for (const skill of resonator.skills.filter((s) => s.type === 'inherent' || s.type === 'outro')) {
      read(
        { kind: 'resonator', id, skillId: skill.id },
        `${resonator.name}: ${skill.name}`,
        `resonator:${id}:k${skill.id}`,
        skill.description,
        { ranked: false, params: [], allowLiteral: true },
        resonator.provenance.verified,
        `resonators/${id}.json#skills[${skill.id}]`,
        skill.type === 'outro' && !TEAM.test(skill.description) ? 'nextResonator' : undefined,
      )
    }
  }

  for (const echo of Object.values(catalog.echoes)) {
    if (echo.cost === 1) continue
    const params = echo.skill.params.at(-1) ?? []
    read(
      { kind: 'echo', id: echo.id },
      `${echo.name} (main Echo)`,
      `echo:${echo.id}`,
      echo.skill.description,
      { ranked: false, params: params.map((p) => [p]), allowLiteral: false },
      echo.provenance.verified,
      `echoes.json#${echo.id}.skill`,
    )
  }

  return { effects, unparsed }
}
