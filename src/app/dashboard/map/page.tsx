import Link from "next/link";
import type { Metadata } from "next";
import { Globe2 } from "lucide-react";
import { clerkConfigured, getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { getCompleteProfile } from "@/lib/cipher/profile-snapshot";
import type { BirthProfile, User } from "@/lib/db/schema";
import { astrocartography } from "@/lib/astrocartography/lines";
import { encodeBirthInput, type ShareableBirth } from "@/lib/cipher/share-code";
import { resolveKpBirth, type KpBirthInput } from "@/lib/kp/chart";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell } from "@/components/chrome/page-shell";
import { AstroMap } from "@/components/cipher/astro-map";

/**
 * The member's cosmic map: their astrocartography lines, the KP chart
 * relocated to any place they click, and the places they have saved with
 * their own notes.
 */

export const metadata: Metadata = {
  title: "Cosmic Map",
  robots: { index: false, follow: false },
};

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
  const stored = (profile.kpChart as {
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

export default async function MapPage() {
  const user = await currentMember();
  if (!user) return null;
  const store = getStore();
  const [profile, saved] = await Promise.all([
    getCompleteProfile(user.id),
    store.listSavedLocations(user.id),
  ]);
  const birth = profile ? birthFromProfile(profile) : null;

  let content: React.ReactNode;
  if (!birth) {
    content = (
      <EmptyState
        icon={<Globe2 className="h-5 w-5" />}
        title="Your map needs a verified birth moment"
        description="Add your birth date, time to the second and place, and the planetary lines appear here."
        action={
          <Button asChild variant="primary" size="md">
            <Link href="/onboarding">Enter your coordinates</Link>
          </Button>
        }
      />
    );
  } else {
    // Compute first, render after: errors in the computation become a message.
    let instant: Date | null = null;
    let problem: string | null = null;
    try {
      instant = resolveKpBirth(birth).date;
    } catch (error) {
      problem = error instanceof Error ? error.message : "Your birth moment could not be resolved.";
    }
    content = instant ? (
      <AstroMap
        lines={astrocartography(instant, birth.nodeType)}
        code={encodeBirthInput(birth)}
        birthPlace={{ name: birth.placeName ?? "Birthplace", latitude: birth.latitude, longitude: birth.longitude }}
        initialSaved={saved.map((place) => ({
          id: place.id,
          name: place.name,
          latitude: place.latitude,
          longitude: place.longitude,
          note: place.note,
        }))}
      />
    ) : (
      <p role="alert" className="text-sm text-danger">
        {problem}
      </p>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Cosmic Map"
        title="Where your grahas meet the Earth"
        description="Astrocartography lines for your birth instant. Click any place to read your KP chart relocated there, then save it with your own insight."
      />
      {content}
    </PageShell>
  );
}
