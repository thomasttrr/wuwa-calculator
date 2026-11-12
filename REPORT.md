# theWuthering build report

Running report for the v1 build. One section per phase. Evidence for each phase is in `verification/phase-N/`.

## Phase 5: Card, saving hardening, Settings, Home, Guide and navigation (complete, 11 Nov 2026)

### What works now

The app has all seven tools and the pages around them. `/` is a dashboard for the open build and the next useful step; `/card` exports a real 1080 by 1350 picture made from the same calculation as the Build page; `/settings` holds player details, comfort options, new-build defaults, backup/restore, builds-and-rotations export/import, and a two-step erase; `/guide` explains the score, the formula and fair comparison. The desktop header shows every tool, with Home on the wordmark and Guide and Settings as icon links; the phone bottom bar shows all seven tools and puts Home, Guide and Settings behind **More pages**.

Saving now refuses to let two tabs overwrite each other silently. Each completed save carries a revision and the tab that wrote it. A newer save from another tab raises a visible notice and pauses autosave; the user chooses **Keep this tab's version** or **Use the other tab's version**, and nothing is overwritten before that choice. The leave-behind backup keeps revision and writer, so a stale tab's newer-looking backup cannot replace a newer save. Erasing broadcasts a reset so other tabs do not write their old copy back. A first run is saved immediately after the sample build is seeded, so the "saved" state is true before the first edit.

### Gate

- `npm run typecheck`, `npm run lint`: pass.
- `npm test`: 44 files, 1281 tests pass (baseline 1,177). New: two-tab saving (8), library file and backup (11), card model (5), card palette contrast across three palettes (66), and a leave-behind timestamp regression test. Existing persistence tests were extended for revisions and schema 3.
- `npm run test:e2e`: 98 tests, 96 pass, 2 skipped by design (mouse drag is desktop-only, touch drag phone-only). Phase 5 adds 28 passing runs, 14 at 1440 and 14 at 390: two-tab keep/use with reloads, export/erase/import plus a damaged file, real card numbers and a 1080 by 1350 PNG, and axe plus the screen-edge check on `/`, `/card`, `/settings`, `/guide` and `/guide/formula`.

### Improvements over the reference, by area

**Area 1, the shared build**
- Revisions and writer identity make two-tab saves explicit instead of last-write-wins.
- First-run persistence, a saved-time/revision readout, and one workspace behind every tool.
- One-click whole-workspace backup, validated restore, builds-and-rotations round trip, and a two-step erase.

**Area 5, sharing and the card**
- A phone-sized 1080 by 1350 card with the real score, damage, Echoes, bloom, team, rotation, patch and disclaimer.
- Three measured palettes, download, copy, and a data export.
- The card is honest about having no official art: its portrait is built from the Resonator's name, element, rarity and weapon type.

**Area 6, help and orientation**
- Home shows the open build and picks the next tool that is likely to help.
- Guide explains the live score anchors, the live hit formula and the conditions for fair comparison, without invented values.
- Settings owns the new-build defaults, comfort options and every data operation in one place.

**Navigation and design**
- All seven tools are always visible at 1440 and 390.
- Page links are labelled icon links; phone gets a seven-column bottom bar plus a **More pages** sheet.
- No arrows appended to button text; no yellow or purple on the card; higher contrast and reduced motion are real document-wide settings.

### Deviations from the plan, with reasons

1. **Card art is data-derived.** No Resonator art exists in the committed data. Fetching it would add unlicensed assets; drawing a made-up face would invent a portrayal. The existing monogram portrait pattern is used and the card states that this copy of the app has no game art.
2. **Restore has a confirmation step.** Backup is one click; restore replaces everything and therefore asks once before doing it. A stray click cannot erase a workspace.
3. **"Show everything" appears in Settings and stays on the Build page.** They are the same setting. Keeping the Build switch avoids changing finished-phase behaviour.
4. **First-run persistence is new.** Saving the seeded sample immediately is a deliberate small behaviour change so the saved state and revision are real. No game values, engine output or Build Score changed.
5. **Desktop has a second header row for tools.** Seven tools, three page links, the build switcher, score and undo do not fit on one row at 1440px without crowding the build name.
6. **Desktop keeps "Saved builds"; phone shortens it to "Saved".** Earlier phases and their tests use those exact labels.

### Known gaps carried forward

