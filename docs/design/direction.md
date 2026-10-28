# Direction — from "neon lab" to "quiet instrument"

A proposal, not yet applied. The prototype in this folder
(`globe-prototype.html`, screenshots beside it) is the visual target for the
entry surface.

## The diagnosis

The current site is coherent, but it reads as a *game* rather than a *house*:

1. **The body text is a monospace.** `src/app/layout.tsx` maps Syne to
   `--font-cinzel` (display), and Space Mono to **both** `--font-montserrat`
   (body) and `--font-jetbrains` (code). Every paragraph on the site is set in
   Space Mono. That single choice does most of the "terminal" work.
2. **The palette is a neon triad.** Lime `#d4ff3f` as `--c-gold`, purple
   `#b45cff`, magenta `#ff5cc8` on `#070312`, plus glows
   (`--shadow-glow`) and 16–24px radii.
3. **The entry screen explains instead of inviting.** Five bullets, a five-field
   avatar builder, and an inline room-status probe all compete with the one
   decision the page is asking for.
4. **Nine HUD panels** in the world (Atlas, chat, Codex, chart, build, avatar,
   learning, terraces, settings) is a cockpit, not a door.
5. **Four themes** (Void, Bone, Plum, Moss) with two accent families each —
   four products' worth of surface for one brand.

## The six levers

### 1. Palette: ink, paper, one metal

| Token | Today | Proposed |
|---|---|---|
| `--c-void` | `#070312` (violet-black) | `#0a0a0c` (neutral ink) |
| `--c-ink` / `--c-raised` | `#0d0720` / `#171034` | `#101014` / `#14141a` |
| `--c-bone` | `#f4f1ff` (cool white) | `#ece6da` (warm paper) |
| `--c-muted` / `--c-faint` | `#a99bd0` / `#776a9e` | warm neutrals at 46% / 28% |
| `--c-gold` | `#d4ff3f` (lime) | `#bfa273` (brass) |
| `--c-gold-hi` | `#e9ff8a` | `#d8c29b` |
| accents | purple `#b45cff`, rose `#ff5cc8`, teal `#5ce1e6` | remove from chrome; keep only inside charts, desaturated |
| `--shadow-glow` | lime halo | delete — hairline + blur instead |
| radii | `--r-lg: 1rem`, `--r-xl: 1.5rem` | `2px` / `4px`, `999px` for pills only |

Charts still need distinct hues (nine grahas, element quartet), so move those
into a separate, muted chart scale rather than the UI accent slots. That
separation is what makes a dashboard read as an instrument: the *interface* is
monochrome, the *data* is coloured.

### 2. Type: one serif, one grotesque, mono only as a label

- Display: a high-contrast serif — Instrument Serif, Cormorant Garamond, or
  Fraunces. Replaces Syne (geometric, game-y) for `h1`–`h3` and the wordmark.
- Body/UI: a neutral grotesque — Inter, Geist, or Söhne-like. **This is the
  single biggest legibility win**; it ends the monospace-everything look.
- Mono: JetBrains/Space Mono *only* for eyebrows, coordinates, timestamps and
  keys — 8–10px, tracked `0.2em`, uppercase. Never a paragraph.

Scale: display 56–64px desktop / 30–32px mobile with `line-height: 1.06–1.14`
and `-0.012em` tracking; body 14–15px at `1.65`; eyebrow 9px at `0.3em`.

### 3. Composition: air, not density

- One idea per screen. The entry page is: wordmark, one sentence, the globe, one
  action. Everything else moves behind it.
- Hairlines (`rgba(236,230,218,.13)`) instead of borders + fills; **no cards
  with rounded corners and shadows** — a 1px rule and 24–40px of space.
- Generous margins: 96px desktop gutters, 22–24px mobile.
- Motion: 420–600ms, `cubic-bezier(.22,1,.36,1)`, no spring, no bounce, no
  parallax on text. The globe's inertia is the one indulgence.

### 4. The globe

What the reference does, and what we would do:

- **Dotted land.** ~6,000 points sampled on a Fibonacci sphere, kept where they
  fall on land (`world-atlas` 110m), drawn 0.6–1.1px with alpha scaled by depth.
  Front-facing continents brighten, the limb fades — that fade is what stops the
  moiré.
- **A graticule you can barely see** (`rgba(236,230,218,.055)`, 15°) plus one
  rim stroke and a second, wider ring at `R × 1.075`. No atmosphere glow.
- **Drag = rotate** with inertia, **pinch/wheel = zoom** (0.82×–1.9×), **tap a
  pin = select**. Slow auto-drift only while idle and unselected.
- **Pins** are brass: a 5px ring, a 2px core, a hairline leader with the place
  name tracked above it. Edge-on pins drop their label, not their dot.
