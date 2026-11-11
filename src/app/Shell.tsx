import { FlaskConical, GitCompareArrows, Layers, Redo2, Undo2, X } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useStore } from 'zustand'
import { Button, IconButton } from '../ui/Button'
import { Meter } from '../ui/Meter'
import { BuildSwitcher } from './BuildSwitcher'
import { useActions, useWorkspace } from './context'
import { notices } from './notices'
import { ResultsProvider, useResults } from './results'

const NAV = [
  { to: '/build', label: 'Build', icon: FlaskConical },
  { to: '/saved', label: 'Saved builds', short: 'Saved', icon: Layers },
  { to: '/compare', label: 'Compare', icon: GitCompareArrows },
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
      <span className="font-display text-20 tabular-nums">{Math.round(score.percent)}%</span>
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
    <div role="status" className="border-b border-signal-dim bg-raised">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 px-4 py-2 md:px-6">
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

export function Shell() {
  useUndoKeys()
  return (
    <ResultsProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-signal focus:px-3 focus:py-2 focus:text-on-signal">
        Skip to content
      </a>

      {/* Desktop header: wordmark, build, score, undo; tools beneath. */}
      <header className="sticky top-0 z-20 border-b border-rule bg-page/95 backdrop-blur-none">
        <div className="mx-auto flex max-w-[1280px] items-center gap-2 px-2 py-2 md:gap-4 md:px-6">
          <span className="hidden font-display text-16 md:inline">theWuthering</span>
          <div className="min-w-0 flex-1 md:flex-none">
            <BuildSwitcher compact />
          </div>
          <div className="ml-auto hidden md:block">
            <HeaderScore />
          </div>
          <div className="md:hidden">
            <HeaderScore compact />
          </div>
          <UndoRedo />
        </div>
        <nav aria-label="Tools" className="mx-auto hidden max-w-[1280px] gap-1 px-4 md:flex md:px-6">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `inline-flex min-h-10 items-center border-b-2 px-3 text-14 transition-colors duration-150 ${
                  isActive ? 'border-signal text-ink' : 'border-transparent text-ink-2 hover:text-ink'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <PreviewStrip />

      <main id="main" className="mx-auto max-w-[1280px] px-4 pt-4 pb-28 md:px-6 md:pb-12">
        <Outlet />
      </main>

      {/* Phone: tools in a bottom bar within thumb reach. */}
      <nav aria-label="Tools" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-rule bg-page md:hidden">
        {NAV.map(({ to, label, icon: Icon, ...rest }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-0.5 text-12 ${isActive ? 'text-signal' : 'text-ink-2'}`
            }
          >
            <Icon size={20} aria-hidden="true" />
            {'short' in rest ? rest.short : label}
          </NavLink>
        ))}
      </nav>

      <Notices />
    </ResultsProvider>
  )
}
