# The Cipher

A futuristic cosmic portal for **Krishnamurti Paddhati (KP) astrology**, Human
Design and astrocartography, with a Starseed community: cosmic matching,
themed rooms, live events, courses, flashcards, personalised recommendations, a
first-run tour with a self-completing setup checklist, tiered membership, and an
admin-only AI agent that can research the site and propose changes as pull
requests.

**Live:** [cipher-zeta-indol.vercel.app](https://cipher-zeta-indol.vercel.app)

**KP is the only astrology on the platform.** It is sidereal (KP ayanamsa),
uses Placidus cusps and sub lords, and has no Western or tropical chart and no
fallback to one. Every chart is cast from a birth time given to the second,
after the person confirms the resolved time zone, UTC offset and daylight
saving.

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

The KP engine is tested against the Swiss Ephemeris (`swetest -sid5`) on
every run: across 16 charts from 1900 to 2049 the grahas agree to ≤ 0.5″, the
true and mean nodes to ≤ 0.2″ and the Placidus cusps to ≤ 0.04″.

### 2. The Aura Avatar is free and shareable

The reference platform's best acquisition hook returns `401` to every stranger.
Here the reading is computed from a URL-safe code that packs the birth data, so
anyone can compute and share a reading **without an account and without the
server storing anything**. See `src/lib/cipher/share-code.ts`.

### 3. The door is a place, not a form

The landing page opens on a planet limb — a brass horizon made of 6,077 land
points, the same data the Atlas draws. Drag it and the world turns under your
hand; a place chosen from the list fills the city field and hands its
coordinates and zone straight to the intake. The points are sampled on a
Fibonacci sphere and tested against Natural Earth land once, offline
(`pnpm geo:dots`), then drawn through an orthographic projection on a 2D canvas:
no WebGL, no three.js, ~32KB packed, still sharp on a phone that refuses a
second GL context.

### 4. Every room has a route

The reference hides six "rooms" in client state, so nothing is linkable or
indexable. Everything here is a real route with its own metadata, plus a
`sitemap.xml` and `robots.txt`.

### 5. One design system

A single token family with two themes — **Noir** and **Ivory** — rather than
four. The palette is ink, paper and one metal (brass); there is no neon and no
second accent, so colour is spent only where data needs it: the chart. The choice
is mirrored into a cookie so the server renders the right `data-theme` in the
HTML: no pre-paint script, nothing to flash.

### 6. The Cipher is also a world

`/world` is a navigable, first-person 3D valley: the Axis with its 27 nakshatra
markers, nine graha stones and nine Human Design centre stelae; the Observatory,
where the member's KP chart hangs as an astrolabe and the bodygraph stands on a
screen; the Amphitheatre, where a member can schedule or take the floor with an
opening note and up to eight slide notes, optionally attached to an upcoming 2D
call; the Studio's shared build bench; twelve claimable member terraces; a pavilion for
every Collective room; the Lake, the Sky Gate and the flown Sky Wheel at 1,800 m.

Members join from anywhere through a realtime room — a small WebSocket server on a
long-lived host, or an HTTP/Postgres room that works on Vercel — appear to each
other as customisable avatars (saved to the member profile, not just one
browser), chat, build together, claim a place of their own,
and see a scheduled or live session the moment someone opens one. The pavilion
tabs read and write the same persistent Collective rooms as the 2D site; the
Atlas carries recent activity and unread, and direct messages link to the right
2D thread. The movement is Shep's
Circle's: walk, sprint, four air jumps, flight, a real height function under every
prop, and pointer-capture that is opt-in so the interface stays usable.

The 2D site is never replaced. Everything the chart, courses, Collective and
billing own stays on the 2D site, and the world links back from every panel. The
full architecture, controls, deployment and honest limits are in
[`docs/world.md`](docs/world.md).

---

## Calculation engines

### KP — `src/lib/kp/`

| Module | Responsibility |
|---|---|
| `ayanamsa.ts` | KP (Krishnamurti) ayanamsa: 22°21′50″ at J1900 + IAU 2006 precession, reproducing the Swiss Ephemeris to < 0.01″ |
| `ephemeris.ts` | Full VSOP87D planets and ELP/MPP02 Moon (via `astronomia`, MIT), light time and aberration, mean and true node |
| `positions.ts` | Sidereal positions of the nine grahas; Placidus cusps from true obliquity; refuses Placidus-undefined latitudes |
| `lords.ts` | Sign, star, sub and sub-sub lords; the 249-row sub table generated from first principles |
| `significators.ts` | Four-level house significators, with Rahu/Ketu as agents of their sign lords |
| `ruling-planets.ts` | Ruling planets, with the day lord taken from local sunrise |
| `dasha.ts` | Vimshottari dasha to antara (365.25-day year) |
| `chart.ts` | `computeKpChart`: verified birth moment (seconds required, DST folds explicit) → full chart |
| `birth-schema.ts` | The one validation schema for KP birth data |

Shared astronomy (time scales, ΔT from the IERS series, Placidus geometry)
lives in `src/lib/astronomy/`. It contains no astrology of its own.

### Astrocartography — `src/lib/astrocartography/`

Rising (Lagna), setting (7th), culminating (10th) and nadir (4th) lines for
each graha from apparent right ascension and declination — pure astronomy,
independent of any zodiac — plus KP charts relocated to any place.

### Community and matching

- `src/lib/community/rooms.ts` — the Starseed Collective's rooms, created on
  first visit in a real database.
- `src/lib/matching/` — opt-in cosmic matching over shared interests, Human
  Design (electromagnetic and companionship channels) and KP signatures.
- `src/lib/recommendations/` — the dashboard's "For you" ranking, each item
  with its reason.

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
| Auth | Clerk (`@clerk/nextjs` 7); admin role from Clerk `publicMetadata.role` or the verified `ADMIN_EMAILS` allowlist |
| Database | Neon Postgres + Drizzle ORM, with a seeded in-memory fallback |
| Payments | Stripe Billing (Checkout + Customer Portal + webhooks) |
| Scheduling | FSRS-based spaced repetition |
| 3D world | Three.js (r186), a procedural valley, a custom post chain, `simplex-noise`; `ssr: false` |
| Realtime | WebSocket room (`ws`, JSON) for low latency; HTTP/Postgres room for Vercel; Clerk-authenticated in production |

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
pnpm dev:realm      # Next.js + the room server (the full 3D world)
```

**No environment variables are required.** With an empty environment the app
builds, computes charts, and serves every page. Auth surfaces explain that Clerk
is not configured; the database falls back to a seeded in-memory store so the
dashboard, community, courses and flashcards are all explorable. That fallback
is per-instance and non-durable, and the UI says so.

To enable real integrations, copy `.env.example` to `.env.local` and fill in
what you need. Each variable unlocks one capability independently.

### The 3D world and its rooms

The world has two room transports behind one interface:

- **WebSocket** for low latency. Run it locally with `pnpm dev:world`, or deploy
  `server/world-server.mjs` to a host with a long-lived process (Railway, Render,
  Fly, a VPS) and build the Next app with `NEXT_PUBLIC_WORLD_WS_URL=wss://…/ws`.
- **HTTP + Postgres** for Vercel. `/api/world/room` uses the project's existing
  Neon database and creates three additive `cipher_world_*` tables on first use.
  Presence is polled at ~1.2 s and interpolated; builds, terraces, sessions and
  signals arrive on the next poll. In production this transport is
  Clerk-authenticated, and a member's world id is an opaque hash.

The client chooses WebSocket on localhost or when the URL is set, and HTTP
otherwise. `?transport=ws` / `?transport=http` forces one.

```bash
pnpm dev:world        # ws://localhost:8787/ws
pnpm dev:realm        # next dev + the WebSocket room together
```

A private room is a room name: `/world?room=our-private-room`. The WebSocket room
name is the invitation and has no accounts of its own; set `WORLD_ROOM_SECRET`
(and `NEXT_PUBLIC_WORLD_ROOM_KEY`) to require a shared key. If neither room is
reachable, the world opens in **solo orbit** and says so. See
[`docs/world.md`](docs/world.md) for the protocol, limits and deployment notes.

### Scripts

```bash
pnpm dev                # development server
pnpm dev:world          # the WebSocket room server on :8787
pnpm dev:realm          # Next.js and the room server together
pnpm build              # production build
pnpm start              # serve the production build
pnpm lint               # ESLint
pnpm test:engine        # Engine and library tests (node:test)
pnpm typecheck          # tsc --noEmit
pnpm db:generate        # Drizzle: generate migrations
pnpm db:push            # Drizzle: push the schema to DATABASE_URL
pnpm db:seed            # Tiers and Collective rooms (idempotent; run after db:push)
```

---

## Membership

Four tiers, with the base paid tier at **$15/month**:

| Tier | Price | Unlocks |
|---|---|---|
| Threshold | Free | Full KP chart and bodygraph, Aura Avatar, two foundation courses (KP and Human Design), cosmic map, public feed |
| Initiate | $15/mo | The Experiment track, community + DMs, weekly live call, full flashcard decks |
| Adept | $29/mo | Signal & Transmission track, KP horary (Prashna) with ruling-planet timing, call priority |
| Oracle | $59/mo | Monthly reading circle, direct studio line, early access |

Membership is by application. An admin reviews each one and approves or denies
it from `/admin/applications`; nothing is charged before approval. Applications,
reviewer notes and every privileged action are recorded in an audit log. The
review desk is notified in-app when an application arrives, and the applicant is
notified when it is decided — the reviewer's private note is never copied into
that notification.

Admins work from `/admin`, which carries its own manual at `/admin/manual`:
getting access, the application workflow, member edits, the tier ladder and
billing, moderation, the agent and its guardrails, first-run setup, and what to
check when something looks wrong. It is written for whoever runs the site, and
it says plainly which declared integrations are not wired up yet.

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

The loop speaks OpenAI-compatible Chat Completions: **DeepSeek** when
`DEEPSEEK_API_KEY` is set (`deepseek-flash`, or `deepseek-v4-pro` via
`AGENT_MODEL`), **OpenAI** as the fallback, and any compatible gateway via
`OPENAI_BASE_URL`. Without a model key the console still loads, lists its tools,
and explains what it needs. That is deliberate: the UI should never be a mock.

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
it sets `DATABASE_URL` for you. Put the same value in `.env.local`, then run
`pnpm db:push` and `pnpm db:seed` once (both are safe to re-run).

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

`astronomy-engine` and `astronomia` are MIT licensed; `d3-geo`,
`topojson-client` and `world-atlas` (Natural Earth data) are ISC. The Swiss
Ephemeris (AGPL/commercial) is **not** a dependency: it was used only offline
to generate the reference values in `src/lib/kp/__tests__/`.

The planet and Earth textures in `public/textures/planets/` and
`public/textures/earth/` are from [Solar System Scope](https://www.solarsystemscope.com/textures/),
CC BY 4.0, based on NASA imagery. GSAP (with ScrollTrigger) is under the GSAP
Standard License. Cormorant Garamond and Inter are under the SIL Open Font
License (see `src/app/fonts/`).


---

## The world: verification and limits

The world was verified in a real browser with software WebGL (Chromium + Mesa
llvmpipe under Xvfb) at 1440×900 and 390×844:

- The landing, the name field and the room-status probe render before entry;
  entry is queued if the valley is still loading.
- Walk, sprint, four air jumps, flight and the return to walking change the player
  state and the HUD.
- All three HUD doors open (Atlas, Room, Chart) and every tab inside them
  renders its panel: Atlas, chat, Codex, chart, build, avatar,
  learning, terraces and settings.
- Two members in one room see each other's presence; a chat message sent by one is
  read by the other.
- A piece placed in the Studio appears on the second client; the server persists
  it.
- A terrace claim made by one member is visible to the other with its title and
  colour.
- A scheduled teaching session appears on the second client with its time and
  notes; the host goes live, advances a slide, and the second client sees the new
  slide. The session can be attached to a 2D call and links back to it.
- A pavilion message written in the world appears on the 2D Collective page; a
  reply there returns to the open pavilion. The Atlas shows the room as unread
  until it is opened, then clears it. A DM thread links to the right 2D
  conversation.
- An avatar chosen in the world survives clearing local storage and a full
  reload; the same name, silhouette, colour and crest appear on
  `/dashboard/settings` and the dashboard world card.
- Mobile: the hero CTA is above the fold, the touch controls appear, and the
  Atlas opens from the touch cluster.
- On the deployed Vercel preview, two browsers met over HTTPS through the
  HTTP/Postgres room: presence reached 2 on both, chat arrived, a Studio piece
  placed by one appeared for the other, and the server snapshot showed both
  players and the piece.

Honest limits:

- **Two transports, two latency profiles.** The HTTP/Postgres room works on
  Vercel with no extra host, but presence is ~1.2 s and signals arrive on the next
  poll. The WebSocket room is the low-latency option and needs a long-lived
  process and a persistent volume.
- **The WebSocket room has no accounts.** The link is the invitation; names are
  not unique. The client presents a stable browser id, so a plot and a scheduled
  session reconnect to the same member, with a name fallback. It is not an
  account. The HTTP transport is Clerk-authenticated in production and uses an
  opaque member hash, but the WebSocket server remains link-keyed. Add token
  verification before opening it to strangers.
- **The WebSocket bench is a JSON file.** One process is assumed. The HTTP room is
  already Postgres-backed with optimistic version retries.
- **There is no moderation console or reporting flow in the world yet.** Chat is
  rate-limited and sanitised, and the HTTP room is authenticated, but a room is
  still a room. Add reporting, muting and an admin view before opening one to a
  large public audience.
- **Software WebGL loses the context** in some environments. The quality control
  and `?post=0` reduce the load; the flat map is always available.
- **Teaching notes are room state, not a recording.** The 2D call is the anchor
  and the link; slides live in the room (JSON or Postgres), not in the call record
  or a course lesson.
- **Avatar images are not uploaded.** The member profile stores a world name,
  silhouette, colour and crest, not a photo. There is no image moderation queue.
- **Read markers are per browser.** World and 2D unread agree in the same browser,
  not across devices. Durable per-member read state would need the existing
  `channel_members` table to be wired up.
- **Direct messages are linked, not embedded.** The world shows recent threads
  and unread and opens the right 2D conversation; it has no in-world DM composer.
- **No voice or video.** The Amphitheatre floor is a presence signal; the call
  stays in the 2D site or your own room.

### World assets and credits

- PBR surfaces and water normals: [Poly Haven](https://polyhaven.com), CC0.
- Planet textures: [Solar System Scope](https://www.solarsystemscope.com/textures/),
  CC BY 4.0; see `public/textures/planets/LICENSE.txt`.
- Renderer: [three.js](https://threejs.org), MIT. Noise: `simplex-noise`, ISC.
- All text, glyphs, sky, fire, geometry and audio in the world are procedural.
