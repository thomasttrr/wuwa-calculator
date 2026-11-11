# Ledger — plan: docs/plan.md

One line per finished task; every deviation from the plan is a `Ruling:` line.

## Phase 0

- Ruling: TypeScript 6.0.3 instead of 7.x — typescript-eslint 8.72 caps at <6.1.0 — cost if wrong: one dependency bump later.
- Ruling: tsx kept as the script runner although Node 26 runs TypeScript natively — scripts import engine files without extensions — cost if wrong: one small dev dependency.
