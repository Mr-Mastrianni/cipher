import Link from "next/link";
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
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell } from "@/components/chrome/page-shell";
import { WorldCanvas } from "@/components/world/world-canvas";

/**
 * The 3D world — Phase 1.
 *
 * The same astrocartography the flat map draws, rendered on a globe with the
 * nakshatra belt around it. The information is identical to `/dashboard/map`
 * by design: the 3D surface is an enhancement, never the only place a fact
 * exists.
 */

export const metadata: Metadata = {
  title: "The World",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DEMO_MEMBER_CLERK_ID = "user_demo_member";

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

/** Display order and glyphs for the nine grahas. */
const PLANETS: ReadonlyArray<{ graha: Graha; glyph: string }> = [
  { graha: "sun", glyph: "☉" },
  { graha: "moon", glyph: "☽" },
  { graha: "mars", glyph: "♂" },
  { graha: "mercury", glyph: "☿" },
  { graha: "jupiter", glyph: "♃" },
  { graha: "venus", glyph: "♀" },
  { graha: "saturn", glyph: "♄" },
  { graha: "rahu", glyph: "☊" },
  { graha: "ketu", glyph: "☋" },
];

export default async function WorldPage() {
  const user = await currentMember();
  if (!user) return null;

  const profile = await getCompleteProfile(user.id);
  const birth = profile ? birthFromProfile(profile) : null;

  const header = (
    <PageHeader
      eyebrow="The world"
      title="Your sky, in three dimensions"
      description="The same astrocartography as the flat map, on a globe, with the 27 nakshatras on the belt around it. Drag to rotate, scroll to zoom."
      actions={
        <Button asChild variant="secondary" size="sm">
          <Link href="/dashboard/map">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
            Back to the flat map
          </Link>
        </Button>
      }
    />
  );

  if (!birth) {
    return (
      <PageShell width="wide">
        {header}
        <EmptyState
          title="The world needs a verified birth moment"
          description="Add your birth date, time to the second and place, and the planetary lines appear on the globe."
          action={
            <Button asChild variant="primary" size="md">
              <Link href="/onboarding">Enter your coordinates</Link>
            </Button>
          }
        />
      </PageShell>
    );
  }

  let instant: Date | null = null;
  let problem: string | null = null;
  try {
    instant = resolveKpBirth(birth).date;
  } catch (error) {
    problem =
      error instanceof Error
        ? error.message
        : "Your birth moment could not be resolved.";
  }

  if (!instant) {
    return (
      <PageShell width="wide">
        {header}
        <EmptyState
          title="This chart cannot be placed on the globe"
          description={problem ?? "The birth moment could not be resolved."}
        />
      </PageShell>
    );
  }

  const nodeType = birth.nodeType ?? "mean";
  const lines = astrocartography(instant, nodeType);
  const moonLongitude = siderealLongitude("moon", instant, nodeType);

  // The nine grahas on the belt, by their sidereal longitude at birth.
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
    <PageShell width="wide">
      {header}

      <WorldCanvas
        lines={lines.map((line) => ({
          graha: line.graha,
          angle: line.angle,
          segments: line.segments,
        }))}
        nakshatras={NAKSHATRAS.map((nakshatra) => nakshatra.name)}
        planets={planets}
        moonLongitude={moonLongitude}
      />

      <p className="text-xs leading-relaxed text-faint">
        Lines are where each graha is angular at your birth instant: solid for
        the 10th-cusp (MC) line, faint for the rest. The belt is the sidereal
        zodiac divided into the 27 nakshatras, lit at the one holding the Moon.
        The nine grahas sit on that belt by their sidereal longitude; select one
        to swing it to the front. Geometric altitude, no refraction — the same
        convention as the flat map.
      </p>
    </PageShell>
  );
}
