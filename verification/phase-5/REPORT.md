# Phase 5 verification: Card, saving, Settings, Home, Guide and navigation

Date: 11 Nov 2026. Branch `opencode/phase-5`, based on `main` at `565c167`. No game numbers, engine output, Build Score or finished-phase behaviour was changed except where saving needed it, noted below.

## Gate

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm test`: 44 files, 1281 tests pass (baseline 1,177).
- `npm run test:e2e`: 98 tests, 96 pass, 2 skipped by design (mouse drag is desktop-only, touch drag phone-only). Baseline was 68 pass and 2 skipped; Phase 5 adds 28 passing runs, 14 per project.

## What was built

### Card (`/card`)

- A real 1080 by 1350 PNG, drawn on a canvas from the same build, simulation and score the Build page uses. The page repeats the score, rotation damage, no-crit and all-crit figures, and the exported image is checked for its exact PNG dimensions.
- Three palettes (`Calm`, `Bold`, `Minimal`) share one layout. They stay inside the design's no-yellow, no-purple rule and are measured for 4.5:1 text contrast and 3:1 colour-tone contrast on every surface.
- The card carries the build name, Resonator, element, level, Sequence, weapon and rank, player name and ID, score and grade, rotation name and counted steps, team, Echo names/costs/main stats/substats, the bloom diagram, patch and data date, a Basic-model or Unverified mark when relevant, and the unofficial-fan-work line.
- Download PNG, copy image (with a plain fallback message if the clipboard refuses), and export the card's data as JSON.
- No game art exists in the committed data, so the portrait is data-derived: the Resonator's name, element colour, rarity and weapon type in the existing `Portrait` monogram pattern. The card says this in plain words. This is a deliberate deviation from the brief's "card art" and is not presented as official art.

### Saving hardening

- Every completed save now carries a revision number and the tab that wrote it, stored with the workspace in IndexedDB.
- Tabs announce completed saves through a local-storage key. A tab that learns of a newer save from another tab raises the visible notice "Another tab saved a newer version of your builds." and pauses autosave. It keeps accepting edits, but nothing is written.
- Two explicit choices: **Keep this tab's version** writes this tab's whole state as the next revision; **Use the other tab's version** loads the other tab's save, replaces this tab, and deliberately does not write it back as a new revision.
- Equal revisions from two tabs count as a collision, not as a tie to be silently broken.
- The synchronous backup written on leaving now keeps the revision and writer. Revision wins over timestamp, so a stale tab cannot replace a newer save with a newer-looking backup. Equal revisions fall back to time.
- Erasing clears IndexedDB and the leave-behind backup, empties the workspace, broadcasts a fresh revision, and stops other tabs quietly restoring their old copy.
- A first run is persisted immediately after the sample build is seeded, so "Saved in this browser" is true before the first edit.

### Settings (`/settings`)

- Player name and ID for the card. Nothing leaves the browser.
- Display: Show everything (moved here as well; the Build page switch still works), Higher contrast, Reduce motion.
- New-build defaults: target level and per-element enemy resistance, stored in schema 3. New builds use them; existing builds are untouched.
- "Your data": counts, one-click **Back up everything**, **Restore a backup** with a confirmation step, **Export builds and rotations**, **Import a file**, and **Erase everything** behind two confirmations (Continue, then typing `erase`).
- Import and restore are validated with zod before touching the workspace. A wrong patch, a damaged file, a build name already present, a duplicated name inside the file, an unknown Resonator/weapon/Echo/set/action, and a future save all produce a plain error. Colliding ids get fresh ids, never an overwrite.
- Restoring a backup replaces the workspace as the next revision. A backup from a newer schema is refused with an update message.
- The page shows the last save time and the current revision.

### Home (`/`)

- The open build with its real score, grade and rotation damage; a meter with the scale explanation; direct paths to the build and the card.
- A context-aware "Next step" that picks Suggestions below the reference, Optimizer above it, or Card near the maximum.
- All builds in one list, each opening the build; first-run empty state; a new-build Resonator picker that applies the saved defaults.
- Additions and deletions of navigation entries are visible here: every one of the seven tools is reachable.

### Guide (`/guide`)

- Overview cards, The score, The formula, and Comparing fairly.
- The score page uses the live anchors, grade bands and the build's own percentage; the formula page uses the same ledger as the Build page, with the player's own crit, DEF and resistance numbers; Comparing fairly lists what must match and shows this build's fingerprint.
- Mobile tabs wrap into a two-column grid rather than becoming unreadably narrow.

### Navigation

- Desktop: wordmark links Home; a tools row shows Build, Suggestions, Optimizer, Rotation, Saved builds, Compare and Card; Guide and Settings are icon links.
- Phone: all seven tools in a fixed bottom bar within thumb reach; Home, Guide and Settings live in the **More pages** sheet. The existing exact labels needed by earlier tests (`Build`, `Rotation`, `Saved`) are preserved.
- Routes added or wired: `/`, `/card`, `/guide` with `/guide/score`, `/guide/formula`, `/guide/comparing`, `/settings`.

## Tests added

- `tests/state/saving.test.ts`: conflict on a newer remote save, equal-revision collision, ignoring own and older saves, autosave held back during conflict, keep-local writes the next revision, use-remote adopts without writing back, replace-all and erase-all revisions, and a plain error on a failed save.
- `tests/state/library-file.test.ts`: export/import round trip, duplicate names refused, id clashes given fresh ids, wrong patch, damaged file, wrong format, unknown game ids, backup round trip, future and older schemas, and backup restore replacement.
- `tests/features/card-model.test.ts`: the card model carries the real build, score and simulation numbers, marks Basic/Unverified, handles no score and missing Echoes, and keeps the stamp/disclaimer.
- `tests/features/card-contrast.test.ts`: every palette, every text surface, every live tone, the "adds no damage" colour, and no yellow or purple.
- `tests/state/pending.test.ts`: regression test that a leave-behind backup is stamped with the leave time, not the last completed save (see Fault 1).
- `tests/e2e/phase-5.spec.ts`, at both 1440 and 390: two-tab keep/use flows with reloads, export then erase then import plus a damaged file, the real card numbers and a 1080 by 1350 download, and axe plus the screen-edge check on `/`, `/card`, `/settings`, `/guide` and `/guide/formula`.

## Faults found and fixed

1. **A change made just before leaving could be lost.** The leave-behind backup passed the last save's metadata, whose `savedAt` overwrote the time of the backup itself. The backup then looked no newer than the completed save, lost the tie-break, and was discarded on the next load. The existing "change made just before leaving" browser test caught this during the final gate. `writePending` now copies only the revision and writer from the caller, so the leave time always wins the equal-revision comparison. The browser test was seen failing with the old behaviour; a unit test now pins the timestamp rule.
2. **"Saved in this browser" was untrue on a first run.** The sample build existed only in memory until the first edit. The first run is now saved immediately after seeding, and the save time shown on Settings is real.
3. Resistance names were truncated in the Settings grid at phone width; the element chips and labels were given room.
4. Guide tabs were too narrow at 390px; they now use a two-column layout.
5. Arrow icons appended to action buttons were removed to follow `DESIGN.md`'s ban. The links still read as actions from their labels.
6. The header crowded the build name, score and page icons at desktop widths; the tools moved to their own row and the extra pages became icon links.

## Screens inspected

Opened and checked at both widths unless noted:

- `home-1440.png`, `home-390-screen1.png`, `home-390-screen2.png`
- `card-1440.png`, `card-390-screen1.png`, `card-390-screen2.png`, `card-export.png` (the real 1080 by 1350 download)
- `settings-1440.png`, `settings-390-screen1.png` through `settings-390-screen4.png`
- `guide-1440.png`, `guide-390-screen1.png`, `guide-390-screen2.png`

Checked for: no console errors, no sideways scrolling, no content past the screen edge, readable contrast, keyboard-reachable controls, correct active navigation, and real numbers matching the Build page. The exported card was opened at full size and its figures, Echoes, bloom legend, patch line and disclaimer read correctly.

Not opened: the full-length phone composites (`home-390.png`, `card-390.png`, `settings-390.png`, `guide-390.png`). The screen slices above cover the same content. This is a viewing choice, not untested functionality.

## Deviations from the brief, with reasons

1. **Card art is data-derived, not game art.** The repository has no Resonator artwork and inventing or fetching art would either add unlicensed assets or invent a portrayal. The card uses the existing name/element/rarity/weapon-type portrait pattern and says so on the card itself.
2. **Restore asks for confirmation.** The brief asks for one-click backup and restore; backup is one click, and restore is one click plus a confirmation because it replaces everything. Nothing is lost by a stray click.
3. **"Show everything" lives in Settings as well as on the Build page.** The Build switch is kept so finished-phase behaviour does not change. The Settings copy is the same setting, not a second one.
4. **First-run persistence is new.** Saving the seeded sample build immediately is a small behaviour change made so the saved-state copy is truthful and so the first reload has a real revision. No game values or scores changed.
5. **Desktop tools stay in their own row, and page links are icons.** Seven tools plus three page links would not fit at 1440px in one row without crowding the build name and score. The icon links are labelled for assistive technology and titled for pointer users.
6. **The nav label remains "Saved builds" on desktop and "Saved" on phone.** Earlier phases and their tests use these labels; shortening the desktop label would break finished behaviour without improving the page.

## Known gaps and NOT CHECKED

- No real phone, tablet, Firefox, Safari or Edge was used. Phone checks are Chromium with a 390 by 844 viewport and touch emulation.
- No screen reader was driven by a person. Axe passes, and controls have names, but reading order and announcements were not listened to.
- Two-tab conflict was tested with two pages in one browser context, which is the real shared-storage case. Separate browser profiles do not share storage and are not expected to conflict.
- Copy image uses the browser clipboard and was checked in Chromium. When the clipboard is unavailable the app tells the user to download instead.
- The card is a fan-made summary, not official art or an in-game share format. It does not claim otherwise.
- A build imported under a name already present is refused; there is no merge-or-rename dialog. The error tells the user to rename or delete first.
- Card JSON export is a data record; there is no card JSON import. Builds and rotations have the full import path.
- Energy affordability of a rotation is still not checked, as stated in the Guide and carried from earlier phases.
- The `verification/phase-1` to `phase-4` screenshots reproduced by the full e2e run were restored to their committed versions after the gate, so this branch does not rewrite earlier evidence.
