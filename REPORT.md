# theWuthering build report

Running report for the v1 build. One section per phase. Evidence for each phase is in `verification/phase-N/`.

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
