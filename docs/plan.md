# theWuthering — implementation plan (WuWa calculator, clean-room build)

Spec: `theWuthering/wuwa-calculator-build-v1.md` (the brief). This plan argues from it; executors read both.

## Context

The owner wants a personal, improved, from-scratch Wuthering Waves damage calculator and build lab, functionally modelled on thewuwacalculator.com but calmer, plainer, guided, and usable on a phone. Nothing exists yet: the working folder holds only the brief. The outcome is a local-first web app ("theWuthering") with a pure-TypeScript damage engine, five tools over one shared build, honest traceable numbers, built in six verified phases.

Decisions the owner made on 2026-11-11:
- Visual direction: **A. Tuning bench** (graphite, one meter-amber accent, Archivo, square and ruled).
- Coverage: **every Resonator, weapon and Echo listed with real stats and multipliers; a core set of about 12 Resonators fully modelled**; the rest labelled "Basic model".
- Artwork: **downloaded locally into a git-ignored folder**, with text-and-colour placeholders as fallback.
- Location: **`theWuthering/wuwa-calculator/`**, own git repo, branch `build/v1`. Visible site name: theWuthering.

Research done while planning (read-only, 2026-11-11):
- `api.encore.moe` reachable. `/en/character`, `/en/character/{id}`, `/en/weapon`, `/en/weapon/{id}`, `/en/echo`, `/en/echo/{id}`, `/en/monster` all return JSON. Character detail includes per-level base stats (`Properties[].GrowthValues`), per-hit damage rows (`Skills[].DamageList[]` with `RateLv`, `Type`, `PropertyName`, `Energy`), skill tree nodes, and Sequence nodes with `AttributesDescriptionParams`. Weapon detail has stat curves and `DescParams` per refinement rank. Echo detail has cost class, set membership, set effects, and echo-skill values. Site reports game version 3.8.0.
- `static.nanoka.cc` reachable. `manifest.json` (versions), `ww/3.8/en/character/{id}.json`, `ww/3.8/weapon.json`, `ww/3.8/echo.json`. Versioned by patch in the URL.
- `github.com/Arikatsu/WutheringWaves_Data` reachable, at 3.8.0, with `BinData/` tables (`damage`, `buff`, and more) and `Textmaps/`.
- `wutheringwaves.fandom.com/wiki/Damage` reachable (CC-BY-SA): states the community damage formula used below.
- Reference site pages `/modulation` and `/docs` opened to observe behaviour only.

## Global constraints (from the brief, binding on every task)

- React 19, TypeScript, Vite, Tailwind CSS, all latest stable majors (confirmed with `npm view <pkg> version` at scaffold).
- Engine is a separate pure-TypeScript module with no UI imports, fully unit-tested.
- Plain language first; technical detail one tap away. No memes, no joke buttons, no clutter.
- Every number traces to a visible formula or stat breakdown. No invented multiplier, stat, or data value. Unverifiable game data is marked unverified in the data files and shown as beta/unverified in the UI, or omitted.
- No social features, no login, no server. Browser storage only.
- `DESIGN.md` is written before any CSS or component. `CLAUDE.md` exists from the first commit and absorbs every durable trap in the commit that finds it.
- Clean room: nothing copied from the reference site (code, text, art, layout, constants).
- Nothing outside `wuwa-calculator/` is modified. No remote, no deploy, no sign-ups.
- Every page usable at 390px and at 1440px.
- Anything not rendered and inspected is reported as NOT CHECKED.

---

## 1. Architecture

### 1.1 Project structure

```
wuwa-calculator/
  CLAUDE.md  DESIGN.md  REPORT.md  README.md
  package.json  vite.config.ts  eslint.config.js  playwright.config.ts
  tsconfig.json  tsconfig.engine.json  tsconfig.app.json  tsconfig.node.json
  docs/plan.md                     copy of this plan
  docs/plans/phase-N.md            step-level task plan, written at the start of each phase
  data/
    snapshots/<source>/<gameVersion>/   trimmed source responses (committed)
    game/<gameVersion>/                 normalised catalog JSON the app imports (committed)
    game/manifest.json                  gameVersion, fetchedAt, sources, counts
    authored/                           hand-encoded effects, default rotations, sample build
    corrections.json                    in-app corrections log
  scripts/
    data/fetch.ts  normalise.ts  crosscheck.ts  check.ts
    assets/fetch.ts                     downloads art to public/game-assets (git-ignored)
    verify/screenshots.ts               Playwright page renderer
  src/
    engine/        pure TS, no DOM, no React
    data/          loads data/game/<current> and exposes a typed Catalog
    state/         shared build store, history, persistence, share codes
    workers/       score worker, optimizer worker pool, typed message protocol
    explain/       plain-sentence generators (verdict, suggestion reason, result reason)
    ui/            design-system primitives built to DESIGN.md
    features/      build, suggestions, optimizer, rotation, card, saved, compare, home, guide, settings, datalog
    app/           router, shell, build bar, first-run guide
  tests/           engine, data, state, features, e2e
  verification/    phase-N/*.png and phase-N/REPORT.md
  public/game-assets/                  git-ignored art cache
```

