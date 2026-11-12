import { BookOpen, FlaskConical, Gauge, GitCompareArrows, Home, Image, Layers, Lightbulb, ListOrdered, Menu, Redo2, Settings, Undo2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { useStore } from 'zustand'
import { BorderBeam } from '../ui/BorderBeam'
import { Button, IconButton } from '../ui/Button'
import { Meter } from '../ui/Meter'
import { Sheet } from '../ui/Sheet'
import { BuildSwitcher } from './BuildSwitcher'
import { useActions, useSaving, useSavingActions, useWorkspace } from './context'
import { notices } from './notices'
import { ResultsProvider, useResults } from './results'

const TOOLS = [
  { to: '/build', label: 'Build', short: 'Build', icon: FlaskConical },
  { to: '/suggestions', label: 'Suggestions', short: 'Suggest', icon: Lightbulb },
  { to: '/optimizer', label: 'Optimizer', short: 'Optimize', icon: Gauge },
  { to: '/rotation', label: 'Rotation', short: 'Rotation', icon: ListOrdered },
  { to: '/saved', label: 'Saved builds', short: 'Saved', icon: Layers },
  { to: '/compare', label: 'Compare', short: 'Compare', icon: GitCompareArrows },
  { to: '/card', label: 'Card', short: 'Card', icon: Image },
] as const

const PAGES = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/guide', label: 'Guide', icon: BookOpen, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
] as const

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function useUndoKeys() {
  const actions = useActions()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || isTyping(event.target)) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        actions.undo()
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault()
        actions.redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actions])
}

function UndoRedo() {
  const actions = useActions()
  const activeId = useWorkspace((s) => s.session.activeBuildId)
  const history = useWorkspace((s) => (activeId ? s.history[activeId] : undefined))
  const last = history?.past.at(-1)
  const next = history?.future[0]
  return (
    <div className="flex items-center">
      <IconButton label={last ? `Undo: ${last.label}` : 'Nothing to undo'} disabled={!last} onClick={() => actions.undo()}>
        <Undo2 size={18} aria-hidden="true" />
      </IconButton>
      <IconButton label={next ? `Redo: ${next.label}` : 'Nothing to redo'} disabled={!next} onClick={() => actions.redo()}>
        <Redo2 size={18} aria-hidden="true" />
      </IconButton>
    </div>
  )
}

function HeaderScore({ compact = false }: { compact?: boolean }) {
  const results = useResults()
  const score = results?.score
  if (!results) return null
  if (!score) return <span className="text-13 text-ink-3">Scoring</span>
  return (
    <div className={`flex items-center gap-3 ${compact ? '' : 'w-64'}`}>
      <span data-header-score className="font-display text-20 tabular-nums">
        {Math.round(score.percent)}%
      </span>
      {compact ? null : (
        <div className="min-w-0 flex-1 pt-1.5">
          <Meter
            value={score.percent}
            label="Build score"
            valueText={`${score.percent.toFixed(1)} percent, grade ${score.grade}`}
            ticks={[
              { at: 0, label: '' },
              { at: 100, label: '' },
              { at: 200, label: '' },
            ]}
          />
        </div>
      )}
    </div>
  )
}

function PreviewStrip() {
  const actions = useActions()
  const preview = useWorkspace((s) => s.session.preview)
  if (!preview) return null
  return (
    <div role="status" className="mx-auto max-w-[1280px] px-4 pt-2 md:px-6">
      <div className="relative flex flex-wrap items-center gap-3 rounded-panel bg-raised px-4 py-3">
        <BorderBeam colours="frost" duration={6} size={140} />
        <span className="text-ink">
          Trying: <span className="font-medium">{preview.label}</span>. Every tool shows this change until you keep or discard it.
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="primary" onClick={() => actions.keepPreview()}>
            Keep this change
          </Button>
          <Button variant="quiet" onClick={() => actions.discardPreview()}>
            Discard
          </Button>
        </div>
      </div>
    </div>
  )
}

/** A second tab saved a newer version. Both choices are explicit; nothing is overwritten until you pick. */
function SaveConflictNotice() {
  const { conflict } = useSaving()
  const saving = useSavingActions()
  if (!conflict) return null
  return (
    <div role="alert" className="mx-auto max-w-[1280px] px-4 pt-2 md:px-6">
      <div className="rounded-panel border border-rule-strong bg-raised px-4 py-3">
        <p className="font-medium text-ink">Another tab saved a newer version of your builds.</p>
        <p className="mt-1 max-w-[72ch] text-ink-2">
          This tab has changes that are not saved. Choose which version to keep. Nothing is overwritten until you choose.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void saving.keepLocal()}>
            Keep this tab's version
          </Button>
          <Button onClick={() => void saving.useRemote()}>Use the other tab's version</Button>
        </div>
      </div>
    </div>
  )
}

