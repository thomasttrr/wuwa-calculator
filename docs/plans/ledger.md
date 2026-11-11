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
