# Phase 3 verification: Optimizer

Date: 11 Nov 2026. Branch `build/v1`.

## Gate

- `npm run typecheck`, `npm run lint`: pass.
- `npm test`: 36 files, 1133 tests pass. New:
  - `tests/engine/optimize/search.test.ts` (10): three random 24-Echo inventories give exactly the top results of trying every combination; each result's damage equals a full simulation; stat limits respected (and still equal to brute force); main Echo lock; allowed sets; generated plans; skipping weaker copies changes nothing; stopping returns promptly.
  - `tests/engine/optimize/monotone.test.ts` (2): no set or Echo effect in the data is negative, which the bound relies on.
  - `tests/engine/stats/pieces-override.test.ts` (2), `tests/workers/optimizer-pool.test.ts` (2: same results as one search; cancel within a second), inventory store tests (2).
- `npm run test:e2e`: 52 runs pass at 1440 and 390, plus axe and the screen-edge check on `/optimizer` (4 more, run separately). `tests/e2e/optimizer.spec.ts`:
  - a search of my Echoes finishes and a result saves as a named build;
  - a long search shows progress and a time estimate, a switch answers within a second while it runs, and Cancel stops it within a second.

## Timing (`npx tsx scripts/verify/optimizer-timing.ts`, `optimizer-timing.json`)

Random inventories (seed 42, three sets), sample build, keep 10, this machine (16 cores, pool of 8 workers):

| Echoes | Pool of 8 | One thread (Node) |
|---|---|---|
| 50 | 0.7 s | |
| 100 | 0.9 s | |
| 300 | 4.4 s | 16.2 s |

Both give the same best result (160,682 for 300 Echoes). Phones use at most 2 workers.

Search speed-ups made while measuring: bound from the sum of the best few values of each stat per Echo cost, respecting the cost left (157 s to 42 s single-thread on an earlier inventory), evaluators looked up by a numeric hash (42 s to 23 s).

## Screens inspected (opened and looked at)

- `optimizer-1440.png`: setup with no Echoes; the start button is disabled with the reason beside it.
- `state-results-mine-1440.png`: six Echoes; result 1 is the current build ("Same as your build now"); the others lose 25% to 45% with a reason each.
- `state-running-390.png`: generated plan while running: "Searching: 9% done. About 8 seconds left.", "2 workers"; 4-4-3-1 layouts appear (legal, cost 12).
- `state-cancelled-1440.png`: "Stopped after 1.5 seconds..." with the best plan so far equal to the current build.

## Known and NOT CHECKED

- Generated plans list many exact ties (the same damage from different 1-cost Echo kinds). Correct, but noisy; grouping ties is left for later.
- The Echo picker says "This slot can hold an Echo costing up to 4" when adding to the inventory; the wording fits the Build page better.
- Not opened: `state-setup-empty-390.png`, `state-inventory-editor-*`, `state-sets-sheet-*`, `state-cancelled-390.png`, `state-results-mine-390.png`, the phone page slices.