- Jiyan's Forte and Liberation hits count as Heavy Attack because that is the game data.
- Energy affordability of a rotation is still not checked.
- Main bundle is still large; splitting was not part of this phase.
- A duplicate build name on import is refused rather than merged or renamed interactively.
- Card JSON can be exported but not imported; builds and rotations have the full round trip.

### NOT CHECKED

See `verification/phase-5/REPORT.md`: real phones and touch hardware, browsers other than Chromium, screen-reader use by a person, clipboard behaviour outside Chromium, and two-tab conflicts across separate browser profiles (which do not share storage). The full-length phone composites were not opened; their screen slices were.

## Phase 1: shared build and the Build tool (complete, 11 Nov 2026)

### What works now

Run `npm run dev` and open `/build`. A first visit loads a sample build (Jiyan) with a short guide. You can change the Resonator, level, Sequence, weapon and rank, all five Echoes (Echo, set, main stat, five substats with legal rolls), two teammates and the target, and switch effects on. The score, verdict and every number update at once, and each number opens to show how it was worked out. Builds save in the browser as you go; undo and redo work by button and Ctrl+Z / Ctrl+Shift+Z. Saved builds and Compare are on their own tabs.

### Improvements over the reference, by area

**Area 1, the shared build**
- One store; every tool reads the same build view, so a change shows everywhere.
- Undo and redo per build (100 steps), kept across reloads; every edit has a plain label ("Set Echo 1 Crit. DMG to 21.0%").
- Autosave, plus a synchronous backup on leaving so the last change before closing a tab is never lost.
- Named builds: create, rename, duplicate, delete. Compare any two side by side, with the setup differences listed in plain words and a clear statement of whether their scores can be compared.
- Preview layer: a change can be tried everywhere and then kept or discarded (used by Suggestions in Phase 2).

**Area 2, Modulation (the Build tool)**
- A plain-English verdict under the score, worked out by measuring which stat group, raised to the reference level, adds the most damage.
- Simple mode by default; one "Show everything" switch reveals skill levels, the skill tree, ascension, resistances, teammates' weapons and your own buffs. Nothing is removed.
- Every picker works by keyboard (focus starts in search, arrows, Enter) and as a full-height sheet on phone.
- "Last change" line with the score difference it made, shown only when the scale did not change.
- Effects list shows the game's own condition sentence, the stat it grants, and whether it changes this rotation (with the reason when it does not).
- Equipment sentences that could not be read into stats are listed under "not modelled", not guessed.

**Area 7, target, buffs and trust**
- Every result is stamped with patch and data date.
- Whole-build "How this was calculated" sheet, built from the same functions as the results.
- The "compare only under identical setups" note is part of the score display, not a modal.
- Each hit's formula with the player's own numbers in it, including enemy level, DEF and resistance.
- Unverified inputs and Basic-model Resonators carry a mark wherever they affect a number.

**Effects coverage (data)**
- 317 effects read from game descriptions by a tested reader; every number checked against its source parameter; 85 of 94 four- and five-star weapons covered; 372 sentences listed as not modelled.
- Sonata sets cross-checked: 35 of 37 agree; Havoc Eclipse and Freezing Frost do not and are marked unverified.

### Deviations from the plan, with reasons

1. **Effects are read from descriptions by a tested reader** instead of all being typed by hand. Faster and more consistent, and every number is still machine-checked against its source. Every always-on effect and every core-Resonator effect was reviewed by eye.
2. **The Build Score is defined independently**: anchors keep the build's own Echoes, sets, main Echo, rotation, team and target, and vary only Echo stats. Numbers will differ from other tools by design; "What the score means" explains the scale.
3. **Tool tabs show only what exists** (Build, Saved builds, Compare). Suggestions, Optimizer, Rotation and Card are added as their phases land, so there are no dead ends.
4. **Not built yet:** the two-tabs-open notice from the plan. Two open tabs can overwrite each other's saves. Planned with the saving work in Phase 5.

### Known gaps carried forward

