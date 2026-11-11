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

Terms checked on 2026-11-11. All game data is the property of Kuro Games, republished by fans. This project's use is personal, local and unpublished. Fetch politely (about 3 requests per second, generic client name, no personal details) and only when a patch changes.

| Source | Role | Access | Terms and licence found |
|---|---|---|---|
| encore.moe API v2, `https://api-v2.encore.moe/api/{lang}/...` (legacy mirror `https://api.encore.moe/{lang}/...`) | Primary: Resonators, per-level stats, per-hit multipliers, skill trees, Sequences, weapons, Echoes, Sonata sets, enemies with resistances | Public, documented: OpenAPI at `https://api-v2.encore.moe/openapi.json`, docs at `/_docs/scalar`. The About page points developers to the API documentation. | Terms of Service (last updated 24 July 2026) at `https://encore.moe/terms`. No data licence. Acceptable use: "Do not misuse the service, interfere with its operation, bypass access controls". Disclaimer: "Database entries may be incomplete or inaccurate". States it is "not affiliated with or endorsed by Kuro Games". No stated rate limit. |
| nanoka.cc static data, `https://static.nanoka.cc/ww/{version}/...` and `https://static.nanoka.cc/manifest.json` | Second source for cross-checking; patch list; beta flagging | Public static JSON used by the site itself. Not a documented API. | No terms, about or licence page found on `ww.nanoka.cc`. Treat as unlicensed: fetch once per patch, never hotlink. |
| Arikatsu/WutheringWaves_Data on GitHub, pinned to commit `49d65625340a32cec6851a12baedc03b5a630b25` (10 Nov 2026, game 3.8.0) | Raw tables the APIs do not expose cleanly: `BinData/phantom/*` (Echo main stats, substats, growth), `BinData/property/*` | Public repository | No LICENSE file. README states client region, version and changelist only. |
| Fandom wiki, `https://wutheringwaves.fandom.com/wiki/Damage` | Formula text only, never data values | Public | CC-BY-SA ("Community content is available under CC-BY-SA unless otherwise noted"). |

Attribution shown in the app's Data page: encore.moe, nanoka.cc, Arikatsu/WutheringWaves_Data, Wuthering Waves Wiki (Fandom, CC-BY-SA), and Kuro Games as owner of the underlying game data.

Known shapes (verified by fetching, 3.8.0): 65 Resonators, 125 weapons, 319 Echoes, 310 enemies. Enemy detail carries `Properties.DamageResistancePhys` and `DamageResistanceElement1..6` in ten-thousandths (1000 = 10%). Character detail carries `Skills[].DamageList[]` with `RateLv` (10 levels), `Type`, `PropertyName`, `Energy`.

## Traps (add to this list in the same commit that discovers one)

- **TypeScript is pinned to 6.x, not 7.x.** `typescript-eslint` 8.72 requires `typescript <6.1.0`. npm resolved 6.0.3 on install. Do not bump to 7 until typescript-eslint supports it.
- **The project sits inside OneDrive.** Synced `node_modules` causes slow installs and occasional file-lock errors. If an install fails with EPERM or EBUSY, pause OneDrive sync for this folder and retry.
- **npm 11 does not run package install scripts by default.** `esbuild` reports an unapproved postinstall. `tsx` and Vite work without it (the platform binary arrives as an optional dependency). Do not approve scripts unless something actually breaks.
- **Git Bash rewrites arguments that start with `/`** into Windows paths (`/` became `C:/Program Files/Git/`). Script arguments never start with a slash: `npm run verify:screens -- phase-1 build=build`.
- **Playwright's browser lives inside `node_modules`.** Always run it with `PLAYWRIGHT_BROWSERS_PATH=0` (the screenshot script sets this itself) so nothing is written outside the project folder. After a fresh `npm install`, run `PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium`.
- **Token contrast is tested.** `tests/ui/tokens-contrast.test.ts` reads `src/ui/tokens.css`. Change a colour in `DESIGN.md` first, then the CSS, then run the test.
- **The engine has its own tsconfig** (`tsconfig.engine.json`, no DOM, `types: []`). A type error that only appears under `npm run build` and names a DOM or Node global inside `src/engine/` means the engine has leaked a dependency.
