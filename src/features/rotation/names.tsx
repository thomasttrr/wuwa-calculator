import { Flame, LogIn, LogOut, Sparkles, Sword, Waves, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { actionDisplayName, SKILL_TYPE_NAME } from '../../engine/rotation/action'
import type { ActionDef, ResonatorDef, SkillType } from '../../engine/types/catalog'
import type { DamageType } from '../../engine/types/stats'

export const SKILL_ICON: Record<SkillType, LucideIcon> = {
  normal: Sword,
  skill: Sparkles,
  forte: Flame,
  liberation: Zap,
  intro: LogIn,
  outro: LogOut,
  inherent: Waves,
  tuneBreak: Waves,
}

export const TYPE_COLOUR: Record<DamageType, string> = {
  basic: 'var(--color-type-basic)',
  heavy: 'var(--color-type-heavy)',
  skill: 'var(--color-type-skill)',
  liberation: 'var(--color-type-liberation)',
  intro: 'var(--color-type-intro)',
  outro: 'var(--color-type-outro)',
  echo: 'var(--color-type-echo)',
  tuneRupture: 'var(--color-type-tune-rupture)',
  other: 'var(--color-type-other)',
}

export interface ActionName {
  name: string
  skill: string
  Icon: LucideIcon
}

/** The plain name of an action: the game's own, with its skill when two share a name. Never an id. */
export function nameOf(resonator: ResonatorDef | undefined, actionId: number): ActionName {
  const action: ActionDef | undefined = resonator?.actions.find((a) => a.id === actionId)
  if (!resonator || !action) return { name: 'Unknown action', skill: '', Icon: Waves }
  return { name: actionDisplayName(resonator, action), skill: SKILL_TYPE_NAME[action.skillType], Icon: SKILL_ICON[action.skillType] }
}
