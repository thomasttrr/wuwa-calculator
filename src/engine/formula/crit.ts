// Critical hits.

/**
 * Long-run average damage multiplier from crits: 1 + rate x (Crit. DMG - 1).
 * critRate is a fraction held between 0 and 1. critDmg is the full multiplier (1.5 = 150%).
 */
export function critAverage(critRate: number, critDmg: number): number {
  const rate = Math.min(Math.max(critRate, 0), 1)
  return 1 + rate * (critDmg - 1)
}
