# theWuthering design: Tuning bench

This is the single locked visual direction. Every screen is built strictly to it. Change this file first, then the code, never the other way round.

## The idea

The game is about sound: Resonators, Echoes, Sonata, Forte, Tune. This app measures that sound. So it looks like a piece of audio test equipment: a calm graphite panel where the numbers are the content and one signal-blue colour marks what is live right now.

Who it is for: a player who wants to know how good a build is and what to change, on a desktop or a phone.
What a screen must do: show the answer first in plain words, with every number one tap from its working.

## Colour

One dark theme. One accent.

| Token | Hex | Use |
|---|---|---|
| `--color-page` | `#1F2124` | Page background |
| `--color-panel` | `#282B2F` | Things you can pick up or edit: an Echo, a step, a sheet |
| `--color-raised` | `#32363B` | Hover and pressed states, popovers, the selected row |
| `--color-rule` | `#3A3E44` | 1px rules and control outlines |
| `--color-rule-strong` | `#565B63` | Meter ticks, focused field outline, dividers that must read |
| `--color-ink` | `#E9E6DF` | Primary text and numbers |
| `--color-ink-2` | `#B4B5B6` | Supporting text |
| `--color-ink-3` | `#A3A5A8` | Hints, units, captions (at least 4.5:1 on page, panel and raised; enforced by `tests/ui/tokens-contrast.test.ts`) |
| `--color-signal` | `#4DA3FF` | The accent (signal blue): current value, primary action, focus ring, meter needle |
| `--color-on-signal` | `#06203F` | Text on the accent |
| `--color-signal-dim` | `#23466E` | Accent at rest: filled part of a meter track behind the needle |

Accent rules:
- The accent means "this is the live value" or "this is the main thing to do". It is never decoration.
- At most one accent-filled button per view.
- Never use the accent for body text or for large filled areas.

Data colours exist only to tell data apart. They never style the interface, and each is always paired with a text label, sign or icon so colour is never the only signal.

| Token | Hex | Meaning |
|---|---|---|
| `--color-glacio` | `#8FE0F0` | Glacio |
| `--color-fusion` | `#F0744E` | Fusion |
| `--color-electro` | `#D58FD0` | Electro (an orchid pink, deliberately not a lavender purple) |
| `--color-aero` | `#5FD0A8` | Aero |
| `--color-spectro` | `#D6D2BE` | Spectro (a pale bone, deliberately not a yellow) |
| `--color-havoc` | `#E2647F` | Havoc |
| `--color-physical` | `#B9BBBE` | Physical |
| `--color-gain` | `#7FCF8E` | A change that increases damage (always with a plus sign) |
| `--color-loss` | `#F0806E` | A change that reduces damage (always with a minus sign) |

Banned: gradients, glass and blur, glow, neon, purple-to-blue washes, coloured shadows, tinted full-bleed backgrounds.

**Owner's rule (11 Nov 2026): no yellows and no purples anywhere in any design.** That covers amber, gold, mustard, lavender, violet and indigo, for the interface, the data colours and the Card presets alike. Spectro and Electro are told apart by their label and icon first; their colours are a pale bone and an orchid pink.

## Type

One family: **Archivo** (variable, width and weight axes), self-hosted from `@fontsource-variable/archivo`. No network font requests.

| Role | Width | Weight | Use |
|---|---|---|---|
| Display | 125 (wide) | 600 to 700 | Page titles, section titles, the big score number |
| Text | 100 | 400 | Body, labels, table cells |
| Strong | 100 | 500 to 600 | Emphasis, button labels, totals |

- All numerals are tabular and lining (`font-variant-numeric: tabular-nums lining-nums`) so columns of numbers align and do not jitter when values change.
- Sentence case everywhere. Never all caps.
- No monospace anywhere, including data labels.
- Scale (px): 12, 13, 14, 16, 20, 26, 34, 44. Body is 14 on desktop and 16 on phone. Nothing is smaller than 12.
- Line height: 1.5 for text, 1.15 for display sizes. Lines of prose stay under 72 characters.

## Space and shape

- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 64. Nothing in between.
- Corners: 3px on controls, 4px on panels and sheets. Nothing is a pill except a round toggle thumb.
- Borders are 1px `--color-rule`.
- Shadows: none, except one soft shadow under floating layers (popover, sheet, dialog) so they separate from the page.

