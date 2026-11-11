# theWuthering design: Bloom

This is the single locked visual direction, chosen by the owner on 11 Nov 2026 from three dark explorations (Mixing Desk, Strata, Bloom). It replaces "Tuning bench". Change this file first, then the code, never the other way round.

## The idea

A build is five Echoes, and an Echo is five substats. Bloom draws exactly that: a flower of five petals, one per Echo, each petal made of its five substats. A substat's colour says what it is, its length says how good the roll was, and grey says it adds nothing to this rotation. The score sits in the centre.

The page around the bloom is a calm night sea: deep navy surfaces, rounded panels, and colour that always carries meaning.

Who it is for: a player who wants to know how good a build is and what to change, on a desktop or a phone.
What a screen must do: show the answer first in plain words, with every number one tap from its working.

## Colour

Dark, never black. Many colours, each with one job. No colour is decoration.

### Surfaces and text

| Token | Hex | Use |
|---|---|---|
| `--color-page` | `#111B26` | Page background |
| `--color-panel` | `#172433` | Section panels, sheets, cards |
| `--color-raised` | `#1E2E40` | Rows and cards inside a panel, hover, the selected tab |
| `--color-rule` | `#2A3B50` | 1px rules and control outlines |
| `--color-rule-strong` | `#4A5F78` | Meter ticks, focused field outline, dividers that must read |
| `--color-ink` | `#EAF0F5` | Primary text and numbers |
| `--color-ink-2` | `#C6D3DF` | Supporting text |
| `--color-ink-3` | `#A2B4C6` | Hints, units, captions (at least 4.5:1 on page, panel and raised; enforced by `tests/ui/tokens-contrast.test.ts`) |
| `--color-signal` | `#3FD49B` | The action colour (jade): primary button, focus ring, current tab mark, meter fill |
| `--color-on-signal` | `#0A2A1E` | Text on jade |
| `--color-signal-dim` | `#1F5A45` | Jade at rest: filled meter track behind the needle |

Action rules: at most one jade-filled button per view; never jade body text.

### Stat tones (the bloom's colours, used everywhere a stat appears)

| Token | Hex | Stat group |
|---|---|---|
| `--color-tone-crit-rate` | `#FF7F66` | Crit. Rate (coral) |
| `--color-tone-crit-dmg` | `#FF5C8A` | Crit. DMG (rose) |
| `--color-tone-atk` | `#3FD49B` | ATK and ATK% (jade) |
| `--color-tone-energy-regen` | `#6CB8FF` | Energy Regen (sky) |
| `--color-tone-bonus` | `#A6EAF2` | Every DMG Bonus (ice) |
| `--color-tone-hp` | `#F2A98A` | HP and HP% (peach) |
| `--color-tone-def` | `#93AACB` | DEF and DEF% (steel) |
| `--color-tone-unused` | `#45556A` | Adds no damage to this rotation (slate) |

A tone is always next to the stat's name. "Adds no damage" is measured, not guessed: the substat is taken away and the rotation re-evaluated (`src/explain/echo-bloom.ts`).

### Elements and change

Glacio `#8FE0F0`, Fusion `#F0744E`, Electro `#D58FD0` (orchid pink, not lavender), Aero `#5FD0A8`, Spectro `#D6D2BE` (pale bone, not yellow), Havoc `#E2647F`, Physical `#B9BBBE`. Gain `#7FCF8E` always with a plus sign, loss `#F0806E` always with a minus sign.

**Owner's rule (11 Nov 2026): no yellows and no purples anywhere in any design.** That covers amber, gold, mustard, lavender, violet and indigo. A test reads every colour token and fails on either hue band.

Banned: gradient washes, glass and blur, glow, neon, coloured shadows, a single colour in many shades standing in for a palette.

## Type

Two families, self-hosted from `@fontsource-variable`. No network font requests.

| Role | Family | Weight | Use |
|---|---|---|---|
| Display | **Unbounded** | 700 to 800 | Resonator name, score, page and section titles |
| Text | **Albert Sans** | 400 | Body, labels, table cells |
| Strong | Albert Sans | 600 to 700 | Emphasis, button labels, totals |

