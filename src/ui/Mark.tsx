// Neutral text marks that travel with any number they affect (DESIGN.md, "Marks").

export type MarkKind = 'unverified' | 'beta' | 'basic' | 'notModelled' | 'custom'

const WORD: Record<MarkKind, string> = {
  unverified: 'Unverified',
  beta: 'Beta',
  basic: 'Basic model',
  notModelled: 'Not modelled',
  custom: 'Your value',
}

const EXPLAIN: Record<MarkKind, string> = {
  unverified: 'The two data sources disagree, or only one has this value.',
  beta: 'From a game version that is not live yet.',
  basic: "This Resonator's special mechanics are not encoded. Stats and skill multipliers are real.",
  notModelled: 'No public formula describes this, so it is left out of totals.',
  custom: 'A value you typed in yourself.',
}

export function Mark({ kind, detail }: { kind: MarkKind; detail?: string }) {
  return (
    <span
      title={detail ?? EXPLAIN[kind]}
      className="inline-flex shrink-0 items-center rounded-control border border-rule-strong px-1.5 py-px text-12 leading-5 text-ink"
    >
      {WORD[kind]}
    </span>
  )
}

export function markExplanation(kind: MarkKind): string {
  return EXPLAIN[kind]
}
