import { useMemo, useState } from 'react'
import { useCatalog, useWorkspace } from '../../app/context'
import { useResults } from '../../app/results'
import { CORE_RESONATOR_IDS } from '../../../data/authored/core-set'
import { formatDataDate } from '../../data/catalog'
import { buildVerdict } from '../../explain/verdict'
import { GRADE_BANDS } from '../../engine/score/score'
import { BorderBeam } from '../../ui/BorderBeam'
import { Button } from '../../ui/Button'
import { ELEMENT_NAME, formatDamage, formatStatValue } from '../../ui/format'
import { Mark } from '../../ui/Mark'
import { Meter } from '../../ui/Meter'
import { Sheet } from '../../ui/Sheet'
import { EchoBloom, TONE_LEGEND } from './EchoBloom'
import { LedgerSheet } from './LedgerSheet'
import { WEAPON_NAME } from './pickers'

export function Stamp() {
  const catalog = useCatalog()
  return (
    <p className="text-12 text-ink-3">
      Patch {catalog.gameVersion}, data from {formatDataDate(catalog.dataDate)}
    </p>
  )
}

export function ScorePanel() {
  const catalog = useCatalog()
  const results = useResults()
  const activeId = useWorkspace((s) => s.session.activeBuildId)
  const lastChange = useWorkspace((s) => (activeId ? s.history[activeId]?.past.at(-1)?.label : undefined))
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [scaleOpen, setScaleOpen] = useState(false)
  // "What changed": the score difference made by the last edit, tracked across renders.
  const [tracked, setTracked] = useState<{ label?: string; percent: number; fingerprint: string; delta: number | null } | null>(null)

  const verdict = useMemo(
    () => (results?.score ? buildVerdict(results.build, catalog, results.score.anchors) : null),
    [results, catalog],
  )
  const score = results?.score ?? null
  const fingerprint = results?.fingerprint ?? ''
  if (score && (!tracked || tracked.label !== lastChange || tracked.fingerprint !== fingerprint)) {
    // A difference is only meaningful on the same scale, so a setup change shows none.
    const sameScale = tracked !== null && tracked.fingerprint === fingerprint
    setTracked({
      label: lastChange,
      percent: score.percent,
      fingerprint,
      delta: sameScale && tracked.label !== lastChange ? score.percent - tracked.percent : null,
    })
  } else if (score && tracked && tracked.percent !== score.percent && tracked.label === lastChange) {
    setTracked({ ...tracked, percent: score.percent })
  }
  if (!results) return null
  const { build, simulation } = results
  const basic = !CORE_RESONATOR_IDS.includes(build.resonator.id)
  const delta = tracked?.label === lastChange ? (tracked?.delta ?? null) : null

  const resonator = catalog.resonators[build.resonator.id]
  const name = resonator?.name ?? 'Resonator'
  const weaponDef = build.weapon ? catalog.weapons[build.weapon.id] : undefined
  const nameSize = name.length <= 6 ? 'text-64 lg:text-120' : name.length <= 11 ? 'text-44 lg:text-64' : 'text-34 lg:text-44'
  const figures = [
    { label: 'Rotation damage', value: simulation.total.average },
    { label: 'No Echoes', value: score?.anchors.baseline },
    { label: 'Reference', value: score?.anchors.reference },
    { label: 'Maximum', value: score?.anchors.maximum },
  ]

  return (
    <section aria-labelledby="score-title" className="relative mb-3 rounded-section bg-panel p-4 md:p-8">
      <BorderBeam colours="tide" duration={12} size={240} />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-8">
        <p className={`m-0 font-display font-extrabold leading-[0.95] break-words lg:rotate-180 lg:self-stretch lg:text-end lg:[writing-mode:vertical-rl] ${nameSize}`}>
          {name}
        </p>

        <div className="mx-auto w-full max-w-[440px] lg:w-[46%] lg:max-w-[560px] lg:flex-none">
          <EchoBloom build={build}>
            {score ? (
              <>
                <span data-score className="font-display text-26 font-extrabold leading-none tabular-nums md:text-34">
                  {score.percent.toFixed(1)}%
                </span>
                <span className="rounded-full bg-ink px-3 py-0.5 text-13 font-bold text-page">Grade {score.grade}</span>
              </>
            ) : (
              <span className="text-13 text-ink-3">Scoring</span>
            )}
          </EchoBloom>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="score-title" className="font-display text-16 md:text-20">
              Build score
            </h2>
            {simulation.hasUnverified ? <Mark kind="unverified" detail="Some inputs to this result are unverified. Open How this was calculated to see which." /> : null}
            {basic ? <Mark kind="basic" /> : null}
          </div>
          <p className="mt-1 text-ink-2">
            {resonator ? `${ELEMENT_NAME[resonator.element]}, ${WEAPON_NAME[resonator.weaponType]}. ` : ''}
            Level {build.resonator.level}, Sequence {build.resonator.sequence}.{weaponDef && build.weapon ? ` ${weaponDef.name}, rank ${build.weapon.rank}.` : ''}
          </p>

          {score ? (
            <>
              {verdict ? <p className="mt-4 max-w-[48ch] font-display text-16 leading-snug font-medium md:text-20">{verdict.text}</p> : null}
              <div className="mt-4 max-w-xl">
                <Meter value={score.percent} min={0} max={200} label="Build score" valueText={`${score.percent.toFixed(1)} percent, grade ${score.grade}`} />
              </div>
              <p className="mt-1 text-12 text-ink-3">0 is no Echoes. 100 is the reference build. 200 is the maximum.</p>
            </>
          ) : (
            <div className="mt-3" role="status">
              <p className="text-ink-2">{results.scoreError ? `The score could not be worked out: ${results.scoreError}` : 'Working out the reference builds for this setup.'}</p>
            </div>
          )}

          <dl className="mt-4 grid max-w-xl grid-cols-2 gap-2">
            {figures.map((figure) => (
              <div key={figure.label} className="rounded-panel bg-raised px-3 py-2.5">
                <dt className="text-12 text-ink-3">{figure.label}</dt>
                <dd className="mt-0.5 font-display text-16 tabular-nums md:text-20">{figure.value === undefined ? 'Working' : formatDamage(figure.value)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-13 text-ink-3">
            {formatDamage(simulation.total.nonCrit)} if nothing crits, {formatDamage(simulation.total.crit)} if everything does.
          </p>

          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-13 text-ink-2" aria-label="Bloom colours">
            {TONE_LEGEND.map((tone) => (
              <li key={tone.label} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: tone.colour }} aria-hidden="true" />
                {tone.label}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-12 text-ink-3">One petal per Echo, clockwise from the top. Longer wedges are higher roll tiers.</p>

      {lastChange ? (
        <p className="mt-2 text-13 text-ink-3" aria-live="polite">
          Last change: {lastChange}.
          {delta !== null && Math.abs(delta) >= 0.05 ? (
            <span className={delta > 0 ? 'text-gain' : 'text-loss'}>
              {' '}
              Score {delta > 0 ? '+' : ''}
              {delta.toFixed(1)} points.
            </span>
          ) : null}
        </p>
      ) : null}

      <p className="mt-3 max-w-[64ch] text-13 text-ink-2">
        Compare this score only with builds that use the same rotation, team and target. The scale is worked out for each setup.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => setLedgerOpen(true)}>How this was calculated</Button>
        <Button variant="quiet" onClick={() => setScaleOpen(true)}>
          What the score means
        </Button>
      </div>
      <div className="mt-3">
        <Stamp />
      </div>
        </div>
      </div>

      <LedgerSheet open={ledgerOpen} onOpenChange={setLedgerOpen} />

      <Sheet open={scaleOpen} onOpenChange={setScaleOpen} title="What the score means" description="How good your Echo stats are, for this exact setup.">
        <div className="space-y-4 text-ink-2">
          <p>
            The score keeps your Echoes, their sets, your main Echo, weapon, team, rotation and target exactly as they are. Only the stats on the Echoes are
            compared.
          </p>
          <dl className="divide-y divide-rule border-y border-rule">
            <ScaleRow label="0%, no Echoes" damage={score?.anchors.baseline} />
            <ScaleRow label="100%, reference" damage={score?.anchors.reference} detail="Best main stats, and 3 useful substats on each Echo at their average roll." />
            <ScaleRow label="200%, maximum" damage={score?.anchors.maximum} detail="Best main stats, and 5 useful substats on each Echo at their highest roll." />
            <ScaleRow label="Your build" damage={simulation.total.average} />
          </dl>
          <p>The score is linear between those points, and keeps going past them.</p>
          {score ? (
            <div>
              <h3 className="font-medium text-ink">Best main stats here</h3>
              <p className="mt-1">
                {score.anchors.maximumLoadout.mainStats.map((main) => `${main.label} ${formatStatValue(main.stat, main.value)}`).join(', ')}
              </p>
              <h3 className="mt-3 font-medium text-ink">Most useful substats here</h3>
              <p className="mt-1">
                {catalog.echoStats.substats
                  .map((row, i) => ({ label: row.label, count: score.anchors.maximumLoadout.substatCounts[i] ?? 0 }))
                  .filter((row) => row.count > 0)
                  .map((row) => row.label)
                  .join(', ')}
              </p>
            </div>
          ) : null}
          <div>
            <h3 className="font-medium text-ink">Grades</h3>
            <p className="mt-1">{GRADE_BANDS.slice(1).map((band) => `${band.grade} from ${band.from}%`).join(', ')}. Below 25% is F.</p>
          </div>
          <p>Energy Regen is not valued by the score. If your rotation needs more of it, that is a cost the score does not see.</p>
        </div>
      </Sheet>
    </section>
  )
}

function ScaleRow({ label, damage, detail }: { label: string; damage: number | undefined; detail?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt>
        <span className="text-ink">{label}</span>
        {detail ? <span className="block text-13 text-ink-3">{detail}</span> : null}
      </dt>
      <dd className="tabular-nums text-ink">{damage === undefined ? 'Working' : formatDamage(damage)}</dd>
    </div>
  )
}
