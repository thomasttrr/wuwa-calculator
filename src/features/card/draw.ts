// Paints the card on a canvas. Only layout lives here: every word and number comes from
// CardModel, which is built from the engine's own results.
import type { SubstatTone } from '../../explain/echo-bloom'
import { BLOOM, petalStart } from '../../ui/bloom-geometry'
import type { CardModel } from './card-model'
import type { CardPalette } from './palettes'

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1350

const DISPLAY = 'Unbounded Variable'
const TEXT = 'Albert Sans Variable'

const TONE_LABEL: Record<SubstatTone, string> = {
  critRate: 'Crit. Rate',
  critDmg: 'Crit. DMG',
  atk: 'ATK',
  energyRegen: 'Energy Regen',
  bonus: 'DMG Bonus',
  hp: 'HP',
  def: 'DEF',
  other: 'Other',
}

function font(ctx: CanvasRenderingContext2D, size: number, weight: number, family: string) {
  ctx.font = `${weight} ${size}px "${family}"`
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, weight: number, family: string, colour: string) {
  font(ctx, size, weight, family)
  ctx.fillStyle = colour
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(value, x, y)
}

function rightText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, weight: number, family: string, colour: string) {
  font(ctx, size, weight, family)
  ctx.fillStyle = colour
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(value, x, y)
}

function fitSize(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, start: number, min: number, weight: number, family: string): number {
  let size = start
  while (size > min) {
    font(ctx, size, weight, family)
    if (ctx.measureText(value).width <= maxWidth) break
    size -= 2
  }
  return size
}

function ellipsis(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  if (ctx.measureText(value).width <= maxWidth) return value
  let cut = value
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1)
  return `${cut}…`
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function fillRound(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, colour: string) {
  roundRect(ctx, x, y, width, height, radius)
  ctx.fillStyle = colour
  ctx.fill()
}

function pill(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, palette: CardPalette, filled = false) {
  font(ctx, size, 600, TEXT)
  const width = ctx.measureText(value).width + size * 1.6
  const height = size * 1.9
  if (filled) {
    fillRound(ctx, x, y, width, height, height / 2, palette.signal)
    text(ctx, value, x + size * 0.8, y + height * 0.7, size, 600, TEXT, palette.onSignal)
  } else {
    roundRect(ctx, x, y, width, height, height / 2)
    ctx.strokeStyle = palette.rule
    ctx.lineWidth = 1.5
    ctx.stroke()
    text(ctx, value, x + size * 0.8, y + height * 0.7, size, 600, TEXT, palette.ink)
  }
  return width
}

