import { useCatalog } from '../../app/context'
import type { EchoInstance } from '../../engine/types/build'
import { substatTone } from '../../explain/echo-bloom'
import { formatStatValue, statLabel } from '../../ui/format'
import { TONE_COLOUR } from '../build/EchoBloom'
import { CostBadge } from '../build/pickers'

/** One Echo in a list: cost, name, set and main stat, then each substat with its stat colour. */
export function EchoSummary({ echo, note }: { echo: EchoInstance; note?: string }) {
  const catalog = useCatalog()
  const def = catalog.echoes[echo.echoId]
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
      <CostBadge cost={echo.cost} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="truncate font-medium text-ink">{def?.name ?? 'Echo'}</span>
          {note ? <span className="text-12 text-ink-3">{note}</span> : null}
        </span>
        <span className="block truncate text-13 text-ink-3">
          {catalog.sonatas[echo.sonataId]?.name}. {statLabel(echo.mainStat.stat, echo.mainStat.scope)}{' '}
          {formatStatValue(echo.mainStat.stat, echo.mainStat.value)}
        </span>
        {echo.substats.length > 0 ? (
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-12 text-ink-2">
            {echo.substats.map((sub, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: TONE_COLOUR[substatTone(sub.stat)] }} aria-hidden="true" />
                {statLabel(sub.stat, sub.scope)} {formatStatValue(sub.stat, sub.value)}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </span>
  )
}
