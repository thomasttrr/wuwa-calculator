# Phase 2 verification: Suggestions

Date: 11 Nov 2026. Branch `build/v1`.

## Gate

- `npm run typecheck`, `npm run lint`: pass.
- `npm test`: 32 files, 1110 tests pass. New: `tests/engine/suggest/suggest.test.ts` (19), `tests/explain/suggestion.test.ts` (7), owned-weapon store test.
- `npm run test:e2e`: 46 runs pass at 1440 and 390, including axe and the screen-edge check on `/suggestions`, and `tests/e2e/suggestions.spec.ts`:
  - Try it changes the header score; Discard restores it.
  - The step-by-step path applies three changes; undo takes them back one at a time to the exact earlier score.
  - Substats name the next best roll.

## Screens inspected (opened and looked at)

- `suggestions-1440.png`, `suggestions-390-screen1..2.png`: Weapons mode on the sample build. Every alternative is a loss (the sample is already the best single-change build); the page says "Nothing here beats what you have now. These come closest."
- `state-path-weakened-1440.png`: three Echo main stats set to HP%. Main stats mode lists the fixes with score points; the step-by-step panel shows Crit. Rate 22.0% (+24.2%), ATK% 30.0% (+13.3%), ATK% 18.0% (+7.0%), running total +50.5%.
- `state-mode-substats-1440.png`: "Your next best roll is Crit. Rate on any Echo." HP and DEF rows show "Nothing".
- `state-mode-sets-1440.png`, `state-mode-sets-390.png`: Freezing Frost carries the Unverified mark.
- `state-mode-whole-builds-390.png`, `state-trying-390.png`, `state-owned-sheet-1440.png`.

Faults found by looking and fixed:
1. Phone rows squeezed the reason into a narrow column. The gain and Try it now sit under the text below 640px.
2. Trying a weapon that loses 6.8% damage raised the header score from 93% to 95%, because a new weapon re-scales the score. Correct by design, but unexplained. A note above the list now says to compare by damage when the setup changes.
3. Sets with unverified source data (Freezing Frost, Havoc Eclipse) had no mark. They now show Unverified.
4. Single changes in Whole builds read "1 change together".

## NOT CHECKED

- `state-mode-main-stats-*`, `state-owned-only-*`, `state-mode-whole-builds-1440.png`, `state-trying-1440.png` and the phone slices after screen 2 were saved but not opened.

## Review (after the gate)

Opened `state-trying-1440.png` and `state-owned-only-1440.png`. Code read of the Phase 2 diff. Fixed:
1. The strip read "Trying: Suggested: Ages of Harvest" and undo read "Undo: Suggested: ...". Suggestions now use the Build page's own wording ("Equipped Ages of Harvest", "Set Echo 1 main stat to Crit. Rate", "Moved every Echo to ...").
2. The rank number used `aria-label` on a plain span, which screen readers ignore. Now visible text is hidden from them and a screen-reader sentence is added.
3. For a Resonator whose hits scale on different stats (ATK and HP), the reason averaged them into one meaningless number. It now gives the percentage change instead (test added; watched it fail first).

Open point, not fixed: the step-by-step panel re-ranks about 270 simulations whenever the build changes (about 0.2 s on this machine). Fine here; worth measuring on a phone in Phase 5.
