# Ledger — plan: docs/plan.md

One line per finished task; every deviation from the plan is a `Ruling:` line.

## Phase 0

- Ruling: TypeScript 6.0.3 instead of 7.x — typescript-eslint 8.72 caps at <6.1.0 — cost if wrong: one dependency bump later.
- Ruling: tsx kept as the script runner although Node 26 runs TypeScript natively — scripts import engine files without extensions — cost if wrong: one small dev dependency.
- Ruling: hint text colour changed from #9A9C9F to #A3A5A8 — the planned value measured 4.42:1 on the raised surface, below the 4.5:1 floor — cost if wrong: none, slightly lighter captions.
- Task 1 (scaffold) complete: commit b56c3d2, build and lint pass.
- Task 2 (source terms) complete: findings in CLAUDE.md "Data sources".
- Task 3 (DESIGN.md, tokens, meter, token page) complete: 30/30 contrast tests pass; tokens-1440.png and tokens-390.png rendered and inspected.
- Ruling (owner instruction, 11 Nov 2026): no yellows or purples in any design. Accent changed from amber #F0A73A to signal blue #4DA3FF; marks made neutral; Electro and Spectro chips moved to orchid pink and pale bone. Enforced by a hue test over every colour token — cost if wrong: one token edit.
- Ruling: substat roll values and chances come from the wiki Echo/Stats page (single source; it cites rates published by Kuro Games) — the raw game tables do not list roll tiers in a readable form — cost if wrong: substat values off; Echo main stats do have two agreeing sources.
- Ruling: hit elements come from the raw game damage table, not the encore.moe API, whose ElementPowerType field is not the element — cost if wrong: none, nanoka.cc agrees on every row.
- Ruling: enemy resistances count as verified when they follow the 10% / 40% rule stated on the wiki Damage page (no second database carries them); 5 "Prism" enemies do not and stay unverified.
- Ruling: Resonator DEF of 0 is allowed (Jingran, both sources agree).
- Task 4 (data layer) complete: 1,040 requests, 0 failures; catalog 3.8.0 validated; cross-check: 61/61 Resonators, 125/125 weapons, 1,207/1,283 actions verified, 0 value disagreements.
- Task 5 (engine) complete: formula, stats, actions, rotation (loops, step effects, breakdowns), compiled evaluator (equals full simulation on 120 random loadouts, relative error < 1e-9), ledger, boundary test (watched it fail on a planted import).
- Task 6 (hand-checks) complete: Yangyang, Taoqi, Jinhsi with hand-worked expected values in each test.
- Ruling: the effects audit (which effects touch the rotation) moves to Phase 1 with the effects view that shows it — it is UI-driven and the plan lists it under Area 7 — cost if wrong: none, it reads the same modifiers.
- Ruling: values in skill tables that match no damage entry in the game data are no longer counted as hits (31 of them: shields, speed changes, per-stack bonuses); matching now also searches the whole Resonator, which recovered real hits filed under another skill (e.g. Galbrena Outro) — cost if wrong: a few real hits shown as "Not modelled" until matching improves.
- Ruling: Tune Rupture hits computed with the standard formula but marked unverified (the wiki has no formula for them).
- Ruling: negative-status damage over time (Frazzle, Erosion ticks) is not modelled: the wiki formula is partial ("exact equation remains unknown").
- Ruling: core set changed from the plan. Out: Jinhsi, Camellya, Carlotta, Zani, Taoqi, Cartethyia (reasons in data/authored/core-set.ts). In: Encore, Xiangli Yao, Calcharo, Zhezhi, Roccia, Sanhua. Rule applied: every damage value modelled and verified. Enforced by tests/data/core-set.test.ts — cost if wrong: the owner may want a dropped Resonator; it stays selectable as a basic model.
- Ruling: no separate docs/plans/phase-0.md; this ledger served as the step record for Phase 0 — cost if wrong: none.
- Task 7 (core set and 3.x mechanics) complete.
- Task 8 (Phase 0 gate) complete: build, 195/195 tests, lint and data check pass; token page rendered and inspected at 1440 and 390; reports written.
- Final review: self-review (no subagent used, per plan). Findings carried to Phase 1: teammate buffs not yet collected; guard against set bonuses counting twice; improve damage-row matching.

## Phase 1

