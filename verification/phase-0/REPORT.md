# Phase 0 verification

Date: 11 Nov 2026. Branch `build/v1`.

## Commands (full output saved beside this file)

| Command | Result | File |
|---|---|---|
| `npm run build` | Passed: engine, app and scripts type-check; Vite build in 300ms | `build.txt` |
| `npm test` (Vitest) | Passed: 16 files, 195 tests | `test.txt` |
| `npm run lint` | Passed: no problems | `lint.txt` |
| `npm run data:check` | Passed: "Catalog 3.8.0 (data 2026-11-11) is valid." | `data-check.txt` |
| `npm run test:e2e` | Not run: no end-to-end tests exist until Phase 1 builds real screens | none |

## Screens rendered and inspected

Phase 0 has one screen, the design token check page (`/`). Rendered with Playwright at 1440x900 and 390x844 by `npm run verify:screens -- phase-0 tokens=`. The script reported no console errors and no sideways scrolling at either width.

**tokens-1440.png (inspected).** Graphite page, one signal-blue accent on the primary button, meter needle, grade text and the Signal swatch. No yellow or purple anywhere. Meter reads 0, 100, 200 with the needle at 132. Marks ("Unverified", "Basic model") are neutral outlined text. Archivo wide headings, normal-width body, tabular numerals aligned right in the ruled rows. Sections separated by rules, one filled panel at the bottom.

**tokens-390.png (inspected).** Same content stacked in one column with 16px gutters. Buttons wrap onto separate lines at touch height. Swatches fall to two columns. The 44, 34 and 26px type samples are cut with an ellipsis: that is the sample page's own `truncate`, not a layout fault, but it is a reminder that real screens must size large numbers to fit 390px. No sideways scroll.

## Engine evidence

- Hand-checked damage, expected values worked by hand in each test file with the source field for every input:
  - `tests/engine/handchecked/yangyang.test.ts`: ATK scaling; bare, with weapon and skill tree, with an Echo and a weapon passive, and a level 100 target.
  - `tests/engine/handchecked/taoqi.test.ts`: a hit that scales on DEF; weapon ATK proven not to affect it.
  - `tests/engine/handchecked/jinhsi.test.ts`: a two-part Liberation with element, attack-type and set bonuses and a stacking passive (capped at the weapon's stated 5).
- Compiled evaluator equals the full simulation on 120 random legal loadouts across three Resonators (relative error below 1e-9).
- Engine boundary: no import leaves `src/engine`, no browser or Node globals. The test was shown to fail on a planted `react` import and `window` use, then the probe was removed.

## Data evidence

- 1,040 requests, 0 failures. Catalog: 61 Resonators, 125 weapons, 227 Echoes, 37 Sonata sets, 252 enemies, 1,283 skill values.
- Cross-check against nanoka.cc: 61 of 61 Resonators and 125 of 125 weapons agree at every level; 1,209 of 1,283 skill values verified; 0 value disagreements. The rest carry a recorded reason.
- Echo main stats from the raw game tables agree with the wiki's table.

## NOT CHECKED

- Any page other than the token check page: none exist yet.
- Whether the community formula matches the game itself. The tests prove the engine implements the public formula on real data. In-game checks are planned after Phase 1.
- Accessibility audit (axe) and keyboard testing: no interactive screens yet.