Extra packages beyond the four named in the brief, each for one job: `react-router` (routes), `zustand` + `immer` (store, patches for undo), `idb` (IndexedDB), `zod` (validate data files and imports), `radix-ui` (accessible dialog, popover, tabs, slider, switch), `@dnd-kit/core` + `@dnd-kit/sortable` (drag reorder with touch and keyboard), `html-to-image` (card capture), `lucide-react` (interface icons), `@fontsource-variable/archivo` (self-hosted font, no network), `vitest`, `@playwright/test`, `@axe-core/playwright`, `tsx`. No chart library: breakdown bars and the timeline are hand-built SVG.

### 1.2 Engine separation (`src/engine/`)

Enforced three ways:
1. `tsconfig.engine.json` compiles `src/engine/**` alone with `lib: ["ES2023"]` (no DOM), `types: []`, no JSX. `npm run build` runs it first.
2. ESLint `no-restricted-imports` on `src/engine/**`: only relative imports that stay inside `src/engine/`.
3. `tests/engine/boundary.test.ts` scans every engine file's import specifiers and fails on anything outside the folder.

The engine never imports JSON. It receives a `Catalog` object as an argument, so tests can pass small hand-made catalogs.

Modules and the functions other code relies on:

| File | Exports |
|---|---|
| `engine/types/catalog.ts` | `Catalog`, `ResonatorDef`, `WeaponDef`, `EchoDef`, `SonataDef`, `EnemyDef`, `HitDef`, `EffectDef`, `Provenance` |
| `engine/types/build.ts` | `Build`, `EchoInstance`, `TeammateConfig`, `CustomModifier`, `EnemyConfig`, `Rotation`, `RotationItem` |
| `engine/types/stats.ts` | `StatKey`, `Modifier`, `Scope`, `SourceRef`, `StatSheet`, `StatTrace` |
| `engine/stats/base.ts` | `resolveBaseStats(build, catalog): BaseStats` |
| `engine/stats/collect.ts` | `collectModifiers(build, catalog, ctx): Modifier[]` |
| `engine/stats/sheet.ts` | `computeStatSheet(base, modifiers, scope?): StatSheet` |
| `engine/formula/defense.ts` | `enemyDefense(level)`, `defMultiplier(attackerLevel, enemyLevel, defIgnore, defReduction)` |
| `engine/formula/resistance.ts` | `resMultiplier(totalRes)` |
| `engine/formula/crit.ts` | `critAverage(critRate, critDmg)` |
| `engine/formula/hit.ts` | `computeHit(hit, sheet, enemy): HitResult` with `HitResult.formula: FormulaTrace` |
| `engine/rotation/simulate.ts` | `simulateRotation(build, catalog): RotationResult` (per-step rows, totals, breakdowns by type, step, element) |
| `engine/rotation/effects-audit.ts` | `auditEffects(build, catalog): EffectAudit[]` (touches rotation / does nothing) |
| `engine/compiled/compile.ts` | `compileRotation(build, catalog, target): CompiledRotation`, `CompiledRotation.evaluate(echoStats: Float64Array): number` |
| `engine/score/ideal.ts` | `searchIdealLoadout(compiled, catalog, rules): IdealLoadout` |
| `engine/score/score.ts` | `scoreBuild(build, catalog): Score` (`baseline`, `reference`, `maximum`, `percent`, `grade`, `fingerprint`) |
| `engine/ledger/ledger.ts` | `buildLedger(build, catalog): LedgerEntry[]` (whole-build "how this was calculated") |
| `engine/optimize/search.ts` | `searchInventory(problem, onProgress, shouldStop): OptimizerResult[]`, `bruteForce(problem)` (test oracle) |
| `engine/suggest/*.ts` | `rankWeapons`, `rankMainStats`, `rankSets`, `rankSubstats`, `rankRandomBuilds` |

Core idea: a **modifier ledger**. Every stat contribution (trace node, weapon stat, Echo main stat, substat, set bonus, Sequence node, buff, custom value) is a `Modifier { stat, value, scope, source }`. Totals are sums of modifiers, so a stat breakdown is the list of modifiers that fed it, and a hit's `FormulaTrace` is the list of formula terms with their modifier lists. Traceability is a by-product of how numbers are computed, not a second code path.

Formula implemented (source: Fandom wiki Damage page, cross-checked in Phase 0 against a second public write-up):
- `DMG = (Stat × MV + Flat) × (1 + ΣDMG Bonus) × (1 + ΣAmplify) × (1 + ΣSpecial) × Crit × DEF mult × RES mult × (1 − DMG reduction) × (1 − Elem reduction)`
- `Enemy DEF = 8 × enemyLevel + 792`; `DEF mult = (800 + 8 × Lv) / (800 + 8 × Lv + Enemy DEF × (1 − DEF ignore))`
- `RES mult = 1 − RES/2` if RES < 0; `1 − RES` if 0 ≤ RES < 0.8; `1 / (1 + 5 × RES)` if RES ≥ 0.8
- `ATK = (character base + weapon base) × (1 + ΣATK%) + flat ATK` (same shape for HP, DEF)
- `Crit average = 1 + min(critRate, 1) × (critDmg − 1)`

