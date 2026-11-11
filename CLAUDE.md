# theWuthering (wuwa-calculator)

A local-first, fan-made Wuthering Waves damage calculator and build lab. Unofficial; not affiliated with Kuro Games.
The spec is `../wuwa-calculator-build-v1.md`. The approved plan is `docs/plan.md`. Progress and rulings are in `docs/plans/ledger.md`.

## Stack

- React 19, TypeScript 6, Vite 8, Tailwind CSS 4 (`@tailwindcss/vite`, CSS-first tokens), Vitest 5, ESLint 10.
- No server, no accounts. Browser storage only.
- Node 26, npm 11. Windows is the development machine.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app locally |
| `npm run build` | Type-check the engine, app and scripts, then build |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run data:fetch` | Download source data into `data/raw/` and trimmed snapshots into `data/snapshots/` |
| `npm run data:build` | Normalise snapshots into `data/game/<version>/` and cross-check the sources |
| `npm run data:check` | Validate the catalog against its schemas |
| `npm run verify:screens` | Render pages at 1440px and 390px into `verification/` |

## Layout

- `src/engine/` is the damage engine: pure TypeScript, no DOM, no React, no packages. It never imports JSON; callers pass it a `Catalog`.
- `src/data/` loads `data/game/<version>/` and exposes the typed `Catalog`.
- `data/snapshots/` are trimmed source responses and are never edited by hand. `data/game/` is produced only by `scripts/data/normalise.ts`. `data/authored/` is hand-encoded and every number in it cites the source description it came from.
- `DESIGN.md` is the single locked visual direction. Build strictly to it.

## Integrity rules (non-negotiable)

1. Every number shown in the app traces to a visible formula or a stat breakdown.
2. Never invent a multiplier, stat or data value. If a value cannot be verified from a public community source, mark it `verified: false` in the data and show it as "Unverified" in the UI, or leave it out.
3. Clean room: thewuwacalculator.com is a behaviour reference only. No code, text, artwork, layout or constants from it. It is never a data source.
4. Anything not rendered and inspected is reported as NOT CHECKED, never as passing.
5. No social features, no login, no remote repository, no deploy. Nothing outside this folder is modified.
6. Interface language is plain, calm and friendly. No memes, no joke buttons. Technical detail sits one tap behind a plain label.

## Data sources

Filled in during Phase 0 step 2 (terms check). Until that section is complete, do not fetch.

## Traps (add to this list in the same commit that discovers one)

- **TypeScript is pinned to 6.x, not 7.x.** `typescript-eslint` 8.72 requires `typescript <6.1.0`. npm resolved 6.0.3 on install. Do not bump to 7 until typescript-eslint supports it.
- **The project sits inside OneDrive.** Synced `node_modules` causes slow installs and occasional file-lock errors. If an install fails with EPERM or EBUSY, pause OneDrive sync for this folder and retry.
- **npm 11 does not run package install scripts by default.** `esbuild` reports an unapproved postinstall. `tsx` and Vite work without it (the platform binary arrives as an optional dependency). Do not approve scripts unless something actually breaks.
- **The engine has its own tsconfig** (`tsconfig.engine.json`, no DOM, `types: []`). A type error that only appears under `npm run build` and names a DOM or Node global inside `src/engine/` means the engine has leaked a dependency.
