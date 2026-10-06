import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle, CircleCheck, Sparkles } from "lucide-react";
import { clerkConfigured, getCurrentUser } from "@/lib/auth";
import { getStore, type UpsertBirthProfileInput } from "@/lib/db/store";
import type { Bodygraph as StoredBodygraph, User } from "@/lib/db/schema";
import { computeReading } from "@/lib/cipher/compute-reading";
import type { ShareableBirth } from "@/lib/cipher/share-code";
import { describeIssue, kpBirthSchema } from "@/lib/kp/birth-schema";
import type { VerifiedBirth } from "@/components/cipher/birth-verification";
import { BirthDataForm } from "./birth-data-form";
import { CHANNEL_BY_GATES, type CenterKey } from "@/lib/human-design";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
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

/** Zero-pad a number for a date/time string. */
function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

/**
 * Project a freshly computed reading onto the birth-profile columns.
 *
 * @param userId - The member's id.
 * @param input - The birth input that produced the reading.
 * @param reading - The computed reading.
 * @returns An input for `store.upsertBirthProfile`.
 */
function profileInputFromReading(
  userId: string,
  input: ShareableBirth,
  reading: ReturnType<typeof computeReading>,
): UpsertBirthProfileInput {
  const graph = reading.bodygraph;
  const centerKeys = Object.keys(graph.centers) as CenterKey[];
  const definedCenters = centerKeys.filter((key) => graph.centers[key].defined);
  const openCenters = centerKeys.filter((key) => !graph.centers[key].defined);

  const bodygraph: StoredBodygraph = {
    type: graph.type,
    authority: graph.authority,
    profile: graph.profile,
    definition: graph.definition.label,
    definedCenters,
    openCenters,
    channels: graph.channels.map((channel) => ({
      gates: [channel.gates[0], channel.gates[1]],
      name: channel.name,
      circuit: CHANNEL_BY_GATES.get(channel.key)?.circuit,
    })),
    gates: graph.activations.map((activation) => ({
      gate: activation.gate,
      line: activation.line,
      color: activation.color,
      tone: activation.tone,
      base: activation.base,
      side: activation.source,
      planet: activation.body,
    })),
    variables: {
      determination: graph.variables.determination?.name,
      environment: graph.variables.environment?.name,
      motivation: graph.variables.motivation?.name,
      perspective: graph.variables.perspective?.name,
    },
  };

  return {
    userId,
    birthDate: `${input.year}-${pad(input.month)}-${pad(input.day)}`,
    birthTime: `${pad(input.hour)}:${pad(input.minute)}:${pad(input.second ?? 0)}`,
    birthTimeZone: input.timeZone,
    birthLatitude: input.latitude,
    birthLongitude: input.longitude,
    birthPlaceName: input.placeName ?? null,
    // JSON round-trip: the snapshot is stored as plain data.
    kpChart: JSON.parse(JSON.stringify(reading.kp)) as Record<string, unknown>,
    bodygraph,
    auraSeat: reading.avatar?.seat ?? "",
    auraFormat: reading.avatar?.format ?? "",
    auraLabel: reading.avatar?.label ?? "",
    strengths: reading.category.strengths,
    weaknesses: reading.category.growthEdges,
  };
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
          <form action={updateProfile} className="flex flex-col gap-5">
            <Field label="Display name" description="Shown on your posts and messages.">
              <Input
                name="displayName"
                defaultValue={user.displayName ?? [user.firstName, user.lastName].filter(Boolean).join(" ")}
                maxLength={80}
                autoComplete="name"
              />
            </Field>
            <Field label="Pronouns" description="Optional. Shown beside your name if set.">
              <Input name="pronouns" defaultValue={user.pronouns ?? ""} maxLength={40} />
            </Field>
            <Field
              label="Image URL"
              description="A square image works best. Leave blank to use your initials."
            >
              <Input
                name="imageUrl"
                defaultValue={user.imageUrl ?? ""}
                inputMode="url"
                placeholder="https://…"
              />
            </Field>
            <div>
              <Button type="submit" variant="primary" size="sm">
                Save profile
              </Button>
            </div>
          </form>
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
          <div className="surface flex flex-wrap items-center justify-between gap-4 rounded-lg border-danger/30 p-5">
            <div>
              <p className="font-display text-lg text-bone">Cancel membership</p>
              <p className="mt-1 text-sm text-muted">
                You keep access until the current period ends. No further charges
                are made.
              </p>
            </div>
            <Button asChild variant="danger" size="sm">
              <Link href="/membership/cancel">Cancel membership</Link>
            </Button>
          </div>
        </Section>
      </div>
    </PageShell>
  );
}
