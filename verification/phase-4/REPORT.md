# Phase 4 verification: Rotation

Date: 11 Nov 2026. Branch `build/v1`.

## Gate

- `npm run typecheck`, `npm run lint`: pass.
- `npm test`: 40 files, 1177 tests pass. New: rotation edits (9), effect spans (4, including the stack bug below), summary (3), rotation sharing (4), saved rotations store and the schema 2 migration (2), damage-type colour contrast and no-yellow checks (18).
- `npm run test:e2e`: 68 runs pass, 2 skipped by design (mouse drag is desktop-only, touch drag phone-only). New, at 1440 and 390:
  - reorder by mouse (then undo), by keyboard alone, by touch (CDP touch events on the phone);
  - add a step by typing; the summary lists steps;
  - the brief's shared-build check: one Echo change gives the same new score on Build, Suggestions, Optimizer and Rotation;
  - axe and the screen-edge check on `/rotation`.

## Faults found and fixed

1. **Switching a stacking effect "on" at a step reset its stacks.** Verdant Summit at 2 of 2 stacks, switched on at step 2, fell to its default of 0; the rotation lost 8.6% and the buff bar showed it off. A change without a stack count now keeps the stacks the effect already had (engine test added, watched it fail with the same numbers first), and the panel shows the stacks that will apply.
2. **The first reorder tests passed without testing anything.** Each row's accessible name began with the visible number, so the pattern found no rows and "before" and "after" were both empty lists. Rows now carry `data-step-name`; the order helper waits for at least three rows; screen-reader text comes first.
3. Keyboard reorder needs a short pause between keys (the list measures between moves); touch drag near the screen bottom auto-scrolls, so the touch test starts mid-screen.
4. Phone header: the four figures squeezed beside the title; they now wrap below it.
5. The Liberation timeline colour (#F4EFE6) failed the no-yellow test; now #DCE6EE.

## Screens inspected

`rotation-1440.png`, `rotation-390-screen1.png`, `state-loop-and-buff-1440.png` and `-390.png` (after the fix: Repeat 2 times, buff bar across every step, 202,454 = 198,042 + one more Stage 1 at 4,412), `state-inspector-390.png`, `state-saved-compare-1440.png`.

## Known and NOT CHECKED

- Jiyan's Forte and Liberation hits count as Heavy Attack in the game data, so the timeline legend shows Heavy for them. That is the data, not a fault.
- Not opened: `state-breakdowns-*`, `state-summary-*`, `state-inspector-1440.png`, `state-saved-compare-390.png`, phone page slices after screen 1.
