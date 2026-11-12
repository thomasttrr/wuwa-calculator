# Phase 3: Optimizer (Area 5)

Goal: find the best Echoes for the shared build from the player's own Echoes (or from generated ones), exactly, with live progress, a real cancel and a plain time estimate; save any result as a named build.

## Search (src/engine/optimize/)

- A result is a main Echo (slot 1) plus up to four more, total cost at most 12, every Echo a different instance. Fewer than five Echoes is allowed (4-4-4 is legal).
- Damage of a result: the compiled evaluator for that result's main Echo and set bonuses, on the sum of its Echo stats. A test checks this equals the full simulation.
- Set bonuses depend on which Echoes are chosen, so evaluators are cached by (main Echo, active set thresholds), using the engine-only `piecesOverride` (tested).
- Branch and bound: Echoes are taken in a fixed order; at each node the bound is the evaluator for the most set bonuses still reachable, on the chosen stats plus, for each remaining slot, the best value of every stat among the remaining Echoes. Valid because damage never falls when a stat rises or a set bonus is added (checked over every set and Echo effect by `tests/engine/optimize/monotone.test.ts`).
- Work is cut into units (main Echo, second Echo). The pool hands units to workers as they free up; workers share the current cut-off (the worst damage still in the kept results).
- Limits: `min`/`max` on Energy Regen, Crit. Rate, Crit. DMG and ATK, checked on the build's unscoped stat sheet; allowed sets; allowed main stats per cost; main Echo locked or free; results kept (1 to 50).
- Generated source: for each allowed set, Echoes of each cost with each allowed main stat (two Echo species per cost so five pieces are possible), no substats; your current substats are kept as a fixed total. The main Echo stays the one you have. It answers "which sets and main stats to aim for".

## Tasks (test first)

1. `piecesOverride` on Build (done, tested).
2. `search.ts`: `prepareProblem`, `planUnits`, `searchUnits`, `bruteForce`. Tests: random inventories of 20 to 30 Echoes give the same top results as brute force; each result's damage equals a full simulation; limits are respected; stopping early returns promptly with what it has.
3. Monotone test over every set and Echo effect.
4. Worker and pool (`src/workers/optimizer.*`): progress, estimate, cancel by terminating workers; main-thread fallback without workers.
5. Echo inventory: store actions (add, update, remove; not in build history), "Add my equipped Echoes", add and edit in a sheet sharing the Build page's Echo fields.
6. Page `/optimizer`: setup, run, progress, cancel, results with a plain sentence, Try it, Save as build.
7. e2e: run shows progress and an estimate; cancel stops within a second; a result saves as a build. Timing recorded for a 300-Echo inventory. Screens at 1440 and 390.