- Unbounded is wide and round; use it for short things only (a name, a number, a title of a few words). Never for sentences, except the one verdict line under the bloom at 20px or larger.
- All numerals are tabular and lining.
- Sentence case everywhere. Never all caps. No monospace.
- Scale (px): 12, 13, 14, 16, 20, 26, 34, 44, 64, 120. Body is 14 on desktop and 16 on phone.
- Line height 1.5 for text, 1.1 for display. Prose lines stay under 72 characters.

## Space and shape

- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 64.
- Corners by rank: controls 12px, cards and rows 18px, section panels and sheets 22px, chips and the grade badge fully round.
- Borders are 1px `--color-rule`. The main Echo's card gets a 2px `--color-ink` border.
- Shadows only under floating layers.

## Layout

- Sections are panels (`--color-panel`, 22px corners) on the page. Inside a panel, items are raised rows or cards.
- Text aligns left. Numbers align right in lists.
- Content column up to 1280px, 24px gutters on desktop, 16px on phone.

### Build page, desktop (1440px reference)

```
+--------------------------------------------------------------------------------+
| theWuthering  [Build] Saved Compare               [Build name v]   undo redo   |
+--------------------------------------------------------------------------------+
|  J  |                    |  Resonator line                                      |
|  i  |   ( bloom with  )  |  Verdict sentence (display face, 20px)               |
|  y  |   (  score in   )  |  [See what changes it]   How this was calculated     |
|  a  |   (  the centre )  |  Rotation / No Echoes / Reference / Maximum figures  |
|  n  |                    |  Tone legend                                         |
+--------------------------------------------------------------------------------+
| Editor panels (Resonator, Echoes, Team, Effects) | Results tabs                  |
+--------------------------------------------------------------------------------+
```

The Resonator's name runs vertically up the left edge at 120px. It is the one large type moment.

### Phone (390px reference)

```
+--------------------------------+
| Build name v            undo   |
+--------------------------------+
| Name (64px, horizontal)        |
| Bloom, full width, score       |
| Tone legend                    |
| Verdict, primary action        |
| Figures (2 by 2)               |
| Editor panels, stacked         |
| Results                        |
+--------------------------------+
| Build     Saved     Compare    |  rounded bottom bar
+--------------------------------+
```

- Every touch target is at least 44 by 44px. No sideways scrolling, ever.
- Pickers and detail panels open as full-height sheets with the search field at the top.

## The signature: the bloom

- Five petals, clockwise from the top: slot 1 (main Echo) at the top, marked by a light arc inside it.
- One wedge per substat. Length = roll tier divided by that stat's number of tiers, so a top ATK roll (4 of 4) and a top Crit. DMG roll (8 of 8) reach equally far.
- Colour = stat tone. Slate = adds no damage to this rotation.
- The score and grade sit in the centre. The bloom is never the only way to read anything: the Echo list beside it names every substat, its value and its tier.
- The meter (0, 100, 200 ticks, jade fill) stays for the score scale, suggestion gains and optimizer progress.

## Motion

- Only in response to the user's own action: a sheet opening, a row expanding, a wedge growing to a new length.
- 120 to 160ms, ease-out. No entrance animations, no hover lifts, no looping motion. Off under `prefers-reduced-motion`.

## Focus and states

- Focus: 2px jade outline with 2px offset on every interactive element.
- Hover: surface steps up one level (panel to raised).
- Selected tab: raised background plus a 3px jade underline.
- Disabled controls are avoided; where one is unavoidable, a short reason is shown beside it.

## Marks

"Unverified", "Beta", "Basic model" and "Not modelled" travel with any number they affect. Marks are neutral: ink text, 1px `--color-rule-strong` outline, fully round, no fill, always the word. Every result carries the stamp "Patch X, data from date" in `--color-ink-3`.

## Words

- Plain labels first, technical detail one tap behind.
- Buttons say what happens: "Try it", "Keep this change", "Save as build".
- Empty states say what to do next in one sentence. Errors say what happened and how to fix it.
- Stat names follow the game exactly. Everything else is everyday language. No memes, exclamation marks or emoji.

## Banned patterns

- All-caps or letter-spaced labels; eyebrow labels above headings.
- Meta strings joined with middle dots. Monospace numbers or labels. Arrows appended to button text.
- A big number, a tiny label and a gradient as the hero.
- Fade-and-slide-up entrances. One word of a headline in a different colour.

## The Card tool is the one exception

The exported build card has its own presets with their own palettes, scoped to the card canvas. They still obey the no-yellow, no-purple rule.
