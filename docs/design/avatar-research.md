# Avatar systems worth studying

Research brief for the avatar rebuild. The question was not "how do we draw a
better character" but "which avatar systems make people *feel* something, and
which of their mechanics port to a chart-driven world".

---

## 1. The references

### Nintendo Mii — identity through caricature

The Mii editor is famously limited: a handful of heads, a slider or two, no
clothes. It worked because every choice was *legible* — a big nose is a big nose,
and the result still looked like a person you could recognise across Wii Sports,
Miitopia and StreetPass. Nintendo's own designers have described the goal as
"a caricature of you that other people can recognise", not a simulator.

**Steal:** a small set of high-contrast choices beats a wall of sliders. The
output must read at 32px in a room full of other avatars.
[How Nintendo's Miis became the world standard](https://tech.yahoo.com/gaming/articles/nintendo-miis-became-world-standard-100000058.html)

### Picrew — the layered-maker marketplace

[Picrew](https://picrew.me/) lets independent illustrators publish *makers*:
layered 2D character creators with their own art style, each a page you can
remix. It turned avatar creation into UGC of the creator itself — thousands of
makers, each with a following, all producing shareable PNGs. The interface is
radically simple: a column of categories, a grid of swatches, a canvas.

**Steal:** layers + categories, not sliders. And the export is the point — the
avatar exists to be posted.
**Caution:** creator-made art needs licensing and moderation infrastructure.

### Roblox — avatars as an economy

Roblox reported 79.5M daily users and, after opening Marketplace creation in
April 2024, a **61% year-over-year increase in creator earnings** and 22% more
3D avatar items. Nearly 18% of all avatar items ever published arrived in the
months after opening. People do not just customise; they *buy identity*.

**Steal:** items as bundles ("full looks"), a marketplace with price floors, and
the insight that new items drive spend (12% of avatar spend went to items under
30 days old).
[Roblox creator economy, Aug 2024](https://about.roblox.com/newsroom/2024/08/roblox-creators-are-earning-more-and-making-more-items-than-ever)

### Zepeto — mobile-first 3D and brand play

Zepeto made 3D avatars feel like a photo booth: a selfie-ish face, fashion
drops, and brand collaborations (Porsche built a Carrera GT activation inside
it). The avatar is the feed — people post the character, not themselves.

**Steal:** the avatar is content. Every state should be screenshot-able.
[Porsche × Zepeto](https://gamesbeat.com/porsche-accelerates-into-the-metaverse-via-zepeto-for-carrera-gts-25th-anniversary/)

### VRChat + VRoid/VRM — the open standard

VRoid Studio is a free tool for making anime-style 3D avatars; VRM is the open
file format built for carrying them between apps. BOOTH is the marketplace. This
is the only mature, royalty-free, *portable* 3D avatar stack, and 2025 research
still treats VRM as the interoperability answer.

**Steal:** if Cipher ever wants imported 3D avatars, VRM is the format — not a
vendor SDK.
[VRM interoperability paper (ISMAR 2025)](https://ieeexplore.ieee.org/document/11236389) ·
[VRoid Studio](https://vroid.com/en/studio)

### Animal Crossing — the avatar as a mood

New Horizons has a modest creator (face, hair, clothes) but a huge *reaction*
system: emotions you unlock and perform. The character is a way to signal
feeling in a shared space, which is why the reactions, not the face, are what
people remember.

**Steal:** expression is a feature. Give the avatar a small vocabulary of
gestures and let them be triggered from the world, not just the editor.

### Bitmoji / Memoji — the avatar as a message

Both are identity *stickers*: the payoff is sending your character in a context
you did not draw. Memoji's editor is Apple's most opinionated: strong presets,
few free sliders, and the result animates with your face.

**Steal:** the avatar should produce artifacts — a card, a sticker, a share
image — without a screenshot tool.

### The RPG tradition — depth vs. taste

Baldur's Gate 3 and Cyberpunk 2077 offer deep creators, but the ones people
screenshot are the ones with *presets that already look good* (Elden Ring,
Bloodborne). The Sims adds a second axis — personality and lifetime wish — so
the character is a promise about behaviour, not just a face.

**Steal:** presets are a feature, not a shortcut. And a second axis (behaviour,
not appearance) makes an avatar feel alive.

### Ready Player Me — the cautionary tale

The cross-game avatar company raised $72M, served "thousands of developers",
and was **acquired by Netflix in December 2025**, winding down its services on
**31 January 2026**. Anything built on its SDK is now stranded.

**Steal:** do not outsource identity to a vendor. Own the format, or use an open
one.
[Netflix acquires Ready Player Me](https://gamesbeat.com/netflix-acquires-ready-player-me-avatar-maker/)

### DiceBear — procedural fallbacks done right

[DiceBear](https://www.dicebear.com/) generates deterministic SVG avatars from a
seed — no accounts, no uploads, no moderation. Not glamorous, but it is how you
give every member *something* on day zero.

**Steal:** a seeded fallback avatar, so no profile is ever a grey circle.

---

## 2. What the good ones have in common

1. **Small, legible choices.** Mii and Memoji both refuse the slider wall.
2. **Layers, not knobs.** Picrew, Roblox and VRM all compose parts; parts are
   shareable, sellable and moderatable in a way sliders are not.
3. **The avatar does something.** Reactions, stickers, in-world gestures.
4. **The output travels.** PNG export, share links, cross-app formats.
5. **A second axis.** Type, personality, faction, class — something that says
   how the character *behaves*.
6. **Ownership.** Vendor-locked identity dies with the vendor.

---

## 3. What Cipher already has that nobody else does

The Aura Avatar is derived from the chart: two words from twenty-six
activations, a seat from the gate you carry, a format from the line. That is
already a *second axis* — it is astrology, not a menu. The rebuild should
protect that and make it visible, not replace it with a face editor.

The material available, all computed and already tested:

| Source | Gives |
|---|---|
| Human Design type, authority, profile | silhouette class and posture |
| Element balance (fire/earth/air/water) | palette temperature |
| Strongest gate and line | crest / sigil seed |
| Incarnation cross | the title on the share card |
| Dasha and transits | how the avatar changes over time |
| The world's attunement zones | how the avatar behaves in a place |

---

## 4. A build worth doing, in three tiers

### Tier 1 — the layered portrait (2D, ships first)

A Picrew-style builder in the app, 2D SVG layers, seeded from the chart:

- **Layers (~10):** silhouette, garment, crest, aura ring, element mark,
  constellation frame, accessory, title.
- **Controls:** category tabs, swatch rows, and a "derived by the chart" toggle
  per layer — so the default is *already yours*, and every layer can be
  overridden.
- **Storage:** compact JSON in the existing avatar row, plus a share code (the
  same trick as the reading share code) so `?a=…` opens someone else's avatar.
- **Export:** PNG at 1024 and an SVG for print, with the incarnation cross and
  the share code drawn in.

Why first: no new dependency, works on every device, gives the 2D site a face
for the Collective, and produces the social artifact the rest of the system
lacks.

### Tier 2 — the avatar that ages (2D + audio)

- **Transit tint:** the aura's hue drifts with the current sky; the ring rotates
  with the running dasha. Slowly — a degree a day, not a screensaver.
- **A motif, not a sound effect:** derive three notes from the avatar's seed and
  play them on presence join, on mention, on attunement. Research at CHI 2022
  found *audial* customisation increases identification with the avatar, not
  just visual — and Cipher already has the synthesiser.
- **Reactions:** six gestures (bow, still, flare, orbit, hush, open) usable in
  the world and in the Collective.

### Tier 3 — the 3D body (only if the world earns it)

Keep the abstract silhouettes; they are a style, not a limitation. If importing
avatars becomes important, adopt **VRM** (`@pixiv/three-vrm`) and let members
bring a VRoid export, with a size cap and a moderation queue. Do not adopt a
hosted avatar SDK.

---

## 5. Anti-patterns to avoid

- **Photo → 3D.** Uncanny, privacy-heavy, and the results age badly.
- **Hair colour behind a paywall.** Roblox's lesson is that the *marketplace*
  monetises; gating the base identity does not.
- **Sliders as depth.** Forty numbers is not forty times the expression.
- **A vendor SDK.** See Ready Player Me.
- **Unmoderated uploads.** If a member can bring art, someone must review it;
  otherwise the first news story is about the world's first slur.

---

## 6. Open questions for the next session

1. Does the avatar need a **face** at all, or is the abstraction the brand?
2. Is the share code the growth loop (like the reading), or is the world?
3. Do we want a **creator marketplace** (Picrew/BOOTH model), and can this team
   moderate it?
