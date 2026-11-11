import { describe, expect, it } from 'vitest'
import { createWorkspaceStore, emptyWorkspace, selectActiveBuild, selectBuildView } from '../../src/state/store'
import type { Build } from '../../src/engine/types/build'
import { bareBuild } from '../engine/fixtures/builds'

const build = (id: string, name = id): Build => ({ ...bareBuild(1402), id, name })

function storeWith(...builds: Build[]) {
  const store = createWorkspaceStore(emptyWorkspace())
  for (const b of builds) store.getState().addBuild(b)
  return store
}

describe('workspace store: builds', () => {
  it('starts empty with no active build', () => {
    const store = createWorkspaceStore(emptyWorkspace())
    expect(selectActiveBuild(store.getState())).toBeNull()
  })

  it('adding a build makes it active and keeps the order', () => {
    const store = storeWith(build('a'), build('b'))
    expect(store.getState().library.order).toEqual(['a', 'b'])
    expect(selectActiveBuild(store.getState())?.id).toBe('b')
  })

  it('switches, renames, duplicates and deletes builds', () => {
    const store = storeWith(build('a', 'First'), build('b', 'Second'))
    store.getState().switchBuild('a')
    expect(selectActiveBuild(store.getState())?.name).toBe('First')

    store.getState().renameBuild('a', 'Main team')
    expect(store.getState().library.builds.a?.name).toBe('Main team')

    const copyId = store.getState().duplicateBuild('a')
    expect(store.getState().library.builds[copyId]?.name).toBe('Main team (copy)')
    expect(store.getState().library.order).toEqual(['a', copyId, 'b'])
    expect(store.getState().session.activeBuildId).toBe(copyId)

    store.getState().deleteBuild(copyId)
    expect(store.getState().library.builds[copyId]).toBeUndefined()
    expect(store.getState().session.activeBuildId).toBe('a')
  })

  it('deleting the last build leaves no active build', () => {
    const store = storeWith(build('a'))
    store.getState().deleteBuild('a')
    expect(selectActiveBuild(store.getState())).toBeNull()
  })
})

describe('workspace store: edits and history', () => {
  it('an edit changes the active build and can be undone and redone exactly', () => {
    const store = storeWith(build('a'))
    const before = selectActiveBuild(store.getState())
    store.getState().applyEdit((draft) => {
      draft.resonator.level = 80
    }, 'Set level to 80')
    expect(selectActiveBuild(store.getState())?.resonator.level).toBe(80)

    store.getState().undo()
    expect(selectActiveBuild(store.getState())).toEqual(before)

    store.getState().redo()
    expect(selectActiveBuild(store.getState())?.resonator.level).toBe(80)
  })

  it('a new edit clears the redo list', () => {
    const store = storeWith(build('a'))
    store.getState().applyEdit((d) => void (d.resonator.level = 80), 'Level 80')
    store.getState().undo()
    store.getState().applyEdit((d) => void (d.resonator.level = 70), 'Level 70')
    expect(store.getState().history.a?.future).toEqual([])
    store.getState().redo()
    expect(selectActiveBuild(store.getState())?.resonator.level).toBe(70)
  })

  it('history is kept per build', () => {
    const store = storeWith(build('a'), build('b'))
    store.getState().applyEdit((d) => void (d.resonator.level = 50), 'Level 50') // on b
    store.getState().switchBuild('a')
    store.getState().undo() // nothing to undo on a
    expect(store.getState().library.builds.b?.resonator.level).toBe(50)
    expect(store.getState().library.builds.a?.resonator.level).toBe(90)
  })

  it('labels the last change so the interface can say what happened', () => {
    const store = storeWith(build('a'))
    store.getState().applyEdit((d) => void (d.resonator.sequence = 2), 'Set Sequence to 2')
    expect(store.getState().history.a?.past.at(-1)?.label).toBe('Set Sequence to 2')
  })

  it('keeps at most 100 steps of history', () => {
    const store = storeWith(build('a'))
    for (let i = 0; i < 120; i += 1) store.getState().applyEdit((d) => void (d.resonator.level = (i % 90) + 1), `Edit ${i}`)
    expect(store.getState().history.a?.past).toHaveLength(100)
    expect(store.getState().history.a?.past[0]?.label).toBe('Edit 20')
  })

  it('an edit that changes nothing does not add a history step', () => {
    const store = storeWith(build('a'))
    store.getState().applyEdit((d) => void (d.resonator.level = 90), 'No change')
    expect(store.getState().history.a?.past ?? []).toHaveLength(0)
  })
})

describe('workspace store: preview', () => {
  it('a preview shows in the build view without touching the saved build or history', () => {
    const store = storeWith(build('a'))
    store.getState().setPreview((d) => void (d.resonator.sequence = 6), 'Try Sequence 6')
    expect(selectBuildView(store.getState())?.resonator.sequence).toBe(6)
    expect(selectActiveBuild(store.getState())?.resonator.sequence).toBe(0)
    expect(store.getState().history.a?.past ?? []).toHaveLength(0)
    expect(store.getState().session.preview?.label).toBe('Try Sequence 6')
  })

  it('keeping a preview makes it one undoable edit', () => {
    const store = storeWith(build('a'))
    store.getState().setPreview((d) => void (d.resonator.sequence = 6), 'Try Sequence 6')
    store.getState().keepPreview()
    expect(selectActiveBuild(store.getState())?.resonator.sequence).toBe(6)
    expect(store.getState().session.preview).toBeNull()
    store.getState().undo()
    expect(selectActiveBuild(store.getState())?.resonator.sequence).toBe(0)
  })

  it('discarding a preview restores the view', () => {
    const store = storeWith(build('a'))
    store.getState().setPreview((d) => void (d.resonator.sequence = 6), 'Try Sequence 6')
    store.getState().discardPreview()
    expect(selectBuildView(store.getState())?.resonator.sequence).toBe(0)
  })

  it('a real edit or a build switch drops any preview', () => {
    const store = storeWith(build('a'), build('b'))
    store.getState().setPreview((d) => void (d.resonator.sequence = 6), 'Try')
    store.getState().applyEdit((d) => void (d.resonator.level = 80), 'Level 80')
    expect(store.getState().session.preview).toBeNull()
    store.getState().setPreview((d) => void (d.resonator.sequence = 6), 'Try')
    store.getState().switchBuild('a')
    expect(store.getState().session.preview).toBeNull()
  })
})