- Owner (11 Nov 2026): "I will go with whatever you think is the best route and options." Core set of 12 confirmed as recorded in data/authored/core-set.ts.
- Ruling: weapon passives, set effects, core-Resonator Sequences, passives and Outros, and main-Echo effects are read from game descriptions by a tested pattern reader (scripts/data/extract-effects.ts) instead of being typed by hand. It only encodes sentences it fully understands, every number is checked against its source parameter by the provenance test, conditional sentences become switches labelled with the game's own sentence, and unread sentences (372) are listed for the app. Every always-on and every core-Resonator effect was reviewed by eye. Result: 317 effects, 85 of 94 four- and five-star weapons covered — cost if wrong: a misread stat; mitigated by 26 reader tests and the provenance check.
- Ruling: Sonata sets are now cross-checked: every percentage in encore.moe's written-out text must exist in the raw game table. 35 of 37 agree. Havoc Eclipse and Freezing Frost 5-piece texts (7.5% x4, 10% x3) disagree with the table (6%/5, 30%); they stay unverified and their 5-piece effects are not encoded — cost if wrong: two common sets lose their 5-piece bonus until sources agree.
- Ruling: starting rotations include the Liberation only when it deals damage (Shorekeeper's does not).
- Ruling: the Build Score is defined independently of the reference site. Anchors use the build's own Echoes, sets and main Echo, its rotation, team and target: 0% no Echoes, 100% best mains with 3 useful substats each at the published average roll, 200% best mains with 5 useful substats at maximum. Energy Regen is not valued. Fixed grade bands every 25%. Sample build: 92.8%, grade B — cost if wrong: numbers differ from other tools by design; the app explains the scale.
- Ruling (bug found by e2e): a change made within 300 ms of leaving the page was lost because the browser abandons in-flight IndexedDB writes on unload. Fix: a synchronous local-storage backup on pagehide/hidden when there are unsaved changes; on start the newer copy wins. Test: "a change made just before leaving the page is kept" (both sizes) — cost if wrong: none extra; storage full only skips the backup.
- Ruling (accessibility, found by axe): button names that did not contain their visible text, and three identical "Change" buttons, fixed with screen-reader-only words.
- Ruling: tool tabs show only built tools (Build, Saved builds, Compare) — no dead ends — cost if wrong: none.
- Ruling: the two-tabs-open notice is deferred to Phase 5 with the saving work; until then two open tabs can overwrite each other — cost if wrong: lost edits when using two tabs; reported in REPORT.md.
- Phase 1 gate complete: build, 1,050 unit tests, lint, data check, 32 e2e runs pass; every Phase 1 screen state rendered and inspected at 1440 and 390; six faults found and fixed (see verification/phase-1/REPORT.md).
- Final review: self-review (no subagent, per plan).

## Phase 2

- Owner (11 Nov 2026): redesign to "Bloom" and the border beam, both landed before Phase 2 (commits cbaf5e9, 2e8d1e8).
- Ruling: rankings run on the page, not in a worker: a full simulation of the sample takes about 0.8 ms — cost if wrong: a slow mode on large rotations; re-measure in Phase 4.
- Ruling: gains are damage changes; score points are shown only when the setup fingerprint is unchanged (main stats), because a new weapon or set re-scales the score — cost if wrong: none; the page explains it.
- Ruling: suggested weapons' and sets' conditional effects keep their default state unless "Count every condition as met" is on — cost if wrong: conditional weapons rank low by default; the switch is beside the list.
- Ruling: set suggestions are 5 pieces of one set, keeping each Echo's stats and the main Echo — cost if wrong: mixed 2+3 sets not ranked yet.
- Ruling: the sample build is already the best single-change build (every weapon, set and main stat alternative loses 0.5% to 11%), so the upgrade path is tested on a weakened copy — cost if wrong: none.
- Phase 2 gate complete: 1110 unit tests, 46 e2e runs, screens inspected at 1440 and 390; four faults found and fixed (verification/phase-2/REPORT.md).

## Phase 3

- Ruling: Build gains an engine-only `piecesOverride` so the optimizer can evaluate set bonuses for Echoes it has not fully chosen (tested; never saved).
- Ruling: results may hold fewer than five Echoes (4-4-4 and 4-4-3-1 are legal at cost 12).
- Ruling: the bound assumes set and Echo effects never lower a stat; `monotone.test.ts` checks every such effect in the data.
- Ruling: Generated plans keep the main Echo kind and add the current substats as one total; they offer no Try it or Save — cost if wrong: a player wanting a "full ideal build" uses the score's reference instead.
- Ruling: work is split by (main Echo, second Echo), handed to the pool in batches of about 0.2 s, sharing the cut-off between batches (no SharedArrayBuffer: the page is not cross-origin isolated).
- Found while timing: the test inventory generator shuffled with a random sort comparator, so Node and the browser built different inventories from one seed. Now Fisher-Yates; both agree.
- Phase 3 gate complete: 1133 unit tests, 52 + 4 e2e runs, timing recorded, screens inspected.
