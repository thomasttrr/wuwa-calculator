// Searchable pickers for Resonators, weapons, Echoes and enemies, shown in a sheet.
import { useMemo } from 'react'
import { useCatalog } from '../../app/context'
import { CORE_RESONATOR_IDS } from '../../../data/authored/core-set'
import type { EchoCost, WeaponType } from '../../engine/types/catalog'
import { ElementChip, Portrait } from '../../ui/ElementChip'
import { ELEMENT_NAME, formatPercent } from '../../ui/format'
import { Mark } from '../../ui/Mark'
import { Picker } from '../../ui/Picker'
import type { PickerFilter, PickerItem } from '../../ui/Picker'
import { Sheet } from '../../ui/Sheet'

export const WEAPON_NAME: Record<WeaponType, string> = {
  broadblade: 'Broadblade',
  sword: 'Sword',
  pistols: 'Pistols',
  gauntlets: 'Gauntlets',
  rectifier: 'Rectifier',
}

const ELEMENT_FILTER: PickerFilter = {
  facet: 'element',
  label: 'Element',
  options: (['glacio', 'fusion', 'electro', 'aero', 'spectro', 'havoc'] as const).map((e) => ({ value: e, label: ELEMENT_NAME[e] })),
}
const WEAPON_FILTER: PickerFilter = {
  facet: 'weapon',
  label: 'Weapon type',
  options: (Object.keys(WEAPON_NAME) as WeaponType[]).map((w) => ({ value: w, label: WEAPON_NAME[w] })),
}
const RARITY_FILTER: PickerFilter = {
  facet: 'rarity',
  label: 'Rarity',
  options: [
    { value: '5', label: '5 star' },
    { value: '4', label: '4 star' },
  ],
}

interface SheetPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (id: number) => void
  selectedId?: number
}

export function ResonatorPicker({ open, onOpenChange, onPick, selectedId, title = 'Choose a Resonator' }: SheetPickerProps & { title?: string }) {
  const catalog = useCatalog()
  const items = useMemo<PickerItem[]>(
    () =>
      Object.values(catalog.resonators)
        .sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name))
        .map((resonator) => {
          const full = CORE_RESONATOR_IDS.includes(resonator.id)
          return {
            id: String(resonator.id),
            label: resonator.name,
            detail: `${resonator.rarity} star, ${ELEMENT_NAME[resonator.element]}, ${WEAPON_NAME[resonator.weaponType]}`,
            lead: <Portrait name={resonator.name} element={resonator.element} />,
            trail: full ? undefined : <Mark kind="basic" />,
            facets: { element: resonator.element, weapon: resonator.weaponType, rarity: String(resonator.rarity), model: full ? 'full' : 'basic' },
          }
        }),
    [catalog],
  )
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} description="Resonators marked Basic model have real stats and skill values, but their special mechanics are not encoded.">
      <Picker
        items={items}
        selectedId={selectedId === undefined ? undefined : String(selectedId)}
        onPick={(id) => onPick(Number(id))}
        searchLabel="Search by name"
        emptyText="No Resonator matches. Clear a filter or change the search."
        filters={[
          ELEMENT_FILTER,
          WEAPON_FILTER,
          RARITY_FILTER,
          { facet: 'model', label: 'Model', options: [{ value: 'full', label: 'Fully modelled' }, { value: 'basic', label: 'Basic model' }] },
        ]}
      />
    </Sheet>
  )
}

