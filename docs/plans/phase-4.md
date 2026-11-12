# Phase 4: Rotation (Area 6)

Goal: edit the shared build's rotation as a list of plain-named steps (add by typing, drag to reorder by mouse, touch and keyboard, switch off, time, annotate, loop), with buffs that start at a step, a timeline beside the numbers, per-step results and breakdowns, saved rotations (save, use, import, export, compare) and a one-screen summary to follow in game.

Already in the engine and tested since Phase 0/1: steps, one level of loops, switched-off steps and loops, effect changes "from here on" and "this step only", breakdowns by type, element and action, times only when every step has one.

## Tasks (test first)

1. `src/engine/rotation/edit.ts`: pure edits (add, remove, duplicate, move within its list, update a step or loop, put a step in a new loop, take a loop apart, move a step into or out of a loop). Loops stay one level deep.
2. `StepResult.states` and `effectSpans`: which effects the rotation switches are on at each counted step, for the buff bars.
3. Share format (`src/state/rotation-share.ts`): export as text, import back identical; plain errors for wrong files, another Resonator's rotation, unknown actions.
4. Saved rotations in the library (`library.rotations`, schema 2 with a migration): save, use on the build (one undo step), delete, compare.
5. Page `/rotation`: list editor with dnd-kit (handle only, so touch scrolling still works), step search, inspector, loops, timeline, results, breakdowns, summary. Damage per second only when every step has a time.
6. e2e: reorder by mouse, by touch and by keyboard; the shared-build check (change one Echo, the same new score on Build, Suggestions, Optimizer and Rotation). Screens at 1440 and 390. Report, commit.
