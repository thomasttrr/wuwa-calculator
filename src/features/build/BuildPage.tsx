import { useActions, useWorkspace } from '../../app/context'
import { useResults } from '../../app/results'
import { Switch } from '../../ui/Field'
import { EchoSection } from './EchoSection'
import { EffectsSection } from './EffectsSection'
import { FirstRunGuide } from './FirstRunGuide'
import { ResonatorSection } from './ResonatorSection'
import { ResultsTabs } from './ResultsTabs'
import { ScorePanel } from './ScorePanel'
import { TeamSection } from './TeamSection'

/**
 * Desktop: what you change on the left, what it means on the right.
 * Phone: the score first, then the editor, then the detailed results (DESIGN.md).
 */
export function BuildPage() {
  const results = useResults()
  const actions = useActions()
  const everything = useWorkspace((s) => s.meta.settings.showEverything)
  if (!results) return <p className="py-8 text-ink-2">Start a build from the build list at the top of the page.</p>
  const { build } = results

  return (
    <div>
      <h1 className="sr-only">Build: {build.name}</h1>
      <FirstRunGuide />
      {/* The bloom hero spans the page; below it, what you change on the left and what it means on the right. */}
      <ScorePanel />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3 rounded-section bg-panel px-4 md:px-6">
            <Switch
              label="Show everything"
              description="Skill levels, skill tree, ascension, resistances, teammates' weapons and your own buffs."
              checked={everything}
              onChange={(on) => actions.updateSettings({ showEverything: on })}
            />
          </div>
          <ResonatorSection build={build} />
          <EchoSection build={build} />
          <TeamSection build={build} />
          <EffectsSection build={build} />
        </div>
        <div className="self-start rounded-section bg-panel p-4 md:p-6">
          <ResultsTabs />
        </div>
      </div>
    </div>
  )
}
