# The Cipher

A rebuilt, more accurate implementation of **The Cipher** — a Human Design and
Western astrology platform, with tiered membership, a community, courses,
flashcards, and an admin-only AI agent that can research and change the site.

The reference product is <https://cipher.l10raw.com>. This is a ground-up
rebuild that keeps the concept and discards the inaccuracies.

---

## What is actually better here

### 1. The calculations were verified, not assumed

The bodygraph engine has been checked against **published bodygraphs**, and it
reproduces them exactly.

| Chart | Type | Profile | Authority | Definition | Channels |
|---|---|---|---|---|---|
| Oprah Winfrey | Generator | 2/4 | Emotional | Triple Split | 19-49, 24-61, 29-46, 34-57 |
| Donald Trump | Manifesting Generator | 1/3 | Emotional | Single | 6-59, 17-62, 21-45, 35-36 |
| Barack Obama | Projector | 6/2 | Emotional | Single | 30-41 |
| Ra Uru Hu | Manifestor | 5/1 | Splenic | Single | 10-20, 10-57, 20-57, 23-43, 25-51 |

For Oprah and Trump all **26 of 26 activations** match the published tables,
not just the headline values.

The traps that most calculators fall into, and what this codebase does instead:

- **Design is 88° of solar arc, not 88 days.** The real interval ranges from
  about 86.7 to 91.9 days depending on the time of year. `solveDesignTime`
  bisects on the signed solar arc to sub-second precision. Using a flat 88-day
  offset moves the Design Moon by tens of degrees and silently corrupts the
  profile and incarnation cross.
- **True lunar node, not mean.** The node is derived from the Moon's
  instantaneous orbital plane. The mean node can differ by more than a degree —
  enough to move a gate.
- **Tropical zodiac, and the wheel starts at exactly 302.000°** (2°00′
  Aquarius, where Gate 41 Line 1 begins). Gate = 5.625°, line = 0.9375°,
  colour = 0.15625°, tone = 0.0260416°, base = 0.00520833°.
- **Apparent positions, and one time scale throughout.** ΔT is applied so the
  cusps and the planet positions cannot disagree with each other.
- **Boundary sensitivity is surfaced, not hidden.** Any activation within 0.02°
  of a line or gate edge is reported, because a one-minute birth-time error
  moves the Ascendant about 15′ and the Moon about 33″.

