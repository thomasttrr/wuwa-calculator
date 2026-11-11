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
