import { Download, FileJson, Image, Palette } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Link } from 'react-router'
import { notices } from '../../app/notices'
import { useActions, useCatalog, useWorkspace } from '../../app/context'
import { useResults } from '../../app/results'
import { downloadText, fileNameFor } from '../../state/library-file'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/Section'
import { buildCardModel } from './card-model'
import { CARD_HEIGHT, CARD_WIDTH, drawCard } from './draw'
import { CARD_PALETTES, paletteById } from './palettes'
import type { CardPalette } from './palettes'

const PRESET_KEY = 'card.preset'

export function CardPage() {
  const results = useResults()
  const catalog = useCatalog()
  const actions = useActions()
  const preset = useWorkspace((s) => (s.session.toolUi[PRESET_KEY] as CardPalette['id'] | undefined) ?? 'calm')
  const player = useWorkspace((s) => s.meta.settings)
  const palette = paletteById(preset)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawn, setDrawn] = useState(false)

  const model = useMemo(() => {
    if (!results) return null
    return buildCardModel(results.build, catalog, results.simulation, results.score, player)
  }, [results, catalog, player])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !model) return
    let live = true
    const paint = () => {
      if (!live) return
      const context = canvas.getContext('2d')
      if (!context) return
      drawCard(context, model, palette)
      setDrawn(true)
    }
    // Canvas needs the real font before it measures the name.
    void document.fonts.ready.then(paint)
    return () => {
      live = false
    }
  }, [model, palette])

  if (!results || !model) {
    return (
      <div>
        <h1 className="font-display text-26 md:text-34">Card</h1>
        <p className="mt-2 max-w-[64ch] text-ink-2">A shareable picture of your build, made from the same numbers as every other tool.</p>
        <div className="mt-6">
          <EmptyState action={<Link to="/build" className="inline-flex min-h-11 items-center rounded-control bg-signal px-4 font-semibold text-on-signal">Open the Build tool</Link>}>
            Start or open a build before making a card.
          </EmptyState>
        </div>
      </div>
    )
  }

  const setPreset = (id: CardPalette['id']) => {
    // The same place memory every tool uses, so the preset survives a reload.
    actions.setToolUi(PRESET_KEY, id)
  }

  return <CardBody model={model} canvasRef={canvasRef} drawn={drawn} preset={preset} onPreset={setPreset} playerName={player.playerName} buildName={model.resonatorName} />
}