- Main bundle is 196 kB gzipped (mostly effect data); split when it matters.
- Damage-row matching still leaves some real hits (for example some of Taoqi's Basic Attack stages) as not modelled, with a plain reason.
- The pattern reader leaves 372 sentences unread; the most common kinds are energy, healing, shields and skill-specific multipliers.

### NOT CHECKED

See `verification/phase-1/REPORT.md`: real phones and touch, browsers other than Chromium, in-game accuracy, two tabs open at once, and screen reader use by a person.

## Phase 0: scaffold, design, data, engine (complete, 11 Nov 2026)

### What exists now

- Project on branch `build/v1`: React 19, TypeScript 6, Vite 8, Tailwind 4, Vitest 5, ESLint 10.
- `DESIGN.md`: one locked direction ("Tuning bench"): graphite, one signal-blue accent, Archivo, ruled layout, the meter as the signature element, phone width as a first-class layout.
- `CLAUDE.md`: stack, commands, data sources with their terms, integrity rules, and every trap found so far.
- Data layer: scripts that fetch, trim, normalise, cross-check and validate game data for patch 3.8.0, all committed as local JSON. The app will run fully from it.
- Damage engine in `src/engine`: pure TypeScript, no UI or browser imports, 195 tests passing.

### Improvements over the reference, by area

**Area 7, target, buffs and trust**
- Every game value carries its source record and whether a second public source agrees. Disagreements are never resolved silently.
- Skill values that are not hits (shields, speed changes, per-stack bonuses) are left out of damage with a plain reason, instead of being counted.
- Hits on formulas with no public description are shown as "Not modelled" and excluded from totals, with the reason.
- Hand-encoded numbers are machine-checked: a test fails if any authored value differs from the description parameter it cites.
- The whole-build ledger (the data behind "How this was calculated") is built from the same functions that compute results, so the explanation cannot drift from the number.
- Results carry the patch and data date they were calculated from.

**Area 1, the shared build**
- The build model already holds rotation steps with per-step effect changes and loops, so every tool will read one object.
- A fast evaluator, proven equal to the full simulation, will let Score, Suggestions and the Optimizer share one calculation path.

**Design (all areas)**
- Text contrast of every token pair is tested (at least 4.5:1). Yellow and purple hues are banned by test, per the owner's rule.

### Deviations from the plan, with reasons

1. **TypeScript 6, not 7.** The lint tooling does not support 7 yet.
2. **Accent changed from amber to signal blue** on the owner's instruction (no yellows or purples). Electro and Spectro data colours moved to orchid pink and pale bone.
3. **Core set of 12 changed.** Rule applied: every damage value must be modelled and cross-checked. Out: Jinhsi, Camellya, Carlotta, Zani, Taoqi, Cartethyia. In: Encore, Xiangli Yao, Calcharo, Zhezhi, Roccia, Sanhua. Reasons per Resonator are in `data/authored/core-set.ts`. The dropped ones stay selectable as "Basic model".
4. **Substat rolls come from the wiki only.** The raw game tables do not list roll values readably. The wiki cites rates published by Kuro Games. Echo main stats do have two agreeing sources.
5. **Hit elements come from the raw game damage table**, because the encore.moe API has no element field on its damage rows. nanoka.cc agrees on every row.
6. **Effects audit moved to Phase 1**, where the effects view that shows it is built.

### Data issues found

- 59 of 1,283 skill values are "Not modelled": 28 use special formulas with no public description, 31 match no damage entry (most are not hits; a few real hits such as some of Taoqi's Basic Attack stages are among them and need better matching in Phase 1).
- 74 skill values are computed but marked unverified (ambiguous damage-row match, negative-status damage type, or Tune Rupture).
- Negative-status damage over time (Spectro Frazzle, Aero Erosion ticks) is not modelled: the public formula is incomplete.
- 5 "Prism" enemies have resistances outside the usual 10% / 40% pattern and are marked unverified.
- 42 Echoes are missing from the second source and stay unverified.

### Known gaps carried into Phase 1

- Teammate buffs are modelled in the build object but not yet collected into stats.
- Authored set effects must not repeat a set's structured stat bonus (they would count twice). A guard test comes with the first authored set effect.
- Improve damage-row matching so the few real hits now marked "Not modelled" are counted.

### NOT CHECKED

See `verification/phase-0/REPORT.md`. In short: no real screens exist yet, and the formula has not been compared with in-game numbers.

## Redesign: Bloom (11 Nov 2026)

The owner judged the Phase 1 look ("Tuning bench") too generic. Six directions were mocked up as private design canvases; the owner picked F, **Bloom**.

- `DESIGN.md` rewritten: night-sea surfaces, jade action colour, one tone per stat group, Unbounded display with Albert Sans text, rounded panels.
- New signature: the Echo bloom (`src/features/build/EchoBloom.tsx`). One petal per Echo, one wedge per substat. Wedge length is the roll tier divided by that stat's tier count (`src/ui/bloom-geometry.ts`). Slate wedges add no damage, which is measured by removing that substat and re-running the compiled rotation (`src/explain/echo-bloom.ts`), not guessed.
- Tests added: `tests/explain/echo-bloom.test.ts`, `tests/ui/bloom-geometry.test.ts`, and stat-tone contrast checks in `tests/ui/tokens-contrast.test.ts`.
- Evidence: `verification/redesign/` (Build, Saved and Compare at 1440px and 390px, plus every captured state). Inspected: the Build page with the sample build and with an empty build, Saved, Compare, and the Echo editor on a phone.
- Gate: typecheck, lint, 1077 unit tests and 32 end-to-end tests (axe and no-sideways-scroll at both widths) pass.
- NOT CHECKED: the Resonator picker, ledger sheet and score-meaning sheet captures in `verification/redesign/` were saved but not opened.

## Phase 2: Suggestions (11 Nov 2026)

Built: `/suggestions` with five modes (Weapons, Main stats, Sets, Substats, Whole builds), Try it / Keep / Discard through the shared preview, a step-by-step upgrade path whose steps each enter undo history on their own, an "Only weapons I own" checklist, and a "Count every condition as met" switch.

Improvements over the reference, by the brief's Area 4:
- One plain sentence per suggestion, generated from which formula term moved most across the rotation's hits (weighted by damage), and whether that bucket was already crowded (`src/explain/suggestion.ts`, unit-tested on built cases).
- "Apply best, then re-rank" as a visible path with running total and per-step undo.
- Owned-only restriction for weapons.
- Substats show priority, damage per average roll and the share each stat gives now, each defined one tap away, plus a one-line farming goal.

Honesty rules: every gain is a full re-simulation (tests compare every ranked item with a direct simulation); score points only appear when the change keeps the setup; a change of weapon or set says the score re-scales; unverified sets are marked; gains under 0.1% read "No real difference" and ties share a place.

Deviations: Echo inventory and owned Echoes arrive with the Optimizer (Phase 3), so "Only what I own" covers weapons only. Set suggestions are 5 pieces of one set (no 2+3 splits yet). Whole builds combine the top 5 weapons and top 5 sets with the best main stats for each.

Evidence and NOT CHECKED items: `verification/phase-2/REPORT.md`.

## Phase 3: Optimizer (11 Nov 2026)

Built: `/optimizer` with My Echoes (an inventory saved in the browser, filled from the equipped Echoes or added one by one with the Build page's own Echo fields) and Generated plans (sets and main stats to aim for). Settings: damage target (whole rotation or one action), main Echo lock, allowed sets and main stats, stat limits (Energy Regen, Crit. Rate, Crit. DMG, ATK), count conditions as met, results to keep. Live progress, a time estimate, Cancel, Try it, and Save as build.

Improvements over the reference, by the brief's Area 5: exact results proven against trying every combination; a cancel that really stops (workers are terminated); a plain time estimate; a reason for each result; results saved as named builds; the page stays usable while a search runs.

Deviations: no graphics-card search (as planned). Generated plans keep the current main Echo kind and carry no substats of their own (your current substats are added as one total), so they are plans to farm towards, not builds to save. Echo levels and rarities other than 5-star level 25 are not modelled.

Evidence, timing and NOT CHECKED items: `verification/phase-3/REPORT.md`.

## Phase 4: Rotation (11 Nov 2026)

Built: `/rotation` editing the shared build's rotation. Steps by plain name and skill icon, added by typing; drag to reorder by mouse, touch or keyboard (handle only, so phone scrolling still works); switch off, time, note, copy, remove; loops one level deep (repeat a step, join the loop above or below, take a loop apart); buffs that start or end at a step. A timeline beside the numbers (blocks by damage type, buff bars over the steps they cover), every hit with its formula, breakdowns by type, element and skill, a numbered summary to follow in game (copyable), and saved rotations (save, use, compare, copy or save as a file, import with plain errors). Damage per second only when every step has a time.

Improvements over the reference, by the brief's Area 6: plain names and icons, never ids; drag on desktop and phone, plus keyboard; a visual timeline beside the numbers; a one-screen plain summary; each step shows its share of the total.

Deviations: steps move into or out of loops from the step's own panel rather than by dragging across a loop's edge.

Evidence: `verification/phase-4/REPORT.md`.
