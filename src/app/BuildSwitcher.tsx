import { ChevronDown, Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { defaultBuildFor } from '../data/defaults'
import { ResonatorPicker } from '../features/build/pickers'
import { Button, IconButton } from '../ui/Button'
import { Portrait } from '../ui/ElementChip'
import { Sheet } from '../ui/Sheet'
import { useActions, useCatalog, useWorkspace } from './context'

/** The build name in the header. Opens the list of saved builds. */
export function BuildSwitcher({ compact = false }: { compact?: boolean }) {
  const catalog = useCatalog()
  const actions = useActions()
  const builds = useWorkspace((s) => s.library.builds)
  const order = useWorkspace((s) => s.library.order)
  const activeId = useWorkspace((s) => s.session.activeBuildId)
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const active = activeId ? builds[activeId] : undefined
  const resonator = active ? catalog.resonators[active.resonator.id] : undefined

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 max-w-full min-w-0 items-center gap-2 rounded-control px-2 text-left hover:bg-raised md:min-h-10"
        aria-label={`Builds. Current: ${active?.name ?? 'none'}`}
      >
        {resonator ? <Portrait name={resonator.name} element={resonator.element} size={compact ? 28 : 32} /> : null}
        <span className="min-w-0">
          <span className="block truncate font-medium">{active?.name ?? 'No build yet'}</span>
          {!compact && resonator ? <span className="block truncate text-12 text-ink-3">{resonator.name}</span> : null}
        </span>
        <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-ink-3" />
      </button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Your builds"
        description="Builds save in this browser as you work."
        footer={
          <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setPicking(true)}>
            New build
          </Button>
        }
      >
        <ul className="-mx-2">
          {order.map((id) => {
            const build = builds[id]
            if (!build) return null
            const r = catalog.resonators[build.resonator.id]
            const isActive = id === activeId
            return (
              <li key={id} className={`flex items-center gap-2 border-b border-rule px-2 py-2 ${isActive ? 'shadow-[inset_2px_0_0_var(--color-signal)]' : ''}`}>
                {renaming === id ? (
                  <form
                    className="flex flex-1 items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      const name = String(new FormData(event.currentTarget).get('name') ?? '').trim()
                      if (name) actions.renameBuild(id, name)
                      setRenaming(null)
                    }}
                  >
                    <label className="sr-only" htmlFor={`rename-${id}`}>
                      Build name
                    </label>
                    <input
                      id={`rename-${id}`}
                      name="name"
                      defaultValue={build.name}
                      autoFocus
                      className="min-h-11 flex-1 rounded-control border border-rule bg-page px-3 focus:border-signal focus:outline-none md:min-h-9"
                    />
                    <Button type="submit">Save name</Button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        actions.switchBuild(id)
                        setOpen(false)
                      }}
                      className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-control text-left hover:bg-raised"
                      aria-current={isActive ? 'true' : undefined}
                    >
                      {r ? <Portrait name={r.name} element={r.element} /> : null}
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{build.name}</span>
                        <span className="block truncate text-13 text-ink-3">
                          {r?.name}, level {build.resonator.level}, Sequence {build.resonator.sequence}
                          {isActive ? ', open now' : ''}
                        </span>
                      </span>
                    </button>
                    <IconButton label={`Rename ${build.name}`} onClick={() => setRenaming(id)}>
                      <Pencil size={16} aria-hidden="true" />
                    </IconButton>
                    <IconButton label={`Duplicate ${build.name}`} onClick={() => actions.duplicateBuild(id)}>
                      <Copy size={16} aria-hidden="true" />
                    </IconButton>
                    <IconButton label={`Delete ${build.name}`} onClick={() => setConfirmDelete(id)}>
                      <Trash2 size={16} aria-hidden="true" />
                    </IconButton>
                  </>
                )}
              </li>
            )
          })}
        </ul>
        {confirmDelete ? (
          <div role="alertdialog" aria-labelledby="delete-title" className="mt-4 rounded-panel border border-rule bg-raised p-4">
            <p id="delete-title" className="font-medium">
              Delete {builds[confirmDelete]?.name}?
            </p>
            <p className="mt-1 text-ink-2">This removes the build and its undo history from this browser.</p>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={() => {
                  actions.deleteBuild(confirmDelete)
                  setConfirmDelete(null)
                }}
              >
                Delete build
              </Button>
              <Button variant="quiet" onClick={() => setConfirmDelete(null)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : null}
      </Sheet>

      <ResonatorPicker
        open={picking}
        onOpenChange={setPicking}
        title="Start a new build"
        onPick={(id) => {
          actions.addBuild(defaultBuildFor(id, catalog))
          setPicking(false)
          setOpen(false)
        }}
      />
    </>
  )
}
