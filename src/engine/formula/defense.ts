// Defence. Source: Wuthering Waves Wiki (Fandom, CC-BY-SA), "Damage", section "DEF Multiplier".

/** Enemy DEF = 8 x enemy level + 792. */
export function enemyDefense(enemyLevel: number): number {
  return 8 * enemyLevel + 792
}

/**
 * Share of damage that gets through the enemy's defence.
 *   (800 + 8 x attacker level) / (800 + 8 x attacker level + effective enemy DEF)
 * DEF reduction is a change to the enemy's stat and applies first; DEF ignore then
 * skips a share of what is left. Both are fractions (0.1 = 10%) held between 0 and 1.
 */
export function defMultiplier(
  attackerLevel: number,
  enemyLevel: number,
  defIgnore: number,
  defReduction: number,
): number {
  const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1)
  const attacker = 800 + 8 * attackerLevel
  const effectiveDefense = enemyDefense(enemyLevel) * (1 - clamp01(defReduction)) * (1 - clamp01(defIgnore))
  return attacker / (attacker + effectiveDefense)
}
