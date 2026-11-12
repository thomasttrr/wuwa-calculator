import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useActions, useCatalog, useWorkspace } from '../../app/context'
import type { Build } from '../../engine/types/build'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/Section'
import { Sheet } from '../../ui/Sheet'
import { EchoPicker } from '../build/pickers'
import { EchoFields, newEcho } from '../echoes/EchoFields'
import { EchoSummary } from '../echoes/EchoSummary'

const SHOWN = 12

/** The player's own Echoes: what the Optimizer searches when the source is "My Echoes". */
export function Inventory({ build }: { build: Build }) {
  const catalog = useCatalog()
  const actions = useActions()
  const inventory = useWorkspace((s) => s.library.echoInventory)
  const [picking, setPicking] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const equipped = build.echoes.filter((e) => e !== null)
  const missing = equipped.filter((e) => !inventory.some((i) => i.uid === e.uid))
  const editingEcho = inventory.find((e) => e.uid === editing)
  const shown = showAll ? inventory : inventory.slice(-SHOWN).reverse()

  return (
    <section aria-labelledby="inventory-title" className="rounded-section bg-panel p-4 md:p-6">
      <h2 id="inventory-title" className="font-display text-16 md:text-20">
        My Echoes
      </h2>
      <p className="mt-1 text-13 text-ink-2">
        {inventory.length === 0 ? 'None yet.' : `${inventory.length} ${inventory.length === 1 ? 'Echo' : 'Echoes'}, saved in this browser.`} The Optimizer
        searches these when the source is "My Echoes".
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {missing.length > 0 ? (
          <Button onClick={() => actions.addEchoes(missing)}>
            Add my {missing.length} equipped {missing.length === 1 ? 'Echo' : 'Echoes'}
          </Button>
        ) : null}
        <Button variant="quiet" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setPicking(true)}>
          Add an Echo
        </Button>
      </div>

      {inventory.length === 0 ? (
        <div className="mt-3">
          <EmptyState>Add the Echoes you own, starting with the ones this build has equipped.</EmptyState>
        </div>
      ) : (
        <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2">
          {shown.map((echo) => (
            <li key={echo.uid}>
              <button
                type="button"
                onClick={() => setEditing(echo.uid)}
                className="flex w-full rounded-panel bg-raised px-3 py-2.5 hover:bg-[var(--color-rule)]"
              >
                <span className="sr-only">Edit </span>
                <EchoSummary echo={echo} note={build.echoes.some((e) => e?.uid === echo.uid) ? 'Equipped' : undefined} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {inventory.length > SHOWN ? (
        <Button variant="quiet" className="mt-2" onClick={() => setShowAll(!showAll)}>
          {showAll ? `Show the last ${SHOWN} added` : `Show all ${inventory.length}`}
        </Button>
      ) : null}

      <EchoPicker
        open={picking}
        onOpenChange={setPicking}
        maxCost={4}
        onPick={(echoId) => {
          const echo = newEcho(catalog, echoId)
          actions.addEchoes([echo])
          setPicking(false)
          setEditing(echo.uid)
        }}
      />

      {editingEcho ? (
        <Sheet
          open
          onOpenChange={(open) => !open && setEditing(null)}
          title={catalog.echoes[editingEcho.echoId]?.name ?? 'Echo'}
          description={`Cost ${editingEcho.cost}. Changes here edit your inventory, not any build.`}
          footer={
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => setEditing(null)}>
                Done
              </Button>
              <Button
                variant="quiet"
                icon={<Trash2 size={16} aria-hidden="true" />}
                onClick={() => {
                  actions.removeEcho(editingEcho.uid)
                  setEditing(null)
                }}
              >
                Remove from my Echoes
              </Button>
            </div>
          }
        >
          <EchoFields echo={editingEcho} name="this Echo" onChange={(next) => actions.updateEcho(next)} />
        </Sheet>
      ) : null}
    </section>
  )
}
