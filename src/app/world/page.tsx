import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { clerkConfigured, getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { getCompleteProfile } from "@/lib/cipher/profile-snapshot";
import type { BirthProfile, User } from "@/lib/db/schema";
import { astrocartography } from "@/lib/astrocartography/lines";
import { type ShareableBirth } from "@/lib/cipher/share-code";
import { resolveKpBirth, type KpBirthInput } from "@/lib/kp/chart";
import { siderealLongitude } from "@/lib/kp/positions";
import { NAKSHATRAS, type Graha } from "@/lib/kp/constants";
import { Button } from "@/components/ui/button";
import { WorldCanvas } from "@/components/world/world-canvas";

/**
 * The world, full screen.
 *
 * This is the 3D-first entry: no dashboard chrome, no page shell — the canvas
 * *is* the route, with a HUD over it. The 2D site stays one click away, because
 * the world must never be the only way to reach a member's own data.
 *
 * Phase 1 of the re-architecture: the place exists. First-person movement and
 * structures come next.
 */

export const metadata: Metadata = {
  title: "The World",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DEMO_MEMBER_CLERK_ID = "user_demo_member";

const PLANETS: ReadonlyArray<{ graha: Graha; glyph: string }> = [
  { graha: "sun", glyph: "\u2609" },
  { graha: "moon", glyph: "\u263d" },
  { graha: "mars", glyph: "\u2642" },
  { graha: "mercury", glyph: "\u263f" },
  { graha: "jupiter", glyph: "\u2643" },
  { graha: "venus", glyph: "\u2640" },
  { graha: "saturn", glyph: "\u2644" },
  { graha: "rahu", glyph: "\u260a" },
  { graha: "ketu", glyph: "\u260b" },
];

async function currentMember(): Promise<User | null> {
  const signedIn = await getCurrentUser();
  if (signedIn) return signedIn;
  if (clerkConfigured) return null;
  return getStore().getUserByClerkId(DEMO_MEMBER_CLERK_ID);
}

function birthFromProfile(profile: BirthProfile): ShareableBirth | null {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(profile.birthDate);
  const time = /^(\d{2}):(\d{2}):(\d{2})/.exec(profile.birthTime);
  if (!date || !time) return null;
  const stored =
    (profile.kpChart as {
      birth?: { input?: Partial<KpBirthInput> };
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
    nodeType: stored?.system?.nodeType ?? "mean",
  };
}

export default async function WorldRoute() {
  const user = await currentMember();
  if (!user) redirect("/sign-in?redirect_url=/world");

  const profile = await getCompleteProfile(user.id);
  const birth = profile ? birthFromProfile(profile) : null;

  if (!birth) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-void px-6 text-center">
        <div className="flex max-w-md flex-col items-center gap-4">
          <h1 className="font-display text-3xl text-bone">The world needs you first</h1>
          <p className="text-sm leading-relaxed text-muted">
            Add your birth date, time to the second and place, and your sky
            appears here.
          </p>
          <Button asChild variant="primary" size="sm">
            <Link href="/onboarding">Enter your coordinates</Link>
          </Button>
        </div>
      </div>
    );
  }

  let instant: Date | null = null;
  try {
    instant = resolveKpBirth(birth).date;
  } catch {
    instant = null;
  }

  if (!instant) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-void px-6 text-center">
        <div className="flex max-w-md flex-col items-center gap-4">
          <h1 className="font-display text-3xl text-bone">The sky cannot be placed</h1>
          <p className="text-sm leading-relaxed text-muted">
            Your birth moment could not be resolved. Check it in settings.
          </p>
          <Button asChild variant="primary" size="sm">
            <Link href="/dashboard/settings">Open settings</Link>
          </Button>
        </div>
      </div>
    );
  }

  const nodeType = birth.nodeType ?? "mean";
  const lines = astrocartography(instant, nodeType);
  const moonLongitude = siderealLongitude("moon", instant, nodeType);
  const planets = PLANETS.map(({ graha, glyph }) => {
    const longitude = siderealLongitude(graha, instant as Date, nodeType);
    const normalized = ((longitude % 360) + 360) % 360;
    const index = Math.min(26, Math.floor(normalized / (360 / 27)));
    return {
      graha,
      glyph,
      longitude: normalized,
      nakshatra: NAKSHATRAS[index]?.name ?? "—",
    };
  });

  return (
    <div className="fixed inset-0 bg-abyss">
      <WorldCanvas
        fullscreen
        lines={lines.map((line) => ({
          graha: line.graha,
          angle: line.angle,
          segments: line.segments,
        }))}
        nakshatras={NAKSHATRAS.map((nakshatra) => nakshatra.name)}
        planets={planets}
        moonLongitude={moonLongitude}
      />

      {/* HUD */}
      <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-1">
        <p className="font-mono text-[9px] uppercase tracking-[0.32em] text-gold">
          The Cipher · the world
        </p>
        <h1 className="font-display text-2xl leading-tight text-bone">
          {user.displayName ?? user.firstName ?? "Your"} sky
        </h1>
      </div>

      <div className="absolute right-4 top-4">
        <Button asChild variant="secondary" size="sm">
          <Link href="/dashboard">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
            The 2D site
          </Link>
        </Button>
      </div>
    </div>
  );
}
