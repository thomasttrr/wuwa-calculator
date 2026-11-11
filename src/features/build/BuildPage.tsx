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
      {/* auto then 1fr rows: the editor spans both, so its extra height goes to the results row, not under the score. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-10 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] md:grid-rows-[auto_1fr]">
        <div className="md:col-start-2 md:row-start-1">
          <ScorePanel />
        </div>
        <div className="md:col-start-1 md:row-span-2 md:row-start-1">
          <div className="flex items-center justify-between gap-3 border-t border-rule md:border-t-0">
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
        <div className="md:col-start-2 md:row-start-2 md:self-start">
          <ResultsTabs />
        </div>
      </div>
    </div>
  )
}