function drawBloom(ctx: CanvasRenderingContext2D, model: CardModel, palette: CardPalette, cx: number, cy: number, scale: number) {
  ctx.save()
  ctx.translate(cx - BLOOM.centre * scale, cy - BLOOM.centre * scale)
  ctx.scale(scale, scale)
  const c = BLOOM.centre

  ctx.strokeStyle = palette.rule
  ctx.lineWidth = 1
  for (const r of [150, 200, 250, 300]) {
    ctx.beginPath()
    ctx.arc(c, c, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  model.bloom.forEach((echo, slot) => {
    if (echo) return
    ctx.beginPath()
    ctx.arc(c, c, BLOOM.inner + 20, ((petalStart(slot) + 3) * Math.PI) / 180, ((petalStart(slot) + BLOOM.petal - 3) * Math.PI) / 180)
    ctx.strokeStyle = palette.rule
    ctx.lineWidth = 2
    ctx.setLineDash([4, 6])
    ctx.stroke()
    ctx.setLineDash([])
  })

  model.bloom.forEach((echo, slot) => {
    if (!echo) return
    const start = petalStart(slot)
    echo.subs.slice(0, 5).forEach((sub, index) => {
      const from = start + 3 + index * BLOOM.step
      const to = from + BLOOM.wedge
      const quality = sub.tiers > 0 ? Math.min(1, Math.max(0, sub.tier / sub.tiers)) : 0
      const outer = BLOOM.inner + BLOOM.minLength + BLOOM.maxExtra * quality
      ctx.beginPath()
      ctx.arc(c, c, outer, (from * Math.PI) / 180, (to * Math.PI) / 180)
      ctx.arc(c, c, BLOOM.inner, (to * Math.PI) / 180, (from * Math.PI) / 180, true)
      ctx.closePath()
      ctx.fillStyle = sub.addsDamage ? palette.tones[sub.tone] : palette.unused
      ctx.fill()
    })
  })

  if (model.bloom[0]) {
    ctx.beginPath()
    ctx.arc(c, c, BLOOM.inner - 10, ((petalStart(0) + 3) * Math.PI) / 180, ((petalStart(0) + BLOOM.petal - 3) * Math.PI) / 180)
    ctx.strokeStyle = palette.ink
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.stroke()
  }
  ctx.restore()

  // The score sits in the centre, exactly as it does in the app.
  font(ctx, 54, 700, DISPLAY)
  ctx.fillStyle = palette.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(model.scorePercent, cx, cy + 6)
  if (model.grade) {
    font(ctx, 15, 600, TEXT)
    const label = `Grade ${model.grade}`
    const width = ctx.measureText(label).width + 34
    fillRound(ctx, cx - width / 2, cy + 24, width, 30, 15, palette.signal)
    font(ctx, 15, 600, TEXT)
    ctx.fillStyle = palette.onSignal
    ctx.textAlign = 'center'
    ctx.fillText(label, cx, cy + 44)
  }
}

export function drawCard(ctx: CanvasRenderingContext2D, model: CardModel, palette: CardPalette): void {
  const W = CARD_WIDTH
  const H = CARD_HEIGHT
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = palette.page
  ctx.fillRect(0, 0, W, H)
  ctx.textAlign = 'left'

  // Header.
  text(ctx, 'theWuthering', 64, 68, 22, 700, DISPLAY, palette.ink)
  text(ctx, 'Build card', 64, 92, 13, 400, TEXT, palette.ink3)
  rightText(ctx, model.playerName, W - 64, 64, 18, 600, TEXT, palette.ink)
  if (model.playerId) rightText(ctx, model.playerId, W - 64, 88, 13, 400, TEXT, palette.ink3)
  ctx.strokeStyle = palette.rule
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(64, 116)
  ctx.lineTo(W - 64, 116)
  ctx.stroke()

  // Identity.
  text(ctx, ellipsis(ctx, model.buildName, 950), 64, 158, 14, 400, TEXT, palette.ink3)
  const nameSize = fitSize(ctx, model.resonatorName, 900, 70, 40, 700, DISPLAY)
  text(ctx, model.resonatorName, 64, 238, nameSize, 700, DISPLAY, palette.ink)
  text(ctx, `${model.element}, level ${model.level}, Sequence ${model.sequence}`, 64, 282, 20, 400, TEXT, palette.ink2)
  text(ctx, model.weapon, 64, 312, 16, 400, TEXT, palette.ink3)

  let markX = 64
  for (const mark of model.marks) markX += pill(ctx, mark, markX, 334, 12, palette) + 10

  // Bloom and score.
  drawBloom(ctx, model, palette, 330, 672, 0.7)

  // Right column: the real rotation numbers.
  const x = 636
  text(ctx, 'Rotation damage', x, 390, 13, 400, TEXT, palette.ink3)
  text(ctx, model.damageText, x, 438, 42, 700, DISPLAY, palette.ink)
  text(ctx, 'average per rotation', x, 464, 13, 400, TEXT, palette.ink3)
  text(ctx, model.counterText, x, 492, 13, 400, TEXT, palette.ink2)
  ctx.strokeStyle = palette.rule
  ctx.beginPath()
  ctx.moveTo(x, 516)
  ctx.lineTo(W - 64, 516)
  ctx.stroke()
  text(ctx, model.figures[1]?.label ?? 'If nothing crits', x, 548, 12, 400, TEXT, palette.ink3)
  text(ctx, model.figures[1]?.text ?? '', x, 574, 20, 600, TEXT, palette.ink)
  text(ctx, model.figures[2]?.label ?? 'If everything crits', x, 612, 12, 400, TEXT, palette.ink3)
  text(ctx, model.figures[2]?.text ?? '', x, 638, 20, 600, TEXT, palette.ink)

  text(ctx, 'Echoes', x, 704, 16, 700, DISPLAY, palette.ink)
  model.echoes.forEach((echo, index) => {
    const y = 744 + index * 38
    font(ctx, 12, 600, TEXT)
    ctx.fillStyle = palette.ink3
    ctx.textAlign = 'left'
    ctx.fillText(String(index + 1), x, y)
    if (!echo) {
      text(ctx, 'Empty', x + 22, y, 14, 400, TEXT, palette.ink3)
      return
    }
    font(ctx, 14, 600, TEXT)
    text(ctx, ellipsis(ctx, echo.name, 250), x + 22, y, 14, 600, TEXT, palette.ink)
    text(ctx, echo.main, x + 22, y + 16, 11, 400, TEXT, palette.ink3)
  })

  // Bottom panel: team, rotation, set, bloom legend and the stamp.
  fillRound(ctx, 64, 986, W - 128, 296, 24, palette.panel)
  const lower = 986
  text(ctx, 'Team', 96, lower + 42, 12, 400, TEXT, palette.ink3)
  text(ctx, ellipsis(ctx, model.team.length > 0 ? model.team.join(', ') : 'No teammates', 450), 96, lower + 70, 16, 600, TEXT, palette.ink)
  text(ctx, 'Rotation', 96, lower + 112, 12, 400, TEXT, palette.ink3)
  text(ctx, ellipsis(ctx, model.rotationName, 450), 96, lower + 140, 16, 600, TEXT, palette.ink)
  text(ctx, 'Echoes', 96, lower + 182, 12, 400, TEXT, palette.ink3)
  text(ctx, model.setLine, 96, lower + 210, 16, 600, TEXT, palette.ink)

  text(ctx, 'Bloom colours', 620, lower + 42, 12, 400, TEXT, palette.ink3)
  const tones: SubstatTone[] = ['critRate', 'critDmg', 'atk', 'energyRegen', 'bonus', 'hp', 'def']
  tones.forEach((tone, index) => {
    const col = index < 4 ? 0 : 1
    const row = index < 4 ? index : index - 4
    const tx = 620 + col * 200
    const ty = lower + 70 + row * 26
    ctx.beginPath()
    ctx.arc(tx + 5, ty - 4, 5, 0, Math.PI * 2)
    ctx.fillStyle = palette.tones[tone]
    ctx.fill()
    text(ctx, TONE_LABEL[tone], tx + 18, ty, 12, 400, TEXT, palette.ink2)
  })
  ctx.beginPath()
  ctx.arc(625, lower + 178, 5, 0, Math.PI * 2)
  ctx.fillStyle = palette.unused
  ctx.fill()
  text(ctx, 'Adds no damage here', 638, lower + 182, 12, 400, TEXT, palette.ink2)

  ctx.strokeStyle = palette.rule
  ctx.beginPath()
  ctx.moveTo(96, lower + 246)
  ctx.lineTo(W - 96, lower + 246)
  ctx.stroke()
  text(ctx, model.stamp, 96, lower + 270, 12, 400, TEXT, palette.ink3)
  rightText(ctx, model.disclaimer, W - 96, lower + 270, 11, 400, TEXT, palette.ink3)
}