**Compiled evaluator.** Score references, Suggestions and Optimizer all need thousands to millions of "same build, different Echo stats" evaluations. `compileRotation` folds everything except Echo stats into constants, merges hits with identical bucket signatures, and returns `evaluate(echoStats)`, a tight loop over a handful of hit groups. `tests/engine/compiled/compiled-equals-full.test.ts` proves it equals the full `simulateRotation` on random loadouts to 1e-9 relative error.

### 1.3 Shared build state (`src/state/`)

One store, `workspaceStore` (Zustand vanilla store with a React hook), holding:

```
library:  builds (by id, ordered), echoInventory, ownedWeaponIds, rotations
session:  activeBuildId, preview (BuildPatch | null), per-tool UI memory (open tab, filters, scroll, selection)
history:  per build: past[] and future[] of Immer patch pairs, depth 100
meta:     schemaVersion, dataVersion, firstRunDismissed, settings
```

`Build` holds: resonator (id, level, Sequence 0 to 6, skill levels, trace nodes, effect states), weapon (id, level, rank, effect states), five `EchoInstance | null` slots (slot 0 is the main Echo), two teammates (as buff providers: resonator, Sequence, weapon, sets, effect states), quick and custom buffs, enemy config, and one embedded rotation.

Rules that deliver the brief's Area 1:
- **Every tool reads `selectBuildView`** = active build with the preview patch applied. No tool keeps its own copy. That is what makes "change one Echo, every tool agrees" true by construction.
- **Edits go through `applyEdit(recipe)`**, which runs Immer `produceWithPatches`, pushes the inverse patch to history, and clears `future`. `undo()` and `redo()` replay patches. Keys: Ctrl+Z, Ctrl+Shift+Z, plus buttons in the build bar.
- **Preview layer**: Suggestions' "Try it" and Optimizer's "Preview" set `session.preview`; nothing enters history until "Keep". "Discard" clears it. The build bar shows a "Previewing a change" strip while it is set.
- **Autosave**: `state/persist/autosave.ts` writes to IndexedDB 300ms after the last change and flushes on `visibilitychange` and `pagehide`. History is persisted too (bounded), so undo survives a reload.
- **Named builds**: create, rename, duplicate, delete, switch from the build bar; `/saved` lists them. `/compare?a=&b=` shows any two side by side (stats, score, per-hit, and an explicit list of setup differences).
- **Place memory**: `session.toolUi[tool]` restores tab, filters and scroll when you return to a tool.
- **Two tabs open**: a `BroadcastChannel` notice offers "Reload the newer version" instead of silently overwriting.
- **Schema migrations**: `state/persist/migrations/` keyed by `schemaVersion`; imports run through the same path.

Heavy derived values (score references, suggestion rankings) are computed in `workers/score.worker.ts` and cached by a fingerprint of everything except Echo stats, so an Echo edit re-scores instantly against cached references.

### 1.4 Game data: sourcing, caching, versioning

Three layers, all committed, each traceable to the one before:
1. **Snapshots** `data/snapshots/<source>/<version>/`: source responses with irrelevant fields (stories, voice lines, 3D models) stripped by an allowlist. Never edited by hand.
2. **Catalog** `data/game/<version>/*.json`: `resonators.json`, `hits.json`, `weapons.json`, `echoes.json`, `sonatas.json`, `enemies.json`, `echo-stat-tables.json`. Produced only by `scripts/data/normalise.ts`. Every record carries `provenance { source, sourceId, verified, beta }`.
3. **Authored** `data/authored/`: hand-encoded effects (`effects/resonators/<id>.ts`, `effects/weapons.ts`, `effects/sonatas.ts`, `effects/echoes.ts`), default rotations, the sample build. Each numeric value names the source description it came from.

`data/game/manifest.json` records `gameVersion`, `fetchedAt`, per-source URLs and fetch times, and record counts. `src/data/current.ts` imports the current version; the UI stamp "Patch 3.8 · data 11 Nov 2026" reads from the manifest. A new patch means: `npm run data:fetch`, `npm run data:build`, `npm run data:check`, review the diff, add a line to `data/corrections.json`.

Commands: `npm run dev`, `build`, `test`, `lint`, plus `data:fetch`, `data:build`, `data:check`, `assets:fetch`, `verify:screens`, `test:e2e`.

---

## 2. Data layer

