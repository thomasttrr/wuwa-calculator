// Resistance. Source: Wuthering Waves Wiki (Fandom, CC-BY-SA), "Damage", section "RES Multiplier".

/**
 * Share of damage that gets through the enemy's resistance to the attack's element.
 * totalRes is the enemy's resistance after any reductions, as a fraction (0.1 = 10%).
 *   below 0     : 1 - RES / 2
 *   0 to 0.8    : 1 - RES
 *   0.8 and up  : 1 / (1 + 5 x RES)
 */
export function resMultiplier(totalRes: number): number {
  if (totalRes < 0) return 1 - totalRes / 2
  if (totalRes < 0.8) return 1 - totalRes
  return 1 / (1 + 5 * totalRes)
}
