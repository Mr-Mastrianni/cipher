import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle, CircleCheck, Sparkles } from "lucide-react";
import { clerkConfigured, getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { getMemberAvatar } from "@/lib/world/avatar";
import { AVATAR_FORMS } from "@/world/content/world";
import type { User } from "@/lib/db/schema";
import { computeReading } from "@/lib/cipher/compute-reading";
import type { ShareableBirth } from "@/lib/cipher/share-code";
import { describeIssue, kpBirthSchema } from "@/lib/kp/birth-schema";
import type { VerifiedBirth } from "@/components/cipher/birth-verification";
import { BirthDataForm } from "./birth-data-form";
import { ProfileForm } from "./profile-form";
import { CancelMembership } from "./cancel-membership";
import { profileInputFromReading } from "@/lib/cipher/profile-snapshot";
import { isStripeConfigured } from "@/lib/payments/stripe";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/chrome/page-shell";
import { Section } from "@/components/chrome/section";
import { MemberPreferences } from "../_components/dashboard-shell";

/**
 * Settings.
 *
 * Profile and birth data are written through inline Server Actions, so the
 * forms work without JavaScript and no member id is ever trusted from the
 * client. Changing the birth data re-runs the whole reading — chart, bodygraph,
 * Aura Avatar and categorisation — because every derived field is a pure
 * function of the birth input.
 *
 * Appearance, sound, notification preferences and billing live in the
 * `MemberPreferences` client component, which needs the theme and sound hooks.
 */

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

const DEMO_MEMBER_CLERK_ID = "user_demo_member";

/**
 * Resolve the member, falling back to the seeded demo member without Clerk.
 *
 * @returns The member, or `null`.
 */
async function currentMember(): Promise<User | null> {
  const signedIn = await getCurrentUser();
  if (signedIn) return signedIn;
  if (!clerkConfigured) return getStore().getUserByClerkId(DEMO_MEMBER_CLERK_ID);
  return null;
}

/**
 * The settings page.
 *
 * @param props - Route props carrying `searchParams` for inline status copy.
 * @returns The settings form and preference panels.
 */
export default async function SettingsPage({
  searchParams,
}: PageProps<"/dashboard/settings">) {
  const user = await currentMember();
  if (!user) return null;

  const params = await searchParams;
  const saved = typeof params.saved === "string" ? params.saved : null;
  const failure = typeof params.error === "string" ? params.error : null;

  const store = getStore();
  const profile = await store.getBirthProfileByUser(user.id);
  const avatar = await getMemberAvatar(user.id).catch(() => null);
  const avatarForm = avatar ? AVATAR_FORMS.find((form) => form.id === avatar.form)?.name : null;

  // Format the paid-until date here, in the member's own zone, so the client
  // component never has to guess a timezone (or disagree with the server during
  // hydration).
  const periodEndLabel = user.currentPeriodEnd
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: user.timezone ?? "UTC",
        dateStyle: "long",
      }).format(user.currentPeriodEnd)
    : null;

  /**
   * Persist the profile name and image.
   *
   * @param formData - The submitted profile form.
   */
  async function updateProfile(formData: FormData): Promise<void> {
    "use server";
    const member = await currentMember();
    if (!member) redirect("/sign-in");

    const displayName = String(formData.get("displayName") ?? "").trim();
    const imageUrl = String(formData.get("imageUrl") ?? "").trim();
    const pronouns = String(formData.get("pronouns") ?? "").trim();

    await getStore().updateUser(member.id, {
      displayName: displayName || null,
      imageUrl: imageUrl || null,
      pronouns: pronouns || null,
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    redirect("/dashboard/settings?saved=profile");
  }

  /**
   * Persist new birth data and re-run the reading.
   *
   * @param formData - The submitted birth-data form.
   */
  async function updateBirthData(birth: VerifiedBirth): Promise<void> {
    "use server";
    const member = await currentMember();
    if (!member) redirect("/sign-in");

    // Re-validate on the server: the client's verification is a UX step, the
    // schema is the rule (time to the second, real date, supported range).
    const parsed = kpBirthSchema.safeParse(birth);
    if (!parsed.success) {
      redirect(`/dashboard/settings?error=${encodeURIComponent(describeIssue(parsed.error))}`);
    }
    const input: ShareableBirth = parsed.data;

    try {
      const reading = computeReading(input);
      await getStore().upsertBirthProfile(profileInputFromReading(member.id, input, reading));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The reading could not be recomputed.";
      redirect(`/dashboard/settings?error=${encodeURIComponent(message)}`);
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/chart");
    revalidatePath("/dashboard");
    redirect("/dashboard/settings?saved=birth");
  }

  return (
    <PageShell width="md">
      <PageHeader
        eyebrow="Settings"
        title="Your account"
        description="Profile, birth data, and how the interface behaves for you."
        actions={
          <Badge tone="gold" size="sm">
            {user.tier} · {user.membershipStatus}
          </Badge>
        }
      />

      {saved ? (
        <p className="flex items-center gap-2 rounded-md border border-ok/40 bg-ok/5 px-4 py-3 text-sm text-ok" role="status">
          <CircleCheck aria-hidden="true" className="h-4 w-4" />
          {saved === "birth"
            ? "Birth data saved — your reading has been recomputed."
            : "Profile saved."}
        </p>
      ) : null}
      {failure ? (
        <p className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
          <AlertTriangle aria-hidden="true" className="h-4 w-4" />
          {failure}
        </p>
      ) : null}

      <div className="flex flex-col gap-12">
        <Section eyebrow="Identity" title="Profile">
          <ProfileForm
            save={updateProfile}
            defaults={{
              displayName:
                user.displayName ??
                [user.firstName, user.lastName].filter(Boolean).join(" "),
              pronouns: user.pronouns ?? "",
              imageUrl: user.imageUrl ?? "",
            }}
          />
        </Section>

        <Section
          eyebrow="World"
          title="Your avatar"
          description="The silhouette, colour, crest and name you carry into the Cipher. It is saved to your member profile, not just to the browser that made it."
        >
          <div className="surface flex flex-col gap-4 rounded-lg p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span
                className="grid h-14 w-14 place-items-center rounded-full border-2 text-xl"
                style={{
                  borderColor: avatar?.color ?? "#bfa273",
                  color: avatar?.color ?? "#bfa273",
                }}
                aria-hidden="true"
              >
                {avatar?.crest ?? "\u2726"}
              </span>
              <div>
                <p className="font-display text-lg text-bone">
                  {avatar?.name ?? user.displayName ?? "A traveller"}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                  {avatar ? `${avatarForm ?? "Cloaked"} · ${avatar.color}` : "No avatar saved yet"}
                </p>
              </div>
            </div>
            <Link href="/world" className="text-sm text-gold hover:text-gold-hi">
              Edit in the world
              <span aria-hidden="true"> →</span>
            </Link>
          </div>
        </Section>

        <Section
          eyebrow="Chart"
          title="Birth data"
          description="Saving re-casts the KP chart and re-runs the Human Design bodygraph, Aura Avatar and placement. The birth time is required to the second and the resolved moment must be confirmed before it is saved."
        >
          {profile ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
              Current: {profile.birthDate} {profile.birthTime} · {profile.birthTimeZone}
              {profile.birthPlaceName ? ` · ${profile.birthPlaceName}` : ""}
            </p>
          ) : (
            <p className="flex items-center gap-2 text-sm text-warn">
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              No birth data on file yet.
            </p>
          )}

          <BirthDataForm
            save={updateBirthData}
            defaults={{
              birthDate: profile?.birthDate ?? "",
              birthTime: profile?.birthTime?.slice(0, 8) ?? "",
              birthTimeZone: profile?.birthTimeZone ?? "",
              birthLatitude: profile ? String(profile.birthLatitude) : "",
              birthLongitude: profile ? String(profile.birthLongitude) : "",
              birthPlaceName: profile?.birthPlaceName ?? "",
            }}
          />
        </Section>

        <Section eyebrow="Interface" title="Preferences and billing">
          <MemberPreferences tier={user.tier} membershipStatus={user.membershipStatus} />
        </Section>

        <Section
          eyebrow="Danger zone"
          title="Leaving"
          description="Cancelling ends the membership at the end of the paid period. Your reading stays available."
        >
          <CancelMembership
            billingConfigured={isStripeConfigured()}
            hasBillingAccount={Boolean(user.stripeCustomerId)}
            subscriptionStatus={user.subscriptionStatus}
            periodEndLabel={periodEndLabel}
          />
        </Section>
      </div>
    </PageShell>
  );
}