| Source | Used for | Verified reachable | Fallback |
|---|---|---|---|
| encore.moe API (`api.encore.moe/en/...`) | Primary: Resonators, per-level stats, per-hit multipliers, skill tree, Sequences, weapons, Echoes, Sonata sets, enemies | Yes: list and detail endpoints returned JSON on 2026-11-11 | nanoka.cc becomes primary |
| nanoka.cc static data (`static.nanoka.cc/ww/<ver>/...`) | Second source for cross-checking every base stat and multiplier; patch version list; beta flagging | Yes: manifest, one character, weapon list, Echo list | Arikatsu tables become the cross-check |
| Arikatsu/WutheringWaves_Data (GitHub, pinned commit) | Tables the two APIs do not expose cleanly: Echo main-stat values by cost, substat roll tiers, raw `damage` rows | Yes: repo and `BinData/` listing | Those tables are marked unverified, or the feature that needs them is reduced and reported |
| Fandom wiki (CC-BY-SA) | Formula text only, never data values | Yes: Damage page | Second public formula write-up |

How each is used safely:
- `scripts/data/fetch.ts` throttles to about 3 requests per second, sends a generic client name with no personal details, and writes snapshots. One full fetch is roughly 400 requests, done once per patch.
- `scripts/data/crosscheck.ts` compares encore.moe against nanoka.cc for base stats at every level, every hit multiplier at every skill level, and weapon curves. Output: `data/game/<version>/crosscheck-report.json`. Agreement sets `verified: true`. Disagreement sets `verified: false`, and the UI shows an "Unverified" mark on that value and on any result that used it.
- Records present only in a not-yet-live version are flagged `beta: true` and shown as "Beta".
- `tests/data/provenance.test.ts`: every number in an authored effect must appear in the parameter list of the source description it cites (for example a Sequence node's `AttributesDescriptionParams` or a weapon's `DescParams` at that rank). An invented or mistyped multiplier fails the test.

Licence and attribution, stated plainly: none of the pages I opened shows an explicit data licence, and the Arikatsu repo listing shows no licence file. The underlying data is Kuro Games' property, republished by fans. Phase 0 step 1 is to look for terms or about pages on each source and record what they say, word for word, in `CLAUDE.md`, with attribution also shown on the in-app Data page. If any source's terms forbid this use, that source is dropped, the next one in the table takes over, and the report says so. Use here is personal, local and unpublished.

Artwork: `scripts/assets/fetch.ts` downloads icons and portraits referenced by the encore.moe data into `public/game-assets/` (git-ignored). Components use `<GameImage>`, which falls back to a name, element colour and glyph when a file is missing, so the app is complete without the art.

