# Phase 2: Suggestions (Area 4)

Goal: a Suggestions page that ranks changes to the shared build by how much damage they add, says why in one plain sentence, lets the player try any of them without saving, and walks an upgrade path one step at a time.

Measured: one full rotation simulation of the sample build takes about 0.8 ms and a compile 0.35 ms, so every ranking runs on the page itself. No worker is needed (re-measure if a mode goes over 100 ms).

## Rules

- Every gain is the change in rotation average damage, re-simulated with the full engine, never estimated.
- A change that alters the setup (weapon, set) changes the score's scale too, so those show damage gained only. Main stat and substat changes keep the scale, so they also show score points.
- Effects of a suggested weapon or set use their default switch state. A visible switch, "Count every condition as met", turns the candidate's own effects fully on. Its state is part of every sentence that depends on it.
- Gains under 0.1% read "No real difference". Equal gains (within 0.01%) are grouped as ties.
- "Only what I own" restricts weapons to a checklist kept in the library (`ownedWeaponIds`). Echo inventory arrives in Phase 3.
- Set suggestions are 5 pieces of one set, keeping every Echo's stats and the main Echo; the sentence says when your current Echoes cannot belong to that set.

## Tasks (test first)

1. `src/engine/suggest/change.ts`: `Change` type and `applyChange` (pure). Tests: each kind changes only what it says; conditions switch only the candidate's own effects.
2. `src/engine/suggest/rank.ts`: `rankWeapons`, `rankMainStats`, `rankSets`, `rankSubstats`, `rankWholeBuilds`, `upgradePath`. Tests: every ranking equals a direct re-simulation of each alternative; sorted by gain; owned-only filter; upgrade path never repeats a change and each step does not lower damage.
3. `src/explain/suggestion.ts`: the sentence (which formula term moved most, and how crowded it already was) and the farming goal. Tests: constructed cases where the cause is known.
4. Store: `setOwnedWeapon(id, owned)`. Test in `tests/state`.
5. Page `/suggestions` with five modes, Try it (preview), Keep, Discard, upgrade path with per-step undo, owned-only checklist. Tool tab added.
6. e2e: Try it changes the header score, Discard restores it; upgrade path applies three steps and undo walks them back. Screens at 1440 and 390. Report, commit.