- A **readout** of the current view (`20° N 28° E`) under the instrument gives it
  the feeling of a device rather than a toy.

This is **2D canvas + `d3-geo`'s orthographic projection**, not WebGL — about
100KB with the land points inlined, crisp on any DPR, no context loss on old
phones, and it never competes with the three.js world for the GPU. `d3-geo`,
`topojson-client` and `world-atlas` are already dependencies and already used in
`src/components/cipher/astro-map.tsx`.

**Why it belongs here specifically.** Cipher already computes relocated KP
charts and astrocartography lines (`src/lib/astrocartography/`). A place picker
is not decoration — tapping a city can set the relocation point and redraw the
local chart. The globe is the front door to the product's actual differentiator.

### 5. Navigation: fewer doors, clearer rooms

- Marketing header: 5 items → **3** ("The Work", "Membership", "Enter"), with the
  rest inside a quiet menu. Keep the wordmark serif and small.
- World HUD: 9 panels → **3** — *Atlas* (places + map), *Room* (chat, builds,
  terraces, session), *Chart* (the member's own data). Avatar and settings live
  in the Room sheet; the Codex becomes a first-run card that fades.
- Dashboard rail: keep the grouping, drop the neon active bar for a 1px brass
  rule and a brighter label; collapse labels to icons under 380px.
- One primary action per screen, always the same shape (paper pill, ink text).

### 6. Copy: subtract

The entry page should say one thing, once. Current hero is ~60 words plus five
bullets; target is ~12 words plus a single line of substance. Delete the
explainer bullets, the room probe, and the avatar form from the first screen.

## Phased plan

**Phase 0 — tokens and type (no layout change).** `src/app/globals.css`
(palette, radii, glow removal), `src/app/layout.tsx` (serif + grotesque,
capped at 2 themes), `src/lib/theme.ts`. The whole site restyles at once and
nothing breaks. Ship this alone and judge it.

**Phase 1 — the globe as an entry surface.**
`src/components/cipher/dot-globe.tsx` (client, canvas, d3-geo orthographic,
pointer/pinch, pin hit-test, `IntersectionObserver` to pause offscreen,
`prefers-reduced-motion` → no drift), plus `src/lib/geo/land-dots.ts` (the
generated point set) and a reworked `src/app/(marketing)/page.tsx`.

**Phase 2 — entry flow.** Move the avatar builder to *after* entry (it is a
good screen, just the wrong one first); wire the selected place into the birth
form as the default location, and into `/dashboard/map` as a relocation point.

**Phase 3 — world chrome.** Re-skin `src/world/ui/Landing.tsx`, `Hud.tsx`,
`panels.tsx`, `world.css` to three panels; the 3D scene itself stays (the valley
is the differentiator — only the interface in front of it changes).

**Phase 4 — the long tail.** Dashboard, admin console, marketing pages inherit
Phase 0 automatically; each page then loses its cards in favour of rules.

## What we keep

The engines, the routing, the accessibility work, the KP verification, the
world's geometry and multiplayer. This is a change of clothes and a change of
doors — not a rewrite. No dependency is added by Phase 1.

## Status

**Phase 0 is applied** (tokens + type, no layout change). What moved:

- `globals.css`: four theme blocks replaced by **Noir** and **Ivory**; lime
  `#d4ff3f` → brass `#bfa273`; violet-black → neutral ink `#0a0a0c`; warm paper
  text; radii `16–24px` → `2–6px`; the glow is now a 1px brass ring, not a
  bloom; easings are slower and the spring is gone.
- `layout.tsx`: Instrument Serif (display), Inter (body), Space Mono (labels
  only) — all self-hosted, so the build still needs no network. Syne removed.
- `theme.ts`: `THEMES = ["dark", "light"]`; a stale `plum`/`moss` cookie now
  falls back to Noir instead of rendering an unstyled page.
- Clerk's modal, the OG card, the avatar default colour and the in-world canvas
  type were repointed at the same tokens, since they are not CSS variables.

Known residue, all scheduled for later phases:

- Uppercase mono labels still carry `.2–.32em` tracking from the Space Mono
  era; with Inter underneath, the hero eyebrow wraps at 390px. Phase 1 rewrites
  that block; a global cap would fight the components that want it tight.
- The cosmogram reads faint in Ivory (it was drawn for a dark ground).
- The world's own chrome (`world.css`, HUD) inherits the new palette but not the
  new composition — that is Phase 3.
- A hydration warning from the cosmogram's `whileInView` predates this change
  (verified by stashing and re-running); it is not caused by Phase 0.

**Phase 1 is applied** (the entry globe). What moved:

- `src/components/cipher/dot-globe.tsx` — canvas globe: orthographic projection,
  drag/pinch/wheel, tap-to-select, depth-faded dot matrix, brass pins with
  hairline leaders, idle drift, palette read from the theme's CSS variables and
  re-read on `data-theme`, loop paused offscreen and in hidden tabs, drift
  suppressed under `prefers-reduced-motion`.
- `src/lib/geo/land-dots.ts` — 6,077 land points packed as base64 uint16 pairs
  (32KB), generated by `scripts/land-dots.mts` (`pnpm geo:dots`) from
  `world-atlas` + `d3-geo`. No runtime point-in-polygon, no runtime topology.
- `src/components/cipher/hero-intake.tsx` — the CSS zodiac ring is gone. The
  globe is the hero's right column on desktop, and comes before the form on
  mobile; its pins fill the city field, and the four places are also real
  buttons under it (the canvas is `aria-hidden`, so the list is the accessible
  control).
- `src/components/cipher/cosmogram.tsx` — coordinates rounded to 3dp, which
  removes the pre-existing hydration mismatch (Node and Chrome disagree in the
  last bits of `Math.sin`), and with it the dev overlay's error badge.

Verified over the DevTools protocol, not by eye: clicking a chip sets the field
to "Ujjain, India"; tapping the London pin on the canvas sets it to
"London, England"; `aria-pressed` follows the selection; no runtime errors.

**Phase 2, in progress.** Shipped so far:

- A place chosen on the globe now hands **coordinates and an IANA zone** to the
  intake (`lat`, `lon`, `tz`, `n`), so `/enter` skips the geocode entirely and
  opens on the verify screen — "Confirm the exact moment", with UTC offset and
  the daylight-saving fold still unguessed. Verified by watching the dev log:
  zero `/api/geocode` requests on the pinned path, one on the typed path.
- The intake no longer fetches a search when a place is already resolved, which
  was quietly burning the geocode route's per-IP budget.
- The world's intake asks for the name only. Silhouette, colour and crest moved
  to the avatar panel inside, where they are previewed against the room.

Still to do in this phase:

- **`/world` is still wearing the old neon.** Its UI is a separate token file
  (`src/world/ui/world.css`, `--w-*`), not the app's `--c-*` family, so Phase 0
  never reached it. That is the first job of Phase 3 — with a decision to make
  about renaming `--w-lime`, which will hold brass.

**Phase 3, the re-skin, applied.** The world now uses the same language as the
2D site — and, more importantly, the same *idea*: ink behind glass, paper for
words, brass for the one action.

- `src/world/ui/world.css` carried its own palette (`--w-lime`, `--w-cyan`,
  `--w-violet`, `--w-rose`, hardcoded indigo gradients). The tokens are renamed
  to what they now hold — `--w-brass`, `--w-sage`, `--w-slate`, `--w-clay` — so
  no variable lies about its colour, and every literal in 3,700 lines of
  stylesheet was mapped onto the 2D palette.
- The avatar palette follows: Signal/Cyan/Violet/Rose/Ember become
  Brass/Sage/Slate/Clay/Moss/Rust, and the default avatar colour is brass.
  Existing saved avatars keep whatever hex they already stored.
- The landing now reads as a brass instrument over a dark valley instead of a
  lime game overlay: one question, one action, the room name, and the state of
  the room.

Not done, deliberately:

- **The valley itself is not re-graded.** Terrain, haze and lighting were tuned
  for the indigo dusk; re-grading them is a scene problem, not a token problem,
  and it cannot be judged in a software renderer.
- **The nine HUD panels are still nine.** Collapsing them to Atlas / Room /
  Chart changes navigation, not colour, and it wants a browser with a working
  WebGL context to evaluate — which this environment does not have.

**Phase 3, the doors.** The nine HUD buttons became three: **Atlas** (Places,
Codex, Terraces), **Room** (Talk, Teaching, Build) and **Chart** (Your chart,
Avatar, Settings). Nothing was rewritten — each tab renders the panel it always
did — but the HUD now reads as three questions instead of a switchboard, and
the shortcuts land in the right group (T → Talk, J → Codex, L → teaching,
C → the chart, Tab → the Atlas).

- `src/world/ui/groups.ts` holds the grouping as data.
- `Panel` renders the tab strip itself, so none of the nine panel components
  needed to know it was grouped.
- The place and beacon colours in `content/world.ts` moved to the same muted
  palette, css string and three.js integer together, so the swatch in the Atlas
  matches the stone in the valley.

Verified over CDP: the HUD exposes exactly three buttons; the Atlas opens on
Places with Places/Codex/Terraces; selecting Codex switches the panel and the
active tab. Not verified: how it looks over the running valley — this
environment's Chromium stopped creating a WebGL2 context partway through the
session, so the last captures show the "WebGL2 is required" fallback.