Coverage model (owner's choice):
- **Listed**: every Resonator, weapon, Echo and Sonata set from the data, with real stats and multipliers.
- **Fully modelled** (target 12 Resonators): mechanics, toggles, Sequence effects and a default rotation hand-encoded with provenance. Proposed set: Yangyang, Taoqi, Jinhsi (the three hand-checked), Jiyan, Camellya, Carlotta, Changli, Zani, Phoebe, Cartethyia, Shorekeeper, Verina. The list is confirmed at the end of Phase 0: a Resonator leaves the set if part of its damage depends on a formula I cannot source publicly, and the swap is reported.
- **Basic model** (everyone else): correct stats and raw hit multipliers, no conditional mechanics, a plain "each skill once" sequence. Marked "Basic model" in the picker, the build bar and the score, with a one-line explanation.
- Weapons: all 4-star and 5-star passives encoded in Phase 1. Sonata sets: all encoded in Phase 1. Echo buff effects: 4-cost and 3-cost encoded; any gap shows "Effect not modelled" and is counted on the Data page.

---

## 3. Design (locked into `DESIGN.md` before any CSS)

**Tuning bench.** The app looks like a piece of audio test equipment: a calm graphite panel where numbers are the content and one amber signal colour marks what is live. Layout is ruled, not boxed: sections sit on the page separated by 1px lines and spacing, with filled panels reserved for things you can pick up or edit (an Echo, a rotation step, a dialog). Corners are nearly square (3px controls, 4px panels). There are no gradients, no glass, no glow, and no shadows except under floating layers. Colour: page `#1F2124`, panel `#282B2F`, raised `#32363B`, rule `#3A3E44`, text `#E9E6DF`, secondary text `#9A9C9F`, accent amber `#F0A73A` with `#2A1C05` text on it. The accent is used for the current value, the primary action and focus, never as decoration. The six element colours and a gain/loss pair exist only as data colours (element chips, plus/minus deltas, breakdown bars) and are always paired with a text label or sign. Type is one family, Archivo variable, self-hosted: wide width (125) at weight 600 to 700 for headings and big numbers, normal width at 400 and 500 for everything else, tabular lining numerals throughout, sentence case everywhere. Banned: all-caps labels, eyebrow labels, monospace data labels, middle-dot meta strings, arrows in buttons. Type scale 12, 13, 14, 16, 20, 26, 34, 44. Spacing scale 4, 8, 12, 16, 24, 32, 48, 64. The one signature element is the **meter**: a ruled horizontal scale with ticks at 0, 100 and 200 and an amber needle. It shows the Build Score and is reused for suggestion gains, optimizer progress and substat value, so the whole app reads as one instrument. Motion is limited to 120 to 160ms responses to the user's own actions and is off under reduced-motion.

**Phone width is a first-class layout, not a shrunk desktop.** Desktop: a persistent build bar across the top (Resonator, weapon, score meter, target, build switcher, undo/redo) with the five tools as tabs beneath it and two or three columns of content. At 390px: the build bar becomes a compact sticky header (name, score, undo), the tools move to a bottom tab bar within thumb reach, columns stack in priority order (result first, then editor), pickers and detail panels open as full-height sheets with the search field at the top, tables become stacked label-value rows, and every touch target is at least 44px. Each component is designed at 390px first and the e2e suite fails on any horizontal scroll at that width.

Tool names in the interface are plain: Build, Suggestions, Optimizer, Rotation, Card. Stat names follow the game; everything else is everyday language.

---

## 4. Phase-by-phase breakdown

Each phase starts by writing `docs/plans/phase-N.md` (step-level tasks, test-first) and ends with the gate in section 5 and a commit on `build/v1`. Rough size: Phase 0 one to two long working sessions, Phase 1 two to three, Phase 2 one, Phase 3 one to two, Phase 4 one to two, Phase 5 two.

Skills used throughout: test-driven-development for engine and state; frontend-design and design-system for `DESIGN.md` and primitives; interaction-design, ux-copy, dataviz when building screens; design-critique and accessibility-review on the screenshots at each gate; modern-web-guidance for workers, compression and clipboard APIs; systematic-debugging when stuck; verification-before-completion and code-review at each phase boundary.

### Phase 0: scaffold, design, data, engine

Order:
1. Create `wuwa-calculator/`, `git init`, branch `build/v1`. Scaffold Vite + React 19 + TS + Tailwind. Write `CLAUDE.md` (stack, commands, sources, integrity rules, traps). First commit.
2. Source terms check; record findings in `CLAUDE.md`.
3. Write `DESIGN.md` (section 3 in full, with tokens). Then `src/ui/tokens.css` and nothing else visual.
4. `scripts/data/fetch.ts`, `normalise.ts`, `crosscheck.ts`, `check.ts`; zod schemas in `src/data/schema.ts`; commit snapshots and catalog for 3.8.
5. Engine types, then formula modules, stats, hit, rotation, compiled evaluator, ledger, each test-first.
6. Three hand-checked Resonators (section 5).
7. Confirm the core set of 12 and research how 3.x mechanics (Tune Break, negative statuses) are calculated; record what is and is not sourced.

Could go wrong: a source blocks scripted fetches (fallback table in section 2); the two databases disagree on values (flag unverified, do not pick a winner silently); Echo stat tables turn out hard to extract from raw game tables (mark unverified, report); newer mechanics lack a public formula (affected hits shown as "Not modelled" and excluded from totals with a visible note).

### Phase 1: shared build state and Build (Modulation, Area 2; Areas 1 and 7 foundations)

Order:
1. `src/state/`: store, `applyEdit`, undo/redo, preview layer, autosave, migrations. Tests first.
2. `src/ui/` primitives: Button, Field, Switch, Slider, Tabs, Sheet, Dialog, Popover, Picker, Meter, StatRow, Badge, Stamp, EmptyState.
3. App shell: routes, build bar, bottom tab bar, build switcher.
4. Authored data: effects for the core 12, all weapon passives, all Sonata sets; default rotations; the sample build.
5. Build page: Resonator picker (search, filters for rarity, weapon type, element, role), configuration (levels, skill tree, mechanics and toggles, weapon and rank, quick and custom buffs), Echo loadout (five slots, cost budget, Echo and set library, main stat and substat editors), target picker, teammates.
6. Results: stat list with expandable sources; hit-by-hit damage view with each hit's formula; effects view; whole-build "How this was calculated" panel.
7. Score: `engine/score/`, `workers/score.worker.ts`, the meter, grade, verdict sentence, setup note.
8. First-run: sample build loaded, dismissible three-step guide ("Start from this build, change one thing, watch the score").

Required improvements landing here: undo/redo, autosave, named builds, compare page; plain-English verdict from the real numbers (`src/explain/verdict.ts`: finds the stat bucket whose shortfall against the 100% reference costs the most damage); simple mode with one "Show everything" switch (expert controls hidden, never removed); keyboard- and phone-friendly pickers; patch and data stamp on every result; whole-build calculation panel; the "scores compare only under identical setups" note inside the score display, driven by a setup fingerprint (target, team, rotation, patch); empty states with one plain next step; sample build and guided path.

Own additions: preview layer; "Basic model" and "Unverified" marks that propagate to any number they touch; machine-checked provenance for authored numbers; "what changed" line after each edit (score before and after).

**Build Score, defined independently.** Baseline (0%) is the build with all Echoes removed. Maximum (200%) is the best legal five-Echo loadout with five best substats per Echo at maximum rolls. Reference (100%) is the best legal loadout with right main stats and sets and three useful substats per Echo at average rolls. The percentage is linear from baseline to reference (0 to 100) and from reference to maximum (100 to 200). Grades F to SSS+ are fixed bands on that percentage. All three anchors, the rules and the bands are shown in the app. Energy Regen needs are not valued by the score in v1 and the score says so.

Could go wrong: authored effect volume (weapons and sets) runs long (gaps are flagged, counted, and reported, never guessed); ideal-loadout search too slow for interactive use (it runs in the worker with a cache and a visible "Working out the reference builds" state); breakdown UI too dense at 390px (stacked rows, one level of expansion at a time).

### Phase 2: Suggestions (Area 4)

Order: `engine/suggest/` rankers test-first; `src/explain/suggestion.ts`; page with five modes (Weapons, Main stats, Sets, Substats, Whole builds); "Try it" preview and "Keep"; upgrade path; owned-only filter with a weapons-owned checklist.

Required improvements: one plain sentence per suggestion explaining why it helps, generated from which formula term moved and how crowded that term already is; "Apply best, then re-rank" as a visible step-by-step upgrade path with running total and per-step undo; "Only what I own" restriction. Substat mode shows priority, damage gained per average roll, and share of damage, each with its definition one tap away.

Own additions: a one-line farming goal ("Your next best roll is Crit Damage on any Echo"); gains shown on the same meter as the score.

Could go wrong: gains that are tiny or tied read as noise (ties grouped, anything under 0.1% shown as "No real difference"); explanation templates saying something false (each template is unit-tested against constructed cases where the stated cause is known).

### Phase 3: Optimizer (Area 5)

Order: `engine/optimize/` test-first against the brute-force oracle; `workers/optimizer.worker.ts` and a pool manager; page with target (whole rotation or one skill), source (my Echoes or generated), allowed sets, main stats per cost, which set and weapon effects count, stat minimums and maximums, main Echo lock, number of results kept; results list; "Save as build".

Algorithm: filter by the user's rules, then drop Echoes that are dominated on every useful stat (keeping as many as slots could need), then depth-first branch and bound over cost layouts with an upper bound from the best remaining stats per slot. The bound is valid because damage never falls when a useful stat rises. First-level branches are spread across a worker pool (cores minus one, capped at 8) that shares the current cut-off. Processor workers only: no graphics-card path in v1, because pruning beats raw throughput here and is checkable.

Required improvements: live progress, a cancel button that actually stops the workers (tested), a plain time estimate from measured rate and remaining branches ("About 20 seconds left"); one plain sentence per top result; results saved as named builds. Same answers as brute force, proven by test.

Could go wrong: an effect that makes damage non-monotonic in a stat would break the bound (`tests/engine/optimize/monotone.test.ts` checks every effect in the catalog; any offender is handled by exact enumeration for that branch); very large inventories (a pre-run estimate warns and suggests a filter); worker memory on phones (pool capped at 2 on small devices).

### Phase 4: Rotation (Area 6)

Order: rotation types and loop semantics in the engine (already used read-only since Phase 1) extended test-first; list editor with dnd-kit; step inspector; timeline strip; results tables and breakdowns; save, import, export, compare; one-screen summary.

Editor model: a list of steps, which the brief accepts. Each step is one action picked by plain name and icon (Basic attack 1, Skill, Liberation, Outro). Steps can be added, duplicated, dragged to reorder (mouse, touch and keyboard), timed, switched off, and annotated. Buffs and state changes attach to a step ("from here on" or "this step only"). A loop is a bracket around a run of steps with a repeat count. Running it gives total, average, non-crit and crit damage, a per-step table (damage, multiplier, the stats behind it), and breakdowns by damage type, by step and by element.

Required improvements: plain names and icons, never internal ids; drag on desktop and phone; a visual timeline beside the numbers (blocks per step coloured by damage type, buff bars spanning the steps they cover); a one-screen plain summary a player can follow in game.

Own additions: step search by typing; "what this step contributes" percentage on each row; damage per second shown only when the user has entered times, otherwise damage per rotation, stated plainly.

Could go wrong: nested loops and step-scoped buffs interact badly (v1 allows one level of loop, tested); drag on touch conflicts with scrolling (drag handle only, long-press not required); rotation edits invalidating score references too often (fingerprint cache).

### Phase 5: Card, saving, settings, home, guide (Areas 3, 8, 9, 10)

Order:
1. Card (Showcase): one layout done well; presets Calm, Bold, Minimal with automatic layout; deep controls (text styling, colours, panel opacity, which marks appear, portrait and backdrop position, scale and fade) behind "Customise"; contrast check on every preset; export sizes for a phone screen (1080×1920), Discord (1600×900) and a square; save as image, copy image, export as data.
2. Saving: `/saved` with Builds and Echoes tabs; whole-snapshot and per-slice export (builds, Echoes, settings); import from file, pasted code, older schema versions; "Copy build link" (build packed, compressed with the browser's `CompressionStream`, base64url in the URL hash, no server) and plain file.
3. Other tools' formats: accept those with public documentation, checked at this point; each accepted format gets a fixture test. If none qualifies, the report says so.
4. Settings: theme (the locked dark theme plus a higher-contrast variant), player name and ID for the card, reduce motion, delete everything (with a typed confirmation). Grouped by what the user wants to do.
5. Home: your saved builds, the current build's score, and one clear next action. No update feed.
6. Guide page: what the score means, the formula with a worked example from the engine's own ledger, how to compare fairly.
7. Data page: sources, patch and data date, cross-check totals, coverage counts, and the corrections log from `data/corrections.json`.

Out of scope and not built: screenshot import, Drive sync, second card layout, wallpaper mode, font upload, deployment.

Could go wrong: image capture differing across browsers (fonts are embedded, export is tested for exact pixel size and non-blank content); share links too long (binary packing by id first, target under 400 characters, tested); "copy link" being mistaken for a social feature (it is a plain copy action with no share targets, consistent with the brief allowing file and image export).

---

## 5. Verification per phase

Tooling: `scripts/verify/screenshots.ts` drives Playwright (browsers installed inside the project with `PLAYWRIGHT_BROWSERS_PATH=0`) over every route and named state at 1440×900 and 390×844, saving to `verification/phase-N/<route>-<width>-<state>.png`. I open every image, then write `verification/phase-N/REPORT.md` listing what I saw per page. Anything not opened is listed as NOT CHECKED. `tests/e2e/layout.spec.ts` fails on horizontal scroll at 390px; `tests/e2e/a11y.spec.ts` runs axe on every route.

Every phase gate: `npm run build`, `npm test`, `npm run lint` and `npm run test:e2e` pass with output pasted into the report; screenshots inspected; `REPORT.md` updated with improvements over the reference by area, deviations, data issues, and NOT CHECKED items; commit.

**Phase 0 tests**
- `tests/engine/formula/defense.test.ts`: `enemyDefense(100) = 1592`; `defMultiplier(90, 90, 0, 0) = 1520/3032`; `defMultiplier(90, 100, 0, 0) = 1520/3112`; with 10% DEF ignore `1520/(1520 + 1592 × 0.9)`.
- `tests/engine/formula/resistance.test.ts`: `resMultiplier(0.1) = 0.9`; `(-0.1) = 1.05`; `(0.8) = 0.2`; `(0.9) = 1/5.5`; continuity at 0 and 0.8.
- `tests/engine/formula/crit.test.ts`: `critAverage(0.5, 2.0) = 1.5`; crit rate above 100% is capped.
- `tests/engine/stats/sheet.test.ts`: every stat total equals the sum of its listed sources.
- `tests/engine/handchecked/yangyang.test.ts`, `taoqi.test.ts`, `jinhsi.test.ts`: exact expected values for non-crit, crit and average damage. Yangyang covers the plain ATK path; Taoqi covers a hit that scales on DEF; Jinhsi covers skill-type and element bonuses plus a stacking mechanic. Each has a no-buff case and a case with weapon, Echoes and one buff.
- Where expected values come from: each test's comment block shows the full arithmetic by hand, citing (a) the snapshot file and field for every input value, for example `data/snapshots/encore/3.8.0/character/1402.json → Skills[0].DamageList[0].RateLv[9]`, and (b) the wiki formula line for every step. The numbers are worked out independently of the engine code, then asserted. This proves the engine implements the community formula on real data. It does not prove the formula matches the game; see risk 2.
- `tests/engine/rotation/simulate.test.ts`, `tests/engine/compiled/compiled-equals-full.test.ts`, `tests/engine/boundary.test.ts`.
- `tests/data/schema.test.ts`, `crosscheck.test.ts`, `echo-tables.test.ts`.
- Render check: a bare token page showing palette, type scale and the meter at both widths.

**Phase 1** `tests/state/history.test.ts` (undo and redo restore exact state), `persist.test.ts` (reload restores build and history), `migrations.test.ts`, `preview.test.ts`; `tests/engine/score/score.test.ts` and `ideal-search.test.ts` (greedy result equals exhaustive on small cases); `tests/data/provenance.test.ts`, `sample-build-legal.test.ts`; `tests/explain/verdict.test.ts`. e2e: first run shows the sample build and guide; changing an Echo main stat moves the score; picker is fully usable by keyboard. Screens: Build page (empty, sample, simple mode, everything shown, picker open, breakdown open, calculation panel), Compare, at both widths.

**Phase 2** `tests/engine/suggest/*.test.ts` (ranking matches direct re-simulation of each alternative); `tests/explain/suggestion.test.ts`. e2e: "Try it" changes the build bar score, "Discard" restores it, the upgrade path applies three steps and undo walks back. Screens: each of the five modes, owned-only on, upgrade path mid-way.

**Phase 3** `tests/engine/optimize/matches-bruteforce.test.ts` (random inventories of 25 to 40 Echoes: identical top results), `monotone.test.ts`, `constraints.test.ts`; `tests/workers/cancel.test.ts`. e2e: a run shows progress and an estimate, cancel stops it within a second, the page stays responsive during a run, a result saves as a build. Timing recorded for a 300-Echo inventory. Screens: setup, running, cancelled, results, at both widths.

**Phase 4** `tests/engine/rotation/loops.test.ts`, `step-buffs.test.ts`, `disabled-steps.test.ts`; `tests/state/rotation-share.test.ts` (export then import is identical). e2e: drag reorder by mouse, by touch emulation and by keyboard. **Shared-build check required by the brief**: `tests/e2e/shared-build.spec.ts` changes one Echo and asserts the score shown on Build, Suggestions, Optimizer and Rotation is the same new value; screenshots of all four are inspected too. Screens: editor, timeline, results, breakdowns, compare, summary.

**Phase 5** `tests/state/sharecode.test.ts` (round trip, length limit), `import-formats.test.ts`, `export-slices.test.ts`; `tests/features/card/contrast.test.ts` (every preset meets 4.5:1 for text); e2e: exported images have exact pixel sizes and are not blank, delete everything clears storage, home shows builds and one next action. Screens: every route in the app at both widths, including all three card presets and each export size.

---

## 6. Risks and open questions

1. **Clean-room boundary.** While checking the brief's links I read the reference site's public method page, which describes its scoring approach. I will reuse none of its wording, constants or procedure. The score in this plan is defined independently (section 4, Phase 1) and will produce different numbers from the reference. I recommend accepting that: matching their numbers would require copying their method.
2. **"Hand-checked" proves the formula is implemented, not that the formula is right.** Expected values are derived by hand from public data and the public formula. No source I found publishes worked damage examples to anchor against. Recommendation: after Phase 1, the owner checks two or three hits in game against the app (the Guide page will say exactly how); I add those as `tests/engine/ingame/*.test.ts`. Until then the app states that results follow the community formula.
3. **My knowledge of the game stops before the current patch (3.8).** Several Resonators and mechanics (Tune Break, newer negative statuses) are new to me. I will work only from the fetched data and public pages, never from memory, and any mechanic without a public formula is shown as "Not modelled".
4. **Hand-encoding volume is the largest cost.** About 12 Resonators, roughly 90 weapon passives, 35 or so Sonata sets. The provenance test keeps it honest; gaps are flagged and counted rather than hidden. If it runs long, weapons used by the core set come first.
5. **Phase order versus shared machinery.** The Build Score in Phase 1 needs a search for reference loadouts and a worker, which overlaps Phase 3's territory. I keep the brief's phase order for the tools but build the compiled evaluator in Phase 0 and the score worker in Phase 1. I think that is the right reading of the brief; flagging it because it is a judgement.
6. **`site/DESIGN.md` path.** The brief names `site/DESIGN.md`, but this project has no `site/` folder. I will write `DESIGN.md` at the project root next to `CLAUDE.md`. One line to change if the owner wants the literal path.
7. **"Short share link" versus "no share buttons".** I read these as compatible: a "Copy build link" action with no social targets. If the owner reads the rule more strictly, the link export is dropped and file export remains.
8. **Graphics-card search.** The reference offers it; I recommend against it for v1. Branch and bound on processor workers is faster for this problem shape, runs everywhere, and can be proven equal to brute force.
9. **Enemy data.** I confirmed the enemy list endpoint but not that detail records carry resistances. If they do not, targets are a level plus resistances with presets taken from the wiki's stated common values (10%, and 40% for a boss's own element), each labelled with its source.
10. **Teammates are buff providers, not simulated attackers.** Team total damage is out of v1; the app says "this Resonator's damage".
11. **Energy.** Whether a rotation can actually afford its Liberation is not checked in v1. The data has per-hit energy values, so a labelled energy readout is a candidate addition in Phase 4 if the gain formula can be sourced.
12. **Other tools' import formats.** Accepted only with public documentation. The outcome may be one format or none; reported either way.
13. **Folder is inside OneDrive.** `node_modules` in a synced folder causes slow installs and file-lock errors on Windows. Recommendation: pause OneDrive sync for `wuwa-calculator/` or exclude `node_modules`. Recorded in `CLAUDE.md` as a known trap.
14. **Latest majors drift.** Exact versions are confirmed at scaffold time; if a brand-new major of Vite or Tailwind has a blocking incompatibility with another, I use the newest pair that works and report it.
15. **Scale.** This is a large build. The phase gates are the protection: nothing is reported as done without its tests and inspected screenshots, and anything unfinished is named in `REPORT.md`.

---

## Execution

- First actions after approval: create `wuwa-calculator/`, `git init`, branch `build/v1`, copy this plan to `docs/plan.md`, write `docs/plans/phase-0.md`, then scaffold.
- Method: I implement phase by phase in this session, test-first, with a code review and the verification gate at each phase boundary, and stop for the owner only where a decision is genuinely theirs. Subagents are not used unless the owner asks.
- Reporting: `REPORT.md` grows per phase with what was built, every improvement over the reference by area, evidence, deviations, and NOT CHECKED items.
