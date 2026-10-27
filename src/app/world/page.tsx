import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { clerkConfigured, getCurrentUser, userHasTier } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { getCompleteProfile } from "@/lib/cipher/profile-snapshot";
import type { BirthProfile, User } from "@/lib/db/schema";
import { resolveKpBirth } from "@/lib/kp/chart";
import { kpCusps, siderealPositions } from "@/lib/kp/positions";
import type { SiderealPosition } from "@/lib/kp/positions";
import {
  GRAHAS,
  GRAHA_LOOK,
  NAKSHATRAS,
  RASIS_META,
} from "@/world/content/world";
import type { SkyPosition } from "@/world/engine/space";
import type { MemberChart, TeachingCall } from "@/world/state";
import type { Viewer } from "@/world/ui/Landing";
import { WorldMount } from "@/world/ui/WorldMount";

/**
 * `/world` — the Cipher as a place.
 *
 * The server's job is narrow and honest: authenticate the member (or admit the
 * demo visitor when Clerk is unconfigured), read the birth profile, and compute
 * the two sets of longitudes the world needs — the member's chart for the
 * Observatory, and the sky as it is right now for the Sky Wheel. The engine
 * receives numbers it cannot invent; everything else is rendered in the browser.
 *
 * A member with no birth data still gets in. The Observatory explains what is
 * missing; locking the whole world behind a form would make the room emptier for
 * everyone.
 */

