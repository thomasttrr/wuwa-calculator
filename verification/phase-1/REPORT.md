# Phase 1 verification

Date: 11 Nov 2026. Branch `build/v1`.

## Commands (full output saved beside this file)

| Command | Result | File |
|---|---|---|
| `npm run build` | Passed. Warning: main bundle 785 kB (196 kB gzipped), mostly effect data; weapons file 809 kB (87 kB gzipped), loaded on start | `build.txt` |
| `npm test` | Passed: 28 files, 1,050 tests | `test.txt` |
| `npm run lint` | Passed: no problems | `lint.txt` |
| `npm run data:check` | Passed | `data-check.txt` |
| `npm run test:e2e` | Passed: 32 runs (14 tests at 1440px and 390px, plus 2 screen-capture runs at each width) | `e2e.txt` |

End-to-end tests (`tests/e2e/build.spec.ts`), each at desktop and phone width:
- first run loads the sample build and guide; the guide stays dismissed after reload
- changing one Echo substat changes the score and says what changed ("Score +N points"); undo restores the exact score
- the Resonator picker works with the keyboard alone (focus starts in search, arrows, Enter)
- edits survive a reload
- a change made just before leaving the page is kept (this test found a real bug, now fixed)
- Show everything reveals expert controls
- How this was calculated opens the whole-build sheet
- comparing two builds after duplicating one shows "Same setup"
- axe finds no WCAG 2.2 A or AA violations on /build, /saved, /compare
- nothing runs past the screen edge on /build, /saved, /compare

## Screens rendered and inspected

Rendered by `npm run verify:screens -- phase-1 build=build` and `npx playwright test screens`. Phone pages were also inspected as screen-sized slices (`build-390-screen1.png` to `screen7`).

| Screen | 1440px | 390px |
|---|---|---|
| Build, sample (`build-*.png`) | Inspected. Editor left, score and results right, no gap between score and tabs after fix. Score 92.8%, grade B, verdict "Held back most by low Crit. Rate...", setup note inside the score, stamp | Inspected (7 slices). Score first, then editor, then results. Meter and text inside the 16px gutter after fix |
| Resonator picker (`state-resonator-picker-*`) | Inspected. Search, element, weapon, rarity and model filters, Basic model marks, backdrop dimmed after fix | Inspected. Full-height sheet, search focused at top |
| Echo editor (`state-echo-editor-*`) | Inspected. Set, main stat, fixed stat, five substat rows with legal rolls | Inspected |
| Hit formula (`state-hit-formula-*`) | Inspected. Stat x multiplier, each term, non-crit, crit, average, enemy inputs | Inspected |
| How this was calculated (`state-ledger-sheet-*`) | Inspected | Inspected. Grouped entries, each opens to its parts |
| What the score means (`state-score-meaning-*`) | Inspected | Inspected. Anchors in damage, best main stats, useful substats, grade bands, Energy Regen note |
| Show everything (`state-show-everything-*`) | Inspected. Skill levels, skill tree nodes, resistances, own buffs | Inspected |
| Build list (`state-build-list-*`) | Inspected | Inspected |
| New empty build (`state-new-empty-build-*`) | Inspected. Empty states say what to do in one sentence each; score 0.0% with "No Echoes equipped yet. Add Echoes to raise this score."; guide hidden after fix | Inspected |
| Saved builds (`state-saved-*`) | Inspected | Inspected. Score left-aligned after fix |
| Compare (`state-compare-*`) | Inspected. Setup differences in plain words, side-by-side table, damage by skill with headings after fix | Inspected. No sideways scroll; same-named skills told apart |

## Faults found by inspection and tests, all fixed

1. Edits made within 300 ms of leaving the page were lost (in-flight IndexedDB write abandoned on unload). Fixed with a synchronous backup on leaving.
2. Button names that screen readers announced differently from their visible text; three identical "Change" buttons in one section.
3. Picker sheets focused the close button instead of the search field.
4. Empty gap under the score on desktop; content past the right gutter on phone; the screenshot script's edge check was too weak to catch it and was strengthened.
5. Sheet backdrop not dimmed (the token reset removed Tailwind's black).
6. "Verina: Verina: Gift of Nature" doubled names; the first-run guide showing on non-sample builds; several different skills all labelled "Skill DMG".

## NOT CHECKED

- Real phones and touch dragging (phone width is emulated in desktop Chromium).
- Browsers other than Chromium.
- In-game accuracy of any number (the engine implements the public community formula; no in-game comparison yet).
- Behaviour with two tabs open at once: the plan's "reload the newer version" notice is not built yet (see REPORT.md).
- Screen reader use by a person; only automated axe checks ran.