The astrology engine was independently checked against
[astro-charts.com's Einstein chart](https://astro-charts.com/persons/chart/albert-einstein/):
all ten planets agree to **≤ 0.7 arcminutes**.

### 2. The Aura Avatar is free and shareable

The reference platform's best acquisition hook returns `401` to every stranger.
Here the reading is computed from a URL-safe code that packs the birth data, so
anyone can compute and share a reading **without an account and without the
server storing anything**. See `src/lib/cipher/share-code.ts`.

### 3. Every room has a route

The reference hides six "rooms" in client state, so nothing is linkable or
indexable. Everything here is a real route with its own metadata, plus a
`sitemap.xml` and `robots.txt`.

### 4. One design system

A single token family with four themes (Void, Bone, Plum, Moss) rather than two
parallel sets, one theme storage key rather than three, and no dead themes.

---

## Calculation engines

### Western astrology — `src/lib/astrology/`

| Module | Responsibility |
|---|---|
| `ephemeris.ts` | Planetary positions via `astronomy-engine`, true node, mean Lilith, ΔT, sidereal time, obliquity |
| `houses.ts` | Placidus (semi-arc fixed point), Porphyry, Whole Sign, Equal, polar fallbacks |
| `aspects.ts` | 12 aspect definitions, applying/separating, strength |
| `time.ts` | Wall-clock → UTC with explicit DST gap and fold handling |
| `chart.ts` | `computeNatalChart` |

**On the ephemeris choice.** The industry standard is Swiss Ephemeris, which
matches astro.com to roughly 0.001″. It is also dual-licensed AGPL-3.0 or
commercial, and the AGPL's network clause would require *this entire
application* to be AGPL because it is offered as a public service. The
commercial licence is a one-time 700 CHF.

We use `astronomy-engine` (MIT) instead. It is validated to roughly an
arcsecond — verified here against three published equinox instants and three
solar eclipse maxima, where the Sun's error was **≤ 1.5″**. That is two orders
of magnitude finer than a single line (0.9375°), so it is more than sufficient.

The ephemeris sits behind a provider interface in `ephemeris.ts`. Swapping in
`swisseph-wasm` for arcsecond parity is a single-file change plus a licence
purchase; nothing else in the codebase moves.

**Known gap:** Chiron is not available from `astronomy-engine`. It is omitted
with an explicit warning rather than faked.

### Human Design — `src/lib/human-design/`

| Module | Responsibility |
|---|---|
| `constants.ts` | Gate wheel, 9 centres, 36 channels, 12 profiles, type/authority/definition tables |
| `activation.ts` | Longitude → gate/line/colour/tone/base, boundary distance |
| `design-time.ts` | The 88° solar-arc root-find |
| `bodygraph.ts` | 26 activations, type, authority, profile, definition, incarnation cross, variables |
| `bodygraph-layout.ts` | The standard bodygraph geometry |

Tests live in `__tests__/` folders under `src/lib/` (Human Design engine,
house angles, billing tiers) and run on `node:test` with no extra dependencies:

```bash
pnpm run test:engine
```

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript strict |
| Styling | Tailwind v4 with a four-theme CSS-variable token system |
| Animation | `motion` (Framer Motion successor) |
| Audio | A Web Audio synthesiser — no audio files, no preloading |
| Auth | Clerk (`@clerk/nextjs` 7), roles via `publicMetadata` |
| Database | Neon Postgres + Drizzle ORM, with a seeded in-memory fallback |
| Payments | Stripe Billing (Checkout + Customer Portal + webhooks) |
| Scheduling | FSRS-based spaced repetition |

### A note on Next.js 16

This version has breaking changes that matter: `middleware.ts` is now
`proxy.ts` and runs on the Node runtime; `params`, `searchParams`, `cookies()`
and `headers()` are all async; Turbopack is the default. The version-matched
documentation is bundled at `node_modules/next/dist/docs/`.

---

## Running it

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

**No environment variables are required.** With an empty environment the app
builds, computes charts, and serves every page. Auth surfaces explain that Clerk
is not configured; the database falls back to a seeded in-memory store so the
dashboard, community, courses and flashcards are all explorable. That fallback
is per-instance and non-durable, and the UI says so.

To enable real integrations, copy `.env.example` to `.env.local` and fill in
what you need. Each variable unlocks one capability independently.

### Scripts

```bash
pnpm dev              # development server
pnpm build            # production build
pnpm start            # serve the production build
pnpm lint             # ESLint
pnpm test:engine      # Engine and library tests (node:test)
pnpm typecheck        # tsc --noEmit
pnpm db:generate      # Drizzle: generate migrations
pnpm db:push          # Drizzle: push the schema to DATABASE_URL
```

---

## Membership

Four tiers, with the base paid tier at **$15/month**:

| Tier | Price | Unlocks |
|---|---|---|
| Threshold | Free | Full chart and bodygraph, Aura Avatar, one foundation course, public feed |
| Initiate | $15/mo | The Experiment track, community + DMs, weekly live call, full flashcard decks |
| Adept | $29/mo | Signal & Transmission track, synastry, transits, call priority |
| Oracle | $59/mo | Monthly reading circle, direct studio line, early access |

Membership is by application. An admin reviews each one and approves or denies
it from `/admin/applications`; nothing is charged before approval. Applications,
reviewer notes and every privileged action are recorded in an audit log.

---

## The admin agent

`/admin/agent` is an admin-only assistant that can research, read the
repository, and propose changes — by **voice or text**. Its security model:

- Admin-only at the route, not merely in the UI.
- **Read-only by default.** Code tools require a `GITHUB_TOKEN`, and even then
  the agent can only open a pull request against a non-default branch. It can
  never push to the default branch.
- Filesystem tools run against a strict path allowlist and reject traversal.
- Destructive tools require an explicit confirmation token echoed back by the
  client.
- Every tool call is written to the audit log.
- The browser never receives a server secret. Realtime voice uses short-lived
  ephemeral credentials minted server-side, with the Web Speech API as a
  key-free fallback.

Without `OPENAI_API_KEY` the console still loads, lists its tools, and explains
what it needs. That is deliberate: the UI should never be a mock.

---

## Deployment

### Vercel

```bash
vercel link
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
# …and so on for whichever integrations you want
vercel --prod
```

The app deploys and runs with **zero** environment variables. Add them in the
Vercel dashboard to turn on each integration.

For a durable database, add the Neon integration from the Vercel Marketplace;
it sets `DATABASE_URL` for you. Then run `pnpm db:push` once.

### Webhooks

| Provider | Endpoint | Events |
|---|---|---|
| Clerk | `/api/webhooks/clerk` | `user.created`, `user.updated`, `user.deleted` |
| Stripe | `/api/stripe/webhook` | `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed` |

Both are idempotent, keyed on the provider's event id.

---

## Attribution and licensing

Structural Human Design data — the gate wheel, the gate→centre map, the 36
channels and the bodygraph layout — is standard published reference material,
the same on every bodygraph ever printed, and is reproduced here as facts.

All editorial prose in `src/content/` is original to this project. Nothing was
copied from the reference site; its content was used only as a factual
cross-check.

`astronomy-engine` is MIT licensed. See the note above on why Swiss Ephemeris
was not used.