export const metadata: Metadata = {
  title: "The World",
  description:
    "The Cipher as a navigable 3D world: the Axis, the Observatory, the Amphitheatre, the Studio, the Terraces, the Commons and the Sky Wheel.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DEMO_MEMBER_CLERK_ID = "user_demo_member";
const NAKSHATRA_ARC = 360 / 27;

/**
 * The demo member, created in a real database when Clerk is unconfigured.
 *
 * The in-memory store seeds this member itself. A deployment with a database but
 * no Clerk keys does not — and then `/world` would redirect a visitor to a
 * sign-in page that cannot work. Creating the same projection once makes the
 * no-secrets demo real rather than a promise. It is idempotent and unreachable
 * once Clerk is configured, because this branch is not taken.
 */
async function ensureDemoMember(): Promise<User | null> {
  const store = getStore();
  let demo = await store.getUserByClerkId(DEMO_MEMBER_CLERK_ID);
  if (!demo) {
    try {
      demo = await store.upsertUser({
        clerkUserId: DEMO_MEMBER_CLERK_ID,
        email: "member@thecipher.test",
        firstName: "Mira",
        lastName: "Solis",
        displayName: "Mira Solis",
        role: "member",
        membershipStatus: "approved",
        tier: "initiate",
        bio: "Here to follow the emotional wave, slowly.",
        timezone: "America/New_York",
        interests: ["human-design", "kp-timing", "creative"],
        onboardingCompletedAt: new Date(),
      });
    } catch {
      demo = await store.getUserByClerkId(DEMO_MEMBER_CLERK_ID);
    }
  }
  if (demo) {
    const profile = await store.getBirthProfileByUser(demo.id).catch(() => null);
    if (!profile) {
      try {
        await store.upsertBirthProfile({
          userId: demo.id,
          birthDate: "1991-02-09",
          birthTime: "08:17:26",
          birthTimeZone: "America/New_York",
          birthLatitude: 40.7128,
          birthLongitude: -74.006,
          birthPlaceName: "New York",
        });
      } catch {
        // The world still opens without a stored chart; the Observatory says so.
      }
    }
  }
  return demo;
}

async function currentMember(): Promise<{ user: User | null; signedIn: boolean }> {
  const signedInUser = await getCurrentUser();
  if (signedInUser) return { user: signedInUser, signedIn: true };
  if (clerkConfigured) return { user: null, signedIn: false };
  return { user: await ensureDemoMember(), signedIn: false };
}

function normalize(longitude: number) {
  return ((longitude % 360) + 360) % 360;
}

/** The engine's view of one graha, derived from the KP engine's longitude. */
function toSky(positions: SiderealPosition[]): SkyPosition[] {
  return positions.map((position) => {
    const meta = GRAHAS.find((graha) => graha.id === position.graha) ?? GRAHAS[0];
    const lon = normalize(position.longitude);
    const rashiIndex = Math.min(11, Math.floor(lon / 30));
    const nakshatraIndex = Math.min(26, Math.floor(lon / NAKSHATRA_ARC));
    const look = GRAHA_LOOK[meta.id] ?? { size: 5 };
    return {
      id: meta.id,
      name: meta.name,
      sanskrit: meta.sanskrit,
      glyph: meta.glyph,
      css: meta.css,
      color: meta.color,
      lon,
      degree: lon % 30,
      rashi: rashiIndex,
      rashiName: RASIS_META[rashiIndex]?.name ?? "—",
      nakshatraIndex,
      nakshatraName: NAKSHATRAS[nakshatraIndex]?.name ?? "—",
      retrograde: position.retrograde,
      size: look.size,
      ring: look.ring,
      shadow: look.shadow,
    };
  });
}

function birthFromProfile(profile: BirthProfile) {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(profile.birthDate);
  const time = /^(\d{2}):(\d{2}):(\d{2})/.exec(profile.birthTime);
  if (!date || !time) return null;
  const stored =
    (profile.kpChart as {
      birth?: { input?: { fold?: "earlier" | "later" } };
      system?: { nodeType?: "mean" | "true" };
    } | null) ?? null;
  return {
    year: Number(date[1]),
    month: Number(date[2]),
    day: Number(date[3]),
    hour: Number(time[1]),
    minute: Number(time[2]),
    second: Number(time[3]),
    timeZone: profile.birthTimeZone,
    latitude: profile.birthLatitude,
    longitude: profile.birthLongitude,
    placeName: profile.birthPlaceName ?? undefined,
    fold: stored?.birth?.input?.fold,
    nodeType: stored?.system?.nodeType ?? ("mean" as const),
  };
}

function memberChart(profile: BirthProfile | null): MemberChart | null {
  if (!profile) return null;
  const birth = birthFromProfile(profile);
  if (!birth) return null;

  let instant: Date | null = null;
  try {
    instant = resolveKpBirth(birth).date;
  } catch {
    instant = null;
  }
  if (!instant) return null;

  const nodeType = birth.nodeType ?? "mean";
  const grahas = toSky(siderealPositions(instant, nodeType));

  let lagna: number | null = null;
  let lagnaName: string | null = null;
  try {
    const cusps = kpCusps(instant, birth.latitude, birth.longitude);
    lagna = normalize(cusps.ascendant);
    lagnaName = RASIS_META[Math.min(11, Math.floor(lagna / 30))]?.name ?? null;
  } catch {
    // Placidus is undefined near the poles. The chart still has grahas; it just
    // has no ascendant, and the world says so by omission rather than inventing one.
  }

  const bodygraph = profile.bodygraph;
  const definedCentres = bodygraph?.definedCenters ?? [];

  return {
    label: `${profile.birthDate} · ${profile.birthTime} · ${profile.birthTimeZone}`,
    place: profile.birthPlaceName ?? "the place on record",
    grahas,
    lagna,
    lagnaName,
    definedCentres,
    bodygraphType: bodygraph?.type ?? null,
    bodygraphAuthority: bodygraph?.authority ?? null,
    bodygraphProfile: bodygraph?.profile ?? null,
    bodygraphChannels: bodygraph?.channels?.length ?? 0,
    dasha: null,
  };
}

export default async function WorldPage({
  searchParams,
}: {
  searchParams?: Promise<{ teach?: string | string[] }>;
}) {
  const { user, signedIn } = await currentMember();
  if (!user) redirect("/sign-in?redirect_url=/world");

  const params = (await searchParams) ?? {};
  const requestedTeach = Array.isArray(params.teach) ? params.teach[0] : params.teach;

  const profile = await getCompleteProfile(user.id).catch(() => null);
  const chart = memberChart(profile);
  const sky = toSky(siderealPositions(new Date(), "mean"));
  const store = getStore();
  const approved = user.membershipStatus === "approved" || user.role === "admin";
  const calls: TeachingCall[] = await store
    .listUpcomingCalls(8)
    .then((upcoming) =>
      upcoming.map((call) => {
        const canJoin = approved && userHasTier(user, call.tierRequired ?? "initiate");
        return {
          id: call.id,
          title: call.title,
          startsAt: call.startsAt.getTime(),
          durationMinutes: call.durationMinutes,
          description: (call.description ?? "").slice(0, 320),
          tierRequired: call.tierRequired ?? null,
          canJoin,
          callHref:
            canJoin && call.roomUrl
              ? call.roomUrl
              : `/dashboard/calls#call-${call.id}`,
        };
      }),
    )
    .catch(() => []);

  const name =
    user.displayName?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    "A traveller";

  const viewer: Viewer = {
    name,
    tier: user.tier,
    signedIn,
    // The record is the member dashboard, in demo mode too. A signed-out
    // visitor with Clerk configured never reaches this page (proxy redirects).
    twoDeeHref: "/dashboard",
    chartHref: profile ? "/dashboard/chart" : "/onboarding",
    hasChart: Boolean(chart),
    calls,
    teachCallId: requestedTeach && calls.some((call) => call.id === requestedTeach) ? requestedTeach : undefined,
  };

  return <WorldMount sky={sky} chart={chart} viewer={viewer} />;
}