function CardBody({
  model,
  canvasRef,
  drawn,
  preset,
  onPreset,
  playerName,
  buildName,
}: {
  model: ReturnType<typeof buildCardModel>
  canvasRef: RefObject<HTMLCanvasElement | null>
  drawn: boolean
  preset: CardPalette['id']
  onPreset: (id: CardPalette['id']) => void
  playerName: string
  buildName: string
}) {
  const ready = model.scoreValue !== null

  const save = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) {
        notices.show('The card image could not be made. Try another browser or a smaller window.')
        return
      }
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileNameFor(`${buildName}-card`, playerName, 'png')
      anchor.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const copy = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (typeof ClipboardItem === 'undefined') {
      notices.show('This browser cannot copy an image. Download it instead.')
      return
    }
    canvas.toBlob((blob) => {
      if (!blob) return
      void navigator.clipboard
        .write([new ClipboardItem({ 'image/png': blob })])
        .then(() => notices.show('Card image copied.'))
        .catch(() => notices.show('The card could not be copied. Download it instead.'))
    }, 'image/png')
  }

  const exportData = () => {
    downloadText(
      fileNameFor(`${buildName}-card`, playerName, 'card.json'),
      JSON.stringify(
        {
          format: 'theWuthering.card',
          version: 1,
          exportedAt: new Date().toISOString(),
          card: model,
        },
        null,
        2,
      ),
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-26 md:text-34">Card</h1>
          <p className="mt-2 max-w-[64ch] text-ink-2">
            A picture of this build for a phone or a chat. Every figure comes from the same calculation as the Build page.
          </p>
        </div>
        <Link to="/settings" className="text-14 font-medium text-ink-2 underline decoration-rule-strong underline-offset-4 hover:text-ink">
          Player name and ID
        </Link>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-section bg-panel p-4 md:p-6">
          <div className="mx-auto w-full max-w-[440px] rounded-[26px] border border-rule bg-page p-2 shadow-float">
            <canvas
              ref={canvasRef}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              role="img"
              aria-label={`Build card for ${model.resonatorName}. Score ${model.scorePercent}, grade ${model.grade ?? 'not ready'}, ${model.damageText} average damage per rotation.`}
              className="block h-auto w-full rounded-[20px]"
              data-card-canvas
            />
          </div>
          <p className="mt-3 text-center text-12 text-ink-3">Phone preview. The downloaded picture is {CARD_WIDTH} by {CARD_HEIGHT} pixels.</p>

          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-panel bg-raised px-3 py-2">
              <dt className="text-12 text-ink-3">Build score</dt>
              <dd className="font-display text-16 tabular-nums">{model.scorePercent}</dd>
            </div>
            <div className="rounded-panel bg-raised px-3 py-2">
              <dt className="text-12 text-ink-3">Rotation damage</dt>
              <dd className="font-display text-16 tabular-nums" data-card-damage>
                {model.damageText}
              </dd>
            </div>
            <div className="rounded-panel bg-raised px-3 py-2">
              <dt className="text-12 text-ink-3">If nothing crits</dt>
              <dd className="font-display text-16 tabular-nums">{model.figures[1]?.text}</dd>
            </div>
            <div className="rounded-panel bg-raised px-3 py-2">
              <dt className="text-12 text-ink-3">If everything crits</dt>
              <dd className="font-display text-16 tabular-nums">{model.figures[2]?.text}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-section bg-panel p-4 md:p-6">
          <h2 className="flex items-center gap-2 font-display text-16">
            <Palette size={18} aria-hidden="true" />
            Style
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Card palette">
            {CARD_PALETTES.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={option.id === preset}
                onClick={() => onPreset(option.id)}
                className={`rounded-control border px-2 py-2 text-13 ${
                  option.id === preset ? 'border-signal font-semibold text-ink' : 'border-rule text-ink-2 hover:bg-raised'
                }`}
              >
                <span className="mx-auto mb-1 flex size-8 items-center justify-center rounded-full border border-rule" style={{ background: option.page }}>
                  <span className="size-3 rounded-full" style={{ background: option.signal }} aria-hidden="true" />
                </span>
                {option.name}
              </button>
            ))}
          </div>

          <h2 className="mt-6 font-display text-16">Export</h2>
          <p className="mt-1 text-13 text-ink-3">Saved as a PNG in your downloads. Nothing is uploaded.</p>
          <div className="mt-3 grid gap-2">
            <Button variant="primary" icon={<Download size={16} aria-hidden="true" />} disabled={!ready || !drawn} onClick={save}>
              {ready ? 'Download PNG' : 'Scoring: download soon'}
            </Button>
            <Button icon={<Image size={16} aria-hidden="true" />} disabled={!ready || !drawn} onClick={copy}>
              Copy image
            </Button>
            <Button variant="quiet" icon={<FileJson size={16} aria-hidden="true" />} disabled={!ready} onClick={exportData}>
              Export as data
            </Button>
          </div>

          <p className="mt-5 text-13 text-ink-2">
            The card shows your real build, Echoes and numbers. This copy of the app has no game art, so the Resonator's name and element colour stand in
            for a portrait.
          </p>
          <p className="mt-2 text-12 text-ink-3">{model.stamp}</p>
          <p className="mt-1 text-12 text-ink-3">{model.disclaimer}</p>
        </div>
      </div>
    </div>
  )
}
