import type { Workspace } from '../types'

/** Raise this and add a step below whenever the saved shape changes. */
export const CURRENT_SCHEMA_VERSION = 3

type Step = (raw: Record<string, unknown>) => Record<string, unknown>

const RESISTANCE_DEFAULTS = { physical: 0.1, glacio: 0.1, fusion: 0.1, electro: 0.1, aero: 0.1, spectro: 0.1, havoc: 0.1 }

/** STEPS[n] turns a version n save into version n + 1. */
const STEPS: Record<number, Step> = {
  // 2: saved rotations.
  1: (raw) => ({
    ...raw,
    library: { ...(raw.library as Record<string, unknown>), rotations: [] },
    meta: { ...(raw.meta as Record<string, unknown>), schemaVersion: 2 },
  }),
  // 3: defaults for new builds (target level and resistances).
  2: (raw) => {
    const meta = raw.meta as Record<string, unknown>
    const settings = (meta.settings ?? {}) as Record<string, unknown>
    return {
      ...raw,
      meta: {
        ...meta,
        schemaVersion: 3,
        settings: {
          playerName: '',
          playerId: '',
          showEverything: false,
          highContrast: false,
          reduceMotion: false,
          defaultTargetLevel: 100,
          defaultResistances: RESISTANCE_DEFAULTS,
          ...settings,
        },
      },
    }
  },
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Brings any saved workspace up to the current version, or explains in plain words why it cannot. */
export function migrate(raw: unknown): Workspace {
  if (!isObject(raw) || !isObject(raw.meta) || typeof raw.meta.schemaVersion !== 'number' || !isObject(raw.library)) {
    throw new Error('This file is not a theWuthering save.')
  }
  let version = raw.meta.schemaVersion
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error('This save comes from a newer version of theWuthering. Update the app to open it.')
  }
  let current: Record<string, unknown> = raw
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = STEPS[version]
    if (!step) throw new Error(`No way to update a version ${version} save.`)
    current = step(current)
    version += 1
  }
  return current as unknown as Workspace
}
