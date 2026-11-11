// Downloads source data into data/raw/ (git-ignored, untrimmed).
// Resumable: a file that already exists is skipped. Pass --force to re-download.
// Polite: one request at a time, about 3 per second, generic client name.
// Sources and their terms are recorded in CLAUDE.md under "Data sources".
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const FORCE = process.argv.includes('--force')
const DELAY_MS = 340
const HEADERS = { 'User-Agent': 'wuwa-calculator-local-build', Accept: 'application/json' }

const ENCORE = 'https://api-v2.encore.moe/api/en'
const NANOKA = 'https://static.nanoka.cc'
const ARIKATSU_SHA = '49d65625340a32cec6851a12baedc03b5a630b25'
const ARIKATSU = `https://raw.githubusercontent.com/Arikatsu/WutheringWaves_Data/${ARIKATSU_SHA}`

const ARIKATSU_FILES = [
  'BinData/phantom/phantommainproperty.json',
  'BinData/phantom/phantommainpropitem.json',
  'BinData/phantom/phantomgrowth.json',
  'BinData/phantom/phantomsubproperty.json',
  'BinData/phantom/phantomsubpropaction.json',
  'BinData/phantom/phantomlevel.json',
  'BinData/phantom/phantomquality.json',
  'BinData/phantom/phantomrarity.json',
  'BinData/phantom/phantomfetter.json',
  'BinData/phantom/phantomfettergroup.json',
  'BinData/property/propertyindex.json',
  'BinData/property/rolepropertygrowth.json',
  'BinData/property/weaponpropertygrowth.json',
  // English names of the stat ids, in id order. Confirms which id is which stat.
  'Textmaps/en/property/PropertyIndex.json',
  'README.md',
]

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))

let requests = 0
let skipped = 0
const failures: string[] = []

async function download(url: string, file: string, optional = false): Promise<string | null> {
  const path = resolve('data/raw', file)
  if (!FORCE && existsSync(path)) {
    skipped += 1
    return readFileSync(path, 'utf8')
  }
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await sleep(DELAY_MS * attempt)
    requests += 1
    try {
      const response = await fetch(url, { headers: HEADERS })
      if (response.status === 404 && optional) return null
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const text = await response.text()
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, text)
      return text
    } catch (error) {
      if (attempt === 3) {
        failures.push(`${url}: ${(error as Error).message}`)
        return null
      }
    }
  }
  return null
}

async function json<T>(url: string, file: string, optional = false): Promise<T | null> {
  const text = await download(url, file, optional)
  if (text === null) return null
  try {
    return JSON.parse(text) as T
  } catch {
    failures.push(`${url}: response is not JSON`)
    return null
  }
}

async function fetchEncore(): Promise<number[]> {
  const characters = await json<{ roleList: { Id: number }[] }>(`${ENCORE}/character`, 'encore/character.json')
  const weapons = await json<{ weapons: { Id: number }[] }>(`${ENCORE}/weapon`, 'encore/weapon.json')
  const echoes = await json<{ Echo: { Id: number }[] }>(`${ENCORE}/echo`, 'encore/echo.json')
  const monsters = await json<{ monsterList: { Id: number }[] }>(`${ENCORE}/monster`, 'encore/monster.json')

  const groups: [string, { Id: number }[]][] = [
    ['character', characters?.roleList ?? []],
    ['weapon', weapons?.weapons ?? []],
    ['echo', echoes?.Echo ?? []],
    ['monster', monsters?.monsterList ?? []],
  ]
  for (const [kind, list] of groups) {
    console.log(`encore ${kind}: ${list.length}`)
    for (const { Id } of list) {
      await json(`${ENCORE}/${kind}/${Id}`, `encore/${kind}/${Id}.json`)
    }
  }
  return (characters?.roleList ?? []).map((role) => role.Id)
}

async function fetchNanoka(characterIds: number[]): Promise<void> {
  const manifest = await json<{ ww?: { latest?: string; live?: string } }>(`${NANOKA}/manifest.json`, 'nanoka/manifest.json')
  const live = manifest?.ww?.live ?? manifest?.ww?.latest
  if (!live) {
    failures.push('nanoka manifest has no ww.live version')
    return
  }
  console.log(`nanoka live version: ${live}`)
  const base = `${NANOKA}/ww/${live}`
  await json(`${base}/character.json`, `nanoka/${live}/character.json`, true)
  const weapons = await json<Record<string, unknown>>(`${base}/weapon.json`, `nanoka/${live}/weapon.json`)
  await json(`${base}/echo.json`, `nanoka/${live}/echo.json`)
  for (const id of characterIds) {
    await json(`${base}/en/character/${id}.json`, `nanoka/${live}/character/${id}.json`, true)
  }
  for (const id of Object.keys(weapons ?? {})) {
    await json(`${base}/en/weapon/${id}.json`, `nanoka/${live}/weapon/${id}.json`, true)
  }
}

async function fetchArikatsu(): Promise<void> {
  for (const file of ARIKATSU_FILES) {
    await download(`${ARIKATSU}/${file}`, `arikatsu/${file}`)
  }
  mkdirSync(resolve('data/raw/arikatsu'), { recursive: true })
  writeFileSync(resolve('data/raw/arikatsu/PINNED_COMMIT'), `${ARIKATSU_SHA}\n`)
}

const startedAt = new Date().toISOString()
const characterIds = await fetchEncore()
await fetchNanoka(characterIds)
await fetchArikatsu()

writeFileSync(
  resolve('data/raw/fetch-log.json'),
  `${JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), requests, skipped, failures }, null, 2)}\n`,
)
console.log(`done: ${requests} requests, ${skipped} already present, ${failures.length} failures`)
if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exitCode = 1
}
