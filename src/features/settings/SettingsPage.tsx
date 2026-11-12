import { DatabaseBackup, Download, HardDriveDownload, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import { useActions, useCatalog, useSaving, useSavingActions, useWorkspace } from '../../app/context'
import { notices } from '../../app/notices'
import { ELEMENTS } from '../../engine/types/stats'
import type { Element } from '../../engine/types/stats'
import {
  downloadText,
  exportBackup,
  exportLibrary,
  fileNameFor,
  parseBackup,
  parseLibraryFile,
} from '../../state/library-file'
import type { RestoredBackup } from '../../state/library-file'
import { Button } from '../../ui/Button'
import { ElementChip } from '../../ui/ElementChip'
import { Stepper, Switch } from '../../ui/Field'
import { ELEMENT_NAME } from '../../ui/format'
import { Section } from '../../ui/Section'

export function SettingsPage() {
  const catalog = useCatalog()
  const actions = useActions()
  const saving = useSavingActions()
  const { lastSavedAt, revision } = useSaving()
  const settings = useWorkspace((s) => s.meta.settings)
  const builds = useWorkspace((s) => s.library.builds)
  const order = useWorkspace((s) => s.library.order)
  const rotations = useWorkspace((s) => s.library.rotations)
  const echoCount = useWorkspace((s) => s.library.echoInventory.length)
  const workspace = useWorkspace((s) => s)

  const [problem, setProblem] = useState<string | null>(null)
  const [restore, setRestore] = useState<(RestoredBackup & { fileName: string }) | null>(null)
  const [eraseStep, setEraseStep] = useState<'idle' | 'first' | 'typed'>('idle')
  const [eraseWord, setEraseWord] = useState('')

  const buildCount = order.length

  const readFile = async (file: File | undefined, onText: (text: string, name: string) => void) => {
    if (!file) return
    try {
      onText(await file.text(), file.name)
    } catch (error) {
      setProblem(`That file could not be opened: ${(error as Error).message}`)
    }
  }

  const backup = () => {
    setProblem(null)
    downloadText(fileNameFor('theWuthering-backup', settings.playerName, 'backup.json'), exportBackup(workspace, catalog))
    notices.show('Backup downloaded. Keep it somewhere you can find again.')
  }

  const importLibraryFile = (text: string) => {
    try {
      const library = parseLibraryFile(text, catalog, { builds: Object.values(builds), rotations })
      if (library.builds.length === 0 && library.rotations.length === 0) {
        setProblem('That file has no builds or rotations in it.')
        return
      }
      actions.mergeLibrary(library.builds, library.rotations)
      setProblem(null)
      const parts = [
        library.builds.length > 0 ? `${library.builds.length} ${library.builds.length === 1 ? 'build' : 'builds'}` : '',
        library.rotations.length > 0 ? `${library.rotations.length} ${library.rotations.length === 1 ? 'rotation' : 'rotations'}` : '',
      ].filter(Boolean)
      notices.show(`Imported ${parts.join(' and ')}.`)
    } catch (error) {
      setProblem((error as Error).message)
    }
  }

  const chooseRestore = (text: string, fileName: string) => {
    try {
      setRestore({ ...parseBackup(text, catalog), fileName })
      setProblem(null)
    } catch (error) {
      setProblem((error as Error).message)
    }
  }

  const restoreNow = async () => {
    if (!restore) return
    try {
      await saving.replaceAll(restore.workspace)
      notices.show(`Restored ${restore.fileName}.`)
      setRestore(null)
      setProblem(null)
    } catch (error) {
      setProblem(`The backup could not be restored: ${(error as Error).message}`)
    }
  }

  const erase = async () => {
    try {
      await saving.eraseAll()
      setEraseStep('idle')
      setEraseWord('')
      setProblem(null)
      notices.show('Everything was removed from this browser.')
    } catch (error) {
      setProblem(`Everything could not be removed: ${(error as Error).message}`)
    }
  }

  const setResistance = (element: Element, percent: number) => {
    const clamped = Math.min(1, Math.max(0, percent / 100))
    actions.updateSettings({ defaultResistances: { ...settings.defaultResistances, [element]: clamped } })
  }

  return (
    <div>
      <h1 className="font-display text-26 md:text-34">Settings</h1>
      <p className="mt-2 max-w-[64ch] text-ink-2">How the app behaves, what a new build starts with, and where your data lives. Everything stays in this browser.</p>
      <p className="mt-1 text-13 text-ink-3" aria-live="polite">
        {lastSavedAt ? `Saved in this browser at ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : 'Not saved yet.'}
        {revision > 0 ? ` Revision ${revision}.` : ''}
      </p>

      {problem ? (
        <p role="alert" className="mt-4 rounded-panel border border-loss px-4 py-3 text-14 text-ink">
          {problem}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <div>
          <Section title="Player" id="player" description="Shown on the card. Nothing is sent anywhere.">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-13 text-ink-2">Player name</span>
                <input
                  value={settings.playerName}
                  maxLength={40}
                  autoComplete="off"
                  onChange={(event) => actions.updateSettings({ playerName: event.target.value })}
                  className="min-h-11 rounded-control border border-rule bg-page px-3 text-ink focus:border-signal focus:outline-none md:min-h-9"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-13 text-ink-2">Player ID</span>
                <input
                  value={settings.playerId}
                  maxLength={40}
                  autoComplete="off"
                  onChange={(event) => actions.updateSettings({ playerId: event.target.value })}
                  className="min-h-11 rounded-control border border-rule bg-page px-3 text-ink focus:border-signal focus:outline-none md:min-h-9"
                />
              </label>
            </div>
          </Section>

          <Section title="Display" id="display" description="The dark theme is the locked design. These options change comfort, not colour meaning.">
            <Switch
              label="Show everything"
              description="Skill levels, skill tree, ascension, resistances, teammates' weapons and your own buffs. Nothing is ever removed."
              checked={settings.showEverything}
              onChange={(on) => actions.updateSettings({ showEverything: on })}
            />
            <Switch
              label="Higher contrast"
              description="Darker surfaces and brighter supporting text."
              checked={settings.highContrast}
              onChange={(on) => actions.updateSettings({ highContrast: on })}
            />
            <Switch
              label="Reduce motion"
              description="Stops the border beam and shortens transitions."
              checked={settings.reduceMotion}
              onChange={(on) => actions.updateSettings({ reduceMotion: on })}
            />
          </Section>

          <Section title="New builds" id="defaults" description="What a new build starts with. Existing builds are not changed.">
            <Stepper
              label="Target level"
              value={settings.defaultTargetLevel}
              min={1}
              max={120}
              onChange={(value) => actions.updateSettings({ defaultTargetLevel: value })}
            />
            <fieldset className="mt-4">
              <legend className="text-13 text-ink-2">Enemy resistance</legend>
              <p className="mt-1 text-12 text-ink-3">10% is the usual value for most enemies. A boss's own element is often 40%.</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ELEMENTS.map((element) => (
                  <label key={element} className="flex flex-col gap-1.5 rounded-panel bg-raised px-3 py-2">
                    <span className="flex items-center gap-2 text-13 text-ink-2">
                      <ElementChip element={element} showName={false} />
                      {ELEMENT_NAME[element]}
                    </span>
                    <span className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={Math.round(settings.defaultResistances[element] * 1000) / 10}
                        onChange={(event) => {
                          const value = Number(event.target.value)
                          if (Number.isFinite(value)) setResistance(element, value)
                        }}
                        className="min-h-9 w-full min-w-0 rounded-control border border-rule bg-page px-2 py-1 text-right text-13 text-ink focus:border-signal focus:outline-none"
                        aria-label={`${ELEMENT_NAME[element]} resistance percent`}
                      />
                      <span className="text-13 text-ink-3">%</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </Section>
        </div>

        <div>
          <Section title="Your data" id="data" description="Back up, move or remove everything this app has saved in this browser.">
            <p className="text-ink-2">
              {buildCount} {buildCount === 1 ? 'build' : 'builds'}, {rotations.length} saved {rotations.length === 1 ? 'rotation' : 'rotations'}, {echoCount}{' '}
              {echoCount === 1 ? 'Echo' : 'Echoes'}.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button variant="primary" icon={<DatabaseBackup size={16} aria-hidden="true" />} onClick={backup}>
                Back up everything
              </Button>
              <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control border border-rule px-4 text-14 font-medium text-ink hover:bg-raised md:min-h-9">
                <Upload size={16} aria-hidden="true" />
                Restore a backup
                <input
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  onChange={(event) =>
                    void readFile(event.target.files?.[0], (text, name) => {
                      chooseRestore(text, name)
                      event.target.value = ''
                    })
                  }
                />
              </label>
            </div>
            <p className="mt-2 text-12 text-ink-3">A backup holds builds, Echoes, rotations, settings and undo history. Restoring replaces what is here, after you confirm.</p>

            {restore ? (
              <div role="alertdialog" aria-label="Restore this backup?" className="mt-4 rounded-panel border border-rule-strong bg-raised p-4">
                <p className="font-medium">Restore {restore.fileName}?</p>
                <p className="mt-1 text-ink-2">
                  It has {Object.keys(restore.workspace.library.builds).length} builds and {restore.workspace.library.rotations.length} saved rotations. Everything
                  in this browser now will be replaced.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => void restoreNow()}>Restore this backup</Button>
                  <Button variant="quiet" onClick={() => setRestore(null)}>
                    Keep what I have
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="mt-6 border-t border-rule pt-4">
              <h3 className="font-medium">Builds and rotations</h3>
              <p className="mt-1 text-13 text-ink-3">Move these between browsers without Echoes, settings or undo history.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  icon={<Download size={16} aria-hidden="true" />}
                  onClick={() =>
                    downloadText(fileNameFor('builds-and-rotations', settings.playerName, 'json'), exportLibrary(workspace, catalog))
                  }
                >
                  Export builds and rotations
                </Button>
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control px-3 text-14 font-medium text-ink-2 hover:bg-raised hover:text-ink md:min-h-9">
                  <Upload size={16} aria-hidden="true" />
                  Import a file
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="sr-only"
                    onChange={(event) =>
                      void readFile(event.target.files?.[0], (text) => {
                        importLibraryFile(text)
                        event.target.value = ''
                      })
                    }
                  />
                </label>
              </div>
              <p className="mt-2 text-12 text-ink-3">A build name that is already here is refused, never overwritten. Ids that clash are given new ids.</p>
            </div>
          </Section>

          <Section title="Delete everything" id="erase" description="Removes every build, Echo, rotation, setting and undo step from this browser.">
            {eraseStep === 'idle' ? (
              <Button variant="quiet" icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => setEraseStep('first')}>
                Erase everything
              </Button>
            ) : null}

            {eraseStep === 'first' ? (
              <div role="alertdialog" aria-label="Erase everything?" className="rounded-panel border border-loss bg-raised p-4">
                <p className="font-medium">Erase all {buildCount === 1 ? 'build' : 'builds'} and everything else?</p>
                <p className="mt-1 text-ink-2">This cannot be undone. Back up first if you might want any of it later.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => setEraseStep('typed')}>Continue</Button>
                  <Button variant="quiet" onClick={() => setEraseStep('idle')}>
                    Keep my work
                  </Button>
                </div>
              </div>
            ) : null}

            {eraseStep === 'typed' ? (
              <div role="alertdialog" aria-label="Last check before erasing" className="rounded-panel border border-loss bg-raised p-4">
                <p className="font-medium">Last check</p>
                <p className="mt-1 text-ink-2">Type erase below, then choose Erase everything. This is the second and final confirmation.</p>
                <label className="mt-3 flex flex-col gap-1">
                  <span className="text-13 text-ink-2">Type erase</span>
                  <input
                    value={eraseWord}
                    onChange={(event) => setEraseWord(event.target.value)}
                    autoComplete="off"
                    className="min-h-11 rounded-control border border-rule bg-page px-3 text-ink focus:border-signal focus:outline-none md:min-h-9"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button disabled={eraseWord.trim().toLowerCase() !== 'erase'} onClick={() => void erase()}>
                    Erase everything
                  </Button>
                  <Button
                    variant="quiet"
                    onClick={() => {
                      setEraseStep('idle')
                      setEraseWord('')
                    }}
                  >
                    Keep my work
                  </Button>
                </div>
              </div>
            ) : null}
          </Section>

          <p className="flex items-start gap-2 px-1 text-12 text-ink-3">
            <HardDriveDownload size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            Saved with IndexedDB, with a small backup in local storage when you leave the page. Clearing browser data for this site removes it too.
          </p>
        </div>
      </div>
    </div>
  )
}