## Layout: ruled, not boxed

- Sections sit directly on the page, separated by a 1px rule and spacing. They are not wrapped in cards.
- A filled panel is reserved for a thing the user can pick up, open or edit.
- Lists of things are ruled rows, not grids of identical cards.
- Text and labels align left. Numbers align right in tables and lists.
- Content column: up to 1280px, with 24px gutters on desktop and 16px on phone.

### Desktop (1440px reference)

```
+--------------------------------------------------------------------------------+
| theWuthering   [Build name v]  Resonator  Weapon  Target   |0---^--100----200| undo redo |
+--------------------------------------------------------------------------------+
| Build   Suggestions   Optimizer   Rotation   Card                              |
+----------------------------+---------------------------------------------------+
| Editor                     | Result first: score, verdict, then stats/damage   |
| (what you change)          | (what it means)                                   |
+----------------------------+---------------------------------------------------+
```

The build bar is on every tool, so the shared build is always in view.

### Phone (390px reference): a first-class layout

```
+--------------------------------+
| Build name v      132%  undo   |   compact sticky header
+--------------------------------+
| Result first: score + verdict  |
| -------------------------------|
| Editor sections, stacked       |
| ...                            |
+--------------------------------+
| Build  Suggest  Optim  Rot Card|   bottom tab bar, thumb reach
+--------------------------------+
```

- Columns stack in priority order: result first, then what you can change.
- Pickers and detail panels open as full-height sheets with the search field at the top.
- Tables become stacked label and value rows. No sideways scrolling, ever.
- Every touch target is at least 44 by 44px.
- Components are designed at 390px first, then given more room.

## The signature: the meter

One element carries the identity: a ruled horizontal scale with tick marks and a signal-blue needle.

```
0            100            200
|-------------|--------^-----|
                       132%
```

- The Build Score is a meter with ticks at 0, 100 and 200.
- The same meter shape shows suggestion gains, optimizer progress and how much a substat is worth, so the whole app reads as one instrument.
- A meter always has a number and a label next to it. The needle is never the only way to read the value.

Everything else stays quiet so the meter can be the one bold thing.

## Motion

- Only in response to the user's own action: a sheet opening, a row expanding, the needle moving to a new value.
- 120 to 160ms, ease-out. No entrance animations on page load, no hover lifts, no looping motion.
- All motion is off under `prefers-reduced-motion: reduce`.

## Focus and states

- Keyboard focus: 2px `--color-signal` outline with 2px offset, on every interactive element.
- Hover: background steps from panel to raised. Pressed: same, no scale.
- Disabled controls are avoided. Where one is unavoidable, a short reason is shown beside it.
- Selected: a 2px `--color-signal` bar on the left edge of the row, plus the word or icon that says so.

## Marks

Small text marks that travel with any number they affect:
- "Unverified": the two data sources disagree, or only one has the value.
- "Beta": data from a version that is not live yet.
- "Basic model": this Resonator's special mechanics are not encoded.
- "Not modelled": a mechanic with no public formula, left out of totals.

Marks are neutral: `--color-ink` text with a 1px `--color-rule-strong` outline, no fill and no hue. They always include the word.

Every result carries a stamp in `--color-ink-3`: game patch and data date.

## Words

- Plain labels first, technical detail one tap behind. "How good is this build?" before "Build Score methodology".
- Buttons say what happens: "Try it", "Keep this change", "Save as build".
- Empty states say what to do next in one sentence.
- Errors say what happened and how to fix it. No apologies, no jokes.
- Stat names follow the game exactly. Everything else is everyday language.
- No memes, no exclamation marks, no emoji.

## Banned patterns (the usual tells of a templated page)

- All-caps or letter-spaced labels; small "eyebrow" labels above headings.
- Meta strings joined with middle dots.
- Monospace for numbers or labels.
- Arrows appended to button or link text.
- Grids of identical rounded cards with soft grey shadows.
- A big number, a tiny label and a gradient as the hero.
- Fade-and-slide-up entrances.
- One word of a headline in a different colour or style.

## The Card tool is the one exception

The exported build card has its own presets (Calm, Bold, Minimal) with their own palettes, because it is an image the user takes away. Those palettes are scoped to the card canvas and never leak into the interface around it.
