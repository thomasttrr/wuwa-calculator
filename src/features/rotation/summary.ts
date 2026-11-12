// The rotation as a short numbered list a player can follow in game.
import { actionDisplayName } from '../../engine/rotation/action'
import type { Rotation, RotationStep } from '../../engine/types/build'
import type { ResonatorDef } from '../../engine/types/catalog'

function lines(steps: readonly RotationStep[], resonator: ResonatorDef): string[] {
  const out: { text: string; times: number; key: string }[] = []
  for (const step of steps) {
    if (!step.enabled) continue
    const action = resonator.actions.find((a) => a.id === step.actionId)
    const text = `${action ? actionDisplayName(resonator, action) : 'Unknown action'}${step.note ? ` (${step.note})` : ''}`
    const key = `${step.actionId}|${step.note ?? ''}`
    const last = out.at(-1)
    if (last && last.key === key) last.times += 1
    else out.push({ text, times: 1, key })
  }
  return out.map(({ text, times }) => (times > 1 ? `${text}, ${times} times` : text))
}

export function summariseRotation(rotation: Rotation, resonator: ResonatorDef): string[] {
  const out: string[] = []
  let n = 0
  let run: RotationStep[] = []
  const flush = () => {
    for (const line of lines(run, resonator)) out.push(`${++n}. ${line}`)
    run = []
  }
  for (const item of rotation.items) {
    if (item.kind === 'step') {
      run.push(item)
      continue
    }
    flush()
    if (!item.enabled) continue
    const inner = lines(item.steps, resonator)
    if (inner.length === 0) continue
    out.push(`${++n}. Repeat ${item.count} times:`)
    for (const line of inner) out.push(`   ${line}`)
  }
  flush()
  return out.length > 0 ? out : ['No steps are switched on.']
}