export function WeaponPicker({ open, onOpenChange, onPick, selectedId, weaponType }: SheetPickerProps & { weaponType: WeaponType }) {
  const catalog = useCatalog()
  const items = useMemo<PickerItem[]>(() => {
    const modelled = new Set(catalog.effects.filter((e) => e.owner.kind === 'weapon').map((e) => e.owner.id))
    return Object.values(catalog.weapons)
      .filter((weapon) => weapon.weaponType === weaponType)
      .sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name))
      .map((weapon) => {
        const top = weapon.growth.at(-1)
        return {
          id: String(weapon.id),
          label: weapon.name,
          detail: `${weapon.rarity} star, ATK ${Math.round(top?.atk ?? 0)}, ${weaponSecondaryLabel(weapon.secondaryStat)} ${formatPercent(top?.secondary ?? 0)}`,
          keywords: weapon.passive.name,
          trail: weapon.rarity >= 4 && !modelled.has(weapon.id) ? <Mark kind="notModelled" detail="This weapon's passive effect is not modelled." /> : undefined,
          facets: { rarity: String(weapon.rarity) },
        }
      })
  }, [catalog, weaponType])
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Choose a ${WEAPON_NAME[weaponType]}`}>
      <Picker
        items={items}
        selectedId={selectedId === undefined ? undefined : String(selectedId)}
        onPick={(id) => onPick(Number(id))}
        searchLabel="Search by name or passive"
        emptyText="No weapon matches. Change the search."
        filters={[
          {
            facet: 'rarity',
            label: 'Rarity',
            options: [5, 4, 3, 2, 1].map((r) => ({ value: String(r), label: `${r} star` })),
          },
        ]}
      />
    </Sheet>
  )
}

export function weaponSecondaryLabel(stat: string): string {
  return (
    {
      atkPct: 'ATK',
      hpPct: 'HP',
      defPct: 'DEF',
      critRate: 'Crit. Rate',
      critDmg: 'Crit. DMG',
      energyRegen: 'Energy Regen',
    }[stat] ?? stat
  )
}

export function EchoPicker({ open, onOpenChange, onPick, selectedId, maxCost }: SheetPickerProps & { maxCost: number }) {
  const catalog = useCatalog()
  const items = useMemo<PickerItem[]>(
    () =>
      Object.values(catalog.echoes)
        .filter((echo) => echo.cost <= maxCost)
        .sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name))
        .map((echo) => {
          const sets = echo.sonataIds.map((id) => catalog.sonatas[id]?.name ?? '').filter(Boolean)
          return {
            id: String(echo.id),
            label: echo.name,
            detail: `Cost ${echo.cost}. ${sets.join(', ')}`,
            keywords: sets.join(' '),
            lead: <CostBadge cost={echo.cost} />,
            facets: { cost: String(echo.cost), ...Object.fromEntries(echo.sonataIds.map((id) => [`set${id}`, '1'])) },
          }
        }),
    [catalog, maxCost],
  )
  const costs = ([4, 3, 1] as EchoCost[]).filter((cost) => cost <= maxCost)
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Choose an Echo" description={`This slot can hold an Echo costing up to ${maxCost}.`}>
      <Picker
        items={items}
        selectedId={selectedId === undefined ? undefined : String(selectedId)}
        onPick={(id) => onPick(Number(id))}
        searchLabel="Search by Echo or Sonata set"
        emptyText="No Echo matches. Change the search or the cost filter."
        filters={[{ facet: 'cost', label: 'Cost', options: costs.map((c) => ({ value: String(c), label: `Cost ${c}` })) }]}
      />
    </Sheet>
  )
}

export function CostBadge({ cost }: { cost: number }) {
  return (
    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-page font-display text-14" title={`Cost ${cost}`}>
      {cost}
      <span className="sr-only"> cost</span>
    </span>
  )
}

export function EnemyPicker({ open, onOpenChange, onPick, selectedId }: SheetPickerProps) {
  const catalog = useCatalog()
  const items = useMemo<PickerItem[]>(
    () =>
      Object.values(catalog.enemies)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((enemy) => {
          const high = (Object.entries(enemy.resistance) as [keyof typeof ELEMENT_NAME, number][]).filter(([, value]) => value > 0.1)
          return {
            id: String(enemy.id),
            label: enemy.name,
            detail: `${enemy.rank}. ${high.length > 0 ? high.map(([e, v]) => `${ELEMENT_NAME[e]} ${formatPercent(v, 0)}`).join(', ') : 'All resistances 10%'}`,
            trail: enemy.provenance.verified ? undefined : <Mark kind="unverified" />,
            lead: <ElementChip element={(high[0]?.[0] ?? 'physical')} showName={false} />,
            facets: { rank: enemy.rank },
          }
        }),
    [catalog],
  )
  const ranks = [...new Set(Object.values(catalog.enemies).map((e) => e.rank))]
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Choose a target" description="Resistances come from the game data. You set the level.">
      <Picker
        items={items}
        selectedId={selectedId === undefined ? undefined : String(selectedId)}
        onPick={(id) => onPick(Number(id))}
        searchLabel="Search enemies"
        emptyText="No enemy matches. Change the search."
        filters={[{ facet: 'rank', label: 'Class', options: ranks.map((r) => ({ value: r, label: r })) }]}
      />
    </Sheet>
  )
}