function Notices() {
  const messages = useStore(notices.store, (s) => s.messages)
  return (
    <div aria-live="polite" className="fixed inset-x-0 bottom-20 z-30 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {messages.map((message) => (
        <div key={message.id} className="flex max-w-xl items-start gap-3 rounded-panel border border-rule bg-raised px-4 py-3 shadow-float">
          <p className="text-ink">{message.text}</p>
          <IconButton label="Dismiss" onClick={() => notices.dismiss(message.id)}>
            <X size={16} aria-hidden="true" />
          </IconButton>
        </div>
      ))}
    </div>
  )
}

/** Settings that change the whole document: higher contrast and less motion. */
function useAppearance() {
  const highContrast = useWorkspace((s) => s.meta.settings.highContrast)
  const reduceMotion = useWorkspace((s) => s.meta.settings.reduceMotion)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.contrast = highContrast ? 'high' : 'normal'
    root.dataset.motion = reduceMotion ? 'reduce' : 'full'
  }, [highContrast, reduceMotion])
}

const iconLink = (isActive: boolean) =>
  `inline-flex size-11 items-center justify-center rounded-control md:size-9 ${
    isActive ? 'bg-raised text-ink shadow-[inset_0_-3px_0_var(--color-signal)]' : 'text-ink-2 hover:bg-raised hover:text-ink'
  }`

/** Below md the extra pages live behind one button, beside the tools in the bottom bar. */
function MorePages() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <IconButton label="More pages" className="md:hidden" onClick={() => setOpen(true)}>
        <Menu size={18} aria-hidden="true" />
      </IconButton>
      <Sheet open={open} onOpenChange={setOpen} title="Pages" description="Home, the guide, and where your data lives.">
        <ul className="grid gap-1">
          {PAGES.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex min-h-12 items-center gap-3 rounded-control px-3 ${
                    isActive ? 'bg-raised font-semibold text-ink' : 'text-ink-2 hover:bg-raised hover:text-ink'
                  }`
                }
              >
                <Icon size={20} aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  )
}

export function Shell() {
  useUndoKeys()
  useAppearance()
  return (
    <ResultsProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-signal focus:px-3 focus:py-2 focus:text-on-signal">
        Skip to content
      </a>

      {/* Header: build, score and undo; every tool sits on the row beneath. */}
      <header className="sticky top-0 z-20 bg-page">
        <div className="mx-auto flex max-w-[1280px] items-center gap-2 px-2 py-2 md:min-h-18 md:gap-4 md:px-6">
          <Link to="/" aria-label="theWuthering home" className="hidden shrink-0 rounded-control font-display text-16 md:inline-flex md:items-center">
            theWuthering
          </Link>
          <div className="min-w-0 flex-1 md:ml-auto md:flex-none">
            <BuildSwitcher compact />
          </div>
          <HeaderScore compact />
          <UndoRedo />
          <div className="hidden items-center md:flex">
            {PAGES.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} aria-label={label} title={label} className={({ isActive }) => iconLink(isActive)}>
                <Icon size={18} aria-hidden="true" />
              </NavLink>
            ))}
          </div>
          <MorePages />
        </div>
        <div className="hidden border-t border-rule md:block">
          <nav aria-label="Tools" className="mx-auto flex max-w-[1280px] gap-1 px-6">
            {TOOLS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `inline-flex min-h-10 items-center rounded-control px-3 text-14 transition-colors duration-150 ${
                    isActive ? 'bg-raised font-semibold text-ink shadow-[inset_0_-3px_0_var(--color-signal)]' : 'text-ink-2 hover:bg-panel hover:text-ink'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <SaveConflictNotice />
      <PreviewStrip />

      <main id="main" className="mx-auto max-w-[1280px] px-4 pt-4 pb-28 md:px-6 md:pb-12">
        <Outlet />
      </main>

      {/* Phone: all seven tools in a bottom bar within thumb reach. */}
      <nav aria-label="Tools" className="fixed inset-x-3 bottom-3 z-20 grid grid-cols-7 gap-1 rounded-panel bg-panel p-1.5 shadow-float md:hidden">
        {TOOLS.map(({ to, label, short, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-control text-12 ${
                isActive ? 'bg-raised font-semibold text-ink shadow-[inset_0_-3px_0_var(--color-signal)]' : 'text-ink-2'
              }`
            }
          >
            <Icon size={18} aria-hidden="true" />
            {short || label}
          </NavLink>
        ))}
      </nav>

      <Notices />
    </ResultsProvider>
  )
}
