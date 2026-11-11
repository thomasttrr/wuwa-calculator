import { Meter } from '../ui/Meter'

// Phase 0 render check: shows the locked tokens from DESIGN.md so they can be inspected
// at 1440px and 390px before any real screen is built. Not linked from the finished app.

const SURFACES = [
  { name: 'Page', token: 'bg-page', hex: '#1F2124' },
  { name: 'Panel', token: 'bg-panel', hex: '#282B2F' },
  { name: 'Raised', token: 'bg-raised', hex: '#32363B' },
  { name: 'Rule', token: 'bg-rule', hex: '#3A3E44' },
  { name: 'Ink', token: 'bg-ink', hex: '#E9E6DF' },
  { name: 'Signal', token: 'bg-signal', hex: '#F0A73A' },
] as const

const DATA_COLOURS = [
  { name: 'Glacio', token: 'bg-glacio' },
  { name: 'Fusion', token: 'bg-fusion' },
  { name: 'Electro', token: 'bg-electro' },
  { name: 'Aero', token: 'bg-aero' },
  { name: 'Spectro', token: 'bg-spectro' },
  { name: 'Havoc', token: 'bg-havoc' },
  { name: 'Physical', token: 'bg-physical' },
] as const

const TYPE_SCALE = [
  { size: 'text-44', label: '44', display: true },
  { size: 'text-34', label: '34', display: true },
  { size: 'text-26', label: '26', display: true },
  { size: 'text-20', label: '20', display: true },
  { size: 'text-16', label: '16', display: false },
  { size: 'text-14', label: '14', display: false },
  { size: 'text-13', label: '13', display: false },
  { size: 'text-12', label: '12', display: false },
] as const

export function TokenPage() {
  return (
    <main className="mx-auto max-w-[1280px] px-4 py-8 md:px-6">
      <h1 className="font-display text-26 md:text-34">Tuning bench tokens</h1>
      <p className="mt-2 max-w-[60ch] text-ink-2">
        The locked palette, type scale and meter from DESIGN.md, shown for inspection.
      </p>

      <section className="mt-8 border-t border-rule pt-6" aria-labelledby="tp-score">
        <h2 id="tp-score" className="font-display text-20">
          Build score
        </h2>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="font-display text-44">132%</span>
          <span className="text-20 font-semibold text-signal">Grade S</span>
        </div>
        <div className="mt-3 max-w-md">
          <Meter value={132} label="Build score" valueText="132 percent, grade S" />
        </div>
        <p className="mt-3 text-ink-2">Held back most by low Crit. Rate.</p>
        <p className="mt-1 text-12 text-ink-3">Patch 3.8, data from 11 Nov 2026</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="min-h-11 rounded-control bg-signal px-4 font-semibold text-on-signal md:min-h-9"
          >
            See what to change
          </button>
          <button
            type="button"
            className="min-h-11 rounded-control border border-rule px-4 font-medium text-ink hover:bg-raised md:min-h-9"
          >
            How this was calculated
          </button>
          <span className="rounded-control border border-rule px-2 py-0.5 text-12 text-caution">Unverified</span>
          <span className="rounded-control border border-rule px-2 py-0.5 text-12 text-caution">Basic model</span>
        </div>
      </section>

      <section className="mt-8 border-t border-rule pt-6" aria-labelledby="tp-surfaces">
        <h2 id="tp-surfaces" className="font-display text-20">
          Surfaces and accent
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {SURFACES.map((s) => (
            <li key={s.name}>
              <div className={`h-12 rounded-panel border border-rule ${s.token}`} />
              <div className="mt-1 font-medium">{s.name}</div>
              <div className="text-12 text-ink-3">{s.hex}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 border-t border-rule pt-6" aria-labelledby="tp-data">
        <h2 id="tp-data" className="font-display text-20">
          Data colours
        </h2>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {DATA_COLOURS.map((c) => (
            <li key={c.name} className="flex items-center gap-2">
              <span className={`inline-block size-3 rounded-control ${c.token}`} aria-hidden="true" />
              {c.name}
            </li>
          ))}
          <li className="text-gain">+4.2% gain</li>
          <li className="text-loss">-1.8% loss</li>
        </ul>
      </section>

      <section className="mt-8 border-t border-rule pt-6" aria-labelledby="tp-type">
        <h2 id="tp-type" className="font-display text-20">
          Type scale
        </h2>
        <ul className="mt-3">
          {TYPE_SCALE.map((t) => (
            <li key={t.label} className="flex items-baseline gap-4 border-b border-rule py-2">
              <span className="w-8 shrink-0 text-right text-12 text-ink-3">{t.label}</span>
              <span className={`${t.size} ${t.display ? 'font-display' : ''} min-w-0 truncate`}>
                Resonance 1,234,567
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 border-t border-rule pt-6" aria-labelledby="tp-rows">
        <h2 id="tp-rows" className="font-display text-20">
          Ruled rows and a panel
        </h2>
        <dl className="mt-3 max-w-md">
          {[
            ['ATK', '2,104'],
            ['Crit. Rate', '61.4%'],
            ['Crit. DMG', '248.0%'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-rule py-2">
              <dt className="text-ink-2">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 max-w-md rounded-panel border border-rule bg-panel p-4">
          <div className="font-medium">A panel is for something you can pick up or edit</div>
          <p className="mt-1 text-ink-2">Sections sit on the page between rules instead.</p>
        </div>
      </section>
    </main>
  )
}
