import { BookOpen, Calculator, GitCompareArrows, Gauge } from 'lucide-react'
import { useMemo } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { useCatalog } from '../../app/context'
import { useResults } from '../../app/results'
import { buildLedger } from '../../engine/ledger/ledger'
import { GRADE_BANDS } from '../../engine/score/score'
import { formatDamage, formatPercent, formatStatValue } from '../../ui/format'
import { Mark } from '../../ui/Mark'
import { Section } from '../../ui/Section'

const LINKS = [
  { to: '/guide', label: 'Overview', end: true },
  { to: '/guide/score', label: 'The score' },
  { to: '/guide/formula', label: 'The formula' },
  { to: '/guide/comparing', label: 'Comparing fairly' },
] as const

export function GuidePage() {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-26 md:text-34">Guide</h1>
          <p className="mt-2 max-w-[64ch] text-ink-2">What the numbers mean, how one hit is worked out, and when two builds can be compared.</p>
        </div>
        <p className="text-13 text-ink-3">Every example uses the build that is open now.</p>
      </div>

      <nav aria-label="Guide sections" className="mt-5 grid grid-cols-2 gap-1 border-b border-rule sm:flex sm:flex-wrap">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={'end' in link ? link.end : false}
            className={({ isActive }) =>
              `min-h-11 rounded-t-control px-3 py-2 text-center text-14 sm:text-left ${
                isActive ? 'bg-raised font-semibold text-ink shadow-[inset_0_-3px_0_var(--color-signal)]' : 'text-ink-2 hover:bg-raised hover:text-ink'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-4">
        <Outlet />
      </div>
    </div>
  )
}

function NoBuild() {
  return (
    <Section title="Open a build first" id="guide-no-build">
      <p className="text-ink-2">The worked examples need a build. Open one and come back.</p>
      <Link to="/build" className="mt-3 inline-flex min-h-11 items-center rounded-control bg-signal px-4 text-14 font-semibold text-on-signal md:min-h-9">
        Open the Build tool
      </Link>
    </Section>
  )
}

export function GuideOverview() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <GuideCard
        icon={<Gauge size={20} aria-hidden="true" />}
        title="The score"
        text="A fixed scale for this exact setup: 0 is no Echoes, 100 is the reference build, 200 is the maximum. The grade is just a shorter way to say where it sits."
        to="/guide/score"
      />
      <GuideCard
        icon={<Calculator size={20} aria-hidden="true" />}
        title="The formula"
        text="One hit, term by term, with your own stats in it. The same functions build the number and the explanation, so they cannot drift apart."
        to="/guide/formula"
      />
      <GuideCard
        icon={<GitCompareArrows size={20} aria-hidden="true" />}
        title="Comparing fairly"
        text="A score belongs to one setup. Change the rotation, team or target and the scale changes too. Here is what must match."
        to="/guide/comparing"
      />
      <GuideCard
        icon={<BookOpen size={20} aria-hidden="true" />}
        title="What this app does not do"
        text="No invented values. Anything without a public formula is left out of totals and marked Not modelled. Energy is shown, but whether a rotation can afford its Liberation is not checked."
        to="/build"
      />
    </div>
  )
}

function GuideCard({ icon, title, text, to }: { icon: React.ReactNode; title: string; text: string; to: string }) {
  return (
    <Link to={to} className="rounded-section bg-panel p-4 hover:bg-raised md:p-6">
      <span className="flex items-center gap-2 font-display text-16">
        {icon}
        {title}
      </span>
      <span className="mt-2 block text-ink-2">{text}</span>
      <span className="mt-3 inline-flex items-center text-14 font-medium text-ink">Read more</span>
    </Link>
  )
}

export function GuideScore() {
  const results = useResults()
  if (!results?.score) return <NoBuild />
  const { score } = results
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Section title="What the number means" id="score-meaning">
        <p className="text-ink-2">
          The score keeps your Echoes, their sets, the main Echo, weapon, team, rotation and target exactly as they are. Only the stats on the Echoes move.
        </p>
        <dl className="mt-4 divide-y divide-rule border-y border-rule">
          <ScaleRow label="0%, no Echoes" value={score.anchors.baseline} />
          <ScaleRow label="100%, reference" value={score.anchors.reference} detail="Best main stats, and three useful substats on each Echo at their average roll." />
          <ScaleRow label="200%, maximum" value={score.anchors.maximum} detail="Best main stats, and five useful substats on each Echo at their highest roll." />
          <ScaleRow label="This build" value={score.percent} text={`${score.percent.toFixed(1)}%`} />
        </dl>
        <p className="mt-3 text-ink-2">The percentage is linear between those points and keeps going past them. It is not a rating of the Resonator or of your skill.</p>
      </Section>

      <Section title="Grades and limits" id="score-grades">
        <p className="text-ink-2">Grades are fixed bands on the same percentage.</p>
        <ul className="mt-3 grid gap-1 text-14">
          {GRADE_BANDS.slice(1).map((band) => (
            <li key={band.grade} className="flex justify-between border-b border-rule py-1.5">
              <span>{band.grade}</span>
              <span className="text-ink-3">from {band.from}%</span>
            </li>
          ))}
          <li className="flex justify-between py-1.5">
            <span>F</span>
            <span className="text-ink-3">below 25%</span>
          </li>
        </ul>
        <p className="mt-3 text-13 text-ink-3">Energy Regen is not valued by the score. If a rotation needs more of it, that is a cost the score does not see.</p>
        <p className="mt-2 text-13 text-ink-3">A change of weapon, team, rotation or target re-scales the whole ruler. Two percentages from different setups are not comparable.</p>
      </Section>
    </div>
  )
}

function ScaleRow({ label, value, detail, text }: { label: string; value: number; detail?: string; text?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt>
        <span className="text-ink">{label}</span>
        {detail ? <span className="block text-13 text-ink-3">{detail}</span> : null}
      </dt>
      <dd className="shrink-0 tabular-nums text-ink">{text ?? formatDamage(value)}</dd>
    </div>
  )
}

const TERM_LABEL: Record<string, string> = {
  base: 'Base damage',
  dmgBonus: 'DMG Bonus',
  amplify: 'DMG Amplify',
  special: 'Special DMG',
  defense: 'Enemy DEF',
  resistance: 'Enemy RES',
}

export function GuideFormula() {
  const catalog = useCatalog()
  const results = useResults()
  const ledger = useMemo(() => (results ? buildLedger(results.build, catalog) : null), [results, catalog])
  if (!results || !ledger) return <NoBuild />
  const { build, simulation } = results
  const step = simulation.steps.find((entry) => entry.action.parts.length > 0)
  const part = step?.action.parts[0]
  const total = ledger.entries.find((entry) => entry.id === 'rotation.total')

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Section title="One hit, with your numbers" id="formula-hit">
        {part && step ? (
          <>
            <p className="text-ink-2">
              {step.action.name}, one hit. This is the same working the Build page opens from the hit list.
            </p>
            <ol className="mt-4 grid gap-2">
              <li className="rounded-panel bg-raised px-3 py-2">
                <span className="block text-12 text-ink-3">Base damage</span>
                <span className="font-display text-16 tabular-nums">
                  {formatStatValue(part.formula.scalingStat === 'atk' ? 'atkFlat' : 'hpFlat', part.formula.scalingValue)} x{' '}
                  {formatPercent(part.formula.multiplier, 2)}
                  {part.formula.flat > 0 ? ` + ${formatDamage(part.formula.flat)}` : ''}
                </span>
              </li>
              {part.formula.terms
                .filter((term) => term.key !== 'base')
                .map((term) => (
                  <li key={term.key} className="flex items-center justify-between border-b border-rule py-1.5">
                    <span className="text-ink-2">{TERM_LABEL[term.key] ?? term.key}</span>
                    <span className="tabular-nums text-ink">x {term.value.toFixed(4)}</span>
                  </li>
                ))}
              <li className="flex items-center justify-between pt-1.5">
                <span className="text-ink-2">Crit average</span>
                <span className="tabular-nums text-ink">x {part.formula.critAverage.toFixed(4)}</span>
              </li>
            </ol>
            <p className="mt-3 text-13 text-ink-3">
              Crit. Rate {formatPercent(part.formula.critRate)}, Crit. DMG {formatPercent(part.formula.critDmg)}. The average counts a crit at its chance.
            </p>
            <p className="mt-2 text-13 text-ink-3">
              Enemy level {part.formula.defense.enemyLevel}, enemy DEF {formatDamage(part.formula.defense.enemyDef)}. Resistance after reductions{' '}
              {formatPercent(part.formula.resistance.total)}.
            </p>
            {part.hasUnverified ? <Mark kind="unverified" /> : null}
          </>
        ) : (
          <p className="text-ink-2">This rotation has no counted hits yet. Add a step on the Build page.</p>
        )}
      </Section>

      <Section title="The whole rotation" id="formula-rotation">
        <p className="text-ink-2">The rotation total is a sum of every counted hit, not a separate estimate.</p>
        {total ? (
          <>
            <dl className="mt-4 divide-y divide-rule border-y border-rule">
              {total.parts.map((entry) => (
                <div key={entry.label} className="flex justify-between gap-4 py-1.5">
                  <dt className="text-ink-2">{entry.label}</dt>
                  <dd className="tabular-nums text-ink">{formatDamage(entry.value)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 py-2 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatDamage(total.value)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-13 text-ink-3">
              {build.rotation.name}. {simulation.steps.length} counted {simulation.steps.length === 1 ? 'step' : 'steps'}.
              {total.note ? ` ${total.note}` : ''}
            </p>
          </>
        ) : null}
        <p className="mt-3 text-13 text-ink-3">
          The formula is the community damage formula, with enemy DEF and resistance worked from the target's level and resistances. Unverified inputs carry a mark wherever they touch a number.
        </p>
      </Section>
    </div>
  )
}

export function GuideComparing() {
  const catalog = useCatalog()
  const results = useResults()
  if (!results) return <NoBuild />
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Section title="What must match" id="setup-match">
        <p className="text-ink-2">Two Build Scores can be compared only when these are identical:</p>
        <ul className="mt-3 grid gap-2">
          {[
            'The Resonator, level, Sequence and skill levels.',
            'The weapon, its level and refinement rank.',
            'The same Echoes, sets and main Echo.',
            'The same teammates and their buffs.',
            'The same rotation, including loops and step buffs.',
            'The same enemy level and resistances.',
            'The same patch and data date.',
          ].map((item) => (
            <li key={item} className="flex gap-2 text-14 text-ink-2">
              <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-signal" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-13 text-ink-3">The setup fingerprint changes when any of these change. A different fingerprint means a different ruler.</p>
      </Section>

      <Section title="This build's setup" id="setup-now">
        <p className="text-ink-2">The score on the Build page belongs to this fingerprint.</p>
        <p className="mt-2 rounded-panel bg-raised px-3 py-2 font-display text-16 tabular-nums">{results.fingerprint}</p>
        <dl className="mt-4 grid gap-2 text-14">
          <div className="flex justify-between gap-4 border-b border-rule py-1.5">
            <dt className="text-ink-2">Rotation</dt>
            <dd>{results.build.rotation.name}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-rule py-1.5">
            <dt className="text-ink-2">Target level</dt>
            <dd>{results.build.enemy.level}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-rule py-1.5">
            <dt className="text-ink-2">Teammates</dt>
            <dd>{results.build.teammates.filter(Boolean).length}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1.5">
            <dt className="text-ink-2">Patch</dt>
            <dd>{catalog.gameVersion}</dd>
          </div>
        </dl>
        <p className="mt-3 text-13 text-ink-3">To compare two builds, use Compare. It lists the setup differences in plain words and says whether the scores can be set side by side.</p>
        <Link to="/compare" className="mt-3 inline-flex min-h-11 items-center rounded-control border border-rule px-4 text-14 font-medium text-ink hover:bg-raised md:min-h-9">
          Open Compare
        </Link>
      </Section>
    </div>
  )
}
