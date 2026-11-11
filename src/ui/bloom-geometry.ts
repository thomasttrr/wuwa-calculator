// Geometry of the Echo bloom: five petals (one per Echo slot, clockwise from the top), each made of
// one wedge per substat. A wedge's length grows with the roll tier, relative to that stat's tier count.

export const BLOOM = {
  size: 640,
  centre: 320,
  inner: 104,
  minLength: 40,
  maxExtra: 150,
  petal: 72,
  wedge: 11.6,
  step: 13.6,
} as const

export interface BloomInput {
  subs: readonly { tier: number; tiers: number }[]
}

export interface Wedge<T> {
  slot: number
  index: number
  from: number
  to: number
  outer: number
  d: string
  sub: T
}

function point(deg: number, r: number): string {
  const a = (deg * Math.PI) / 180
  return `${(BLOOM.centre + r * Math.cos(a)).toFixed(2)} ${(BLOOM.centre + r * Math.sin(a)).toFixed(2)}`
}

export function petalStart(slot: number): number {
  return -90 - BLOOM.petal / 2 + slot * BLOOM.petal
}

export function arcPath(from: number, to: number, r: number): string {
  return `M ${point(from, r)} A ${r} ${r} 0 0 1 ${point(to, r)}`
}

export function bloomWedges<T extends { tier: number; tiers: number }>(echoes: readonly ({ subs: readonly T[] } | null)[]): Wedge<T>[] {
  const wedges: Wedge<T>[] = []
  echoes.forEach((echo, slot) => {
    if (!echo) return
    const start = petalStart(slot)
    echo.subs.slice(0, 5).forEach((sub, index) => {
      const from = start + 3 + index * BLOOM.step
      const to = from + BLOOM.wedge
      const quality = sub.tiers > 0 ? Math.min(1, Math.max(0, sub.tier / sub.tiers)) : 0
      const outer = BLOOM.inner + BLOOM.minLength + BLOOM.maxExtra * quality
      const ri = BLOOM.inner
      const d = `M ${point(from, ri)} L ${point(from, outer)} A ${outer} ${outer} 0 0 1 ${point(to, outer)} L ${point(to, ri)} A ${ri} ${ri} 0 0 0 ${point(from, ri)} Z`
      wedges.push({ slot, index, from, to, outer, d, sub })
    })
  })
  return wedges
}
