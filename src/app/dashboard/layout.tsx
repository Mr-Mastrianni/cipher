import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { clerkConfigured, getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import type { User } from "@/lib/db/schema";
import type { AuraAvatar } from "@/lib/cipher/aura-avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/chrome/page-shell";
import {
  DashboardShell,
  type ChromeUser,
} from "./_components/dashboard-shell";

/**
 * The members-only dashboard frame.
 *
 * This is a Server Component: it resolves the member from the session, refuses
 * to render the shell to anyone who has not finished onboarding, and shows a
 * membership-pending shell to applicants. Everything interactive is delegated
 * to `DashboardShell`, which receives a serialisable summary only.
 *
 * When Clerk is not configured there is no session to read, so the layout falls
 * back to the seeded demo member. That is what makes the deployed demo (and a
 * fresh clone with no env vars) fully explorable — and the demo banner in the
 * shell states plainly that the data is not durable.
 */

/** The Clerk id of the member the MemoryStore seeds for no-secret demos. */
const DEMO_MEMBER_CLERK_ID = "user_demo_member";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

/**
 * Member pages are never statically cached.
 *
 * Without this, a build with no Clerk key would prerender the seeded demo
 * member's dashboard into static HTML; a later deployment with a session would
 * then serve that HTML to everyone. Forcing request-time rendering makes the
 * session re-check on every visit.
 */
export const dynamic = "force-dynamic";

/**
 * Resolve the member for this request.
 *
 * @returns The user plus whether they came from the demo fallback.
 */
async function resolveDashboardUser(): Promise<{ user: User | null; demo: boolean }> {
  const signedIn = await getCurrentUser();
  if (signedIn) return { user: signedIn, demo: false };
  if (clerkConfigured) return { user: null, demo: false };

  // No Clerk: the app is running as a demo, so show the seeded member rather
  // than bouncing every visitor to a sign-in page that cannot work.
  const store = getStore();
  const demoUser = await store.getUserByClerkId(DEMO_MEMBER_CLERK_ID);
  return { user: demoUser, demo: true };
}

/** The member's display name, with a safe fallback. */
function displayName(user: User): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return user.displayName ?? (full || "Member");
}

/**
 * Rebuild the presentational Aura Avatar for the chrome chip.
 *
 * The stored profile keeps the three fields the chip renders (`auraSeat`,
 * `auraFormat`, `auraLabel`); the remaining fields of the richer avatar type
 * are not read by the chip, so they are defaulted rather than fabricated into
 * the UI. When the seat and format were never stored, no chip is rendered.
 *
 * @param profile - The member's birth profile, or `null`.
 * @returns A chip-ready avatar, or `null`.
 */
function chipAvatar(profile: {
  auraSeat: string;
  auraFormat: string;
  auraLabel: string;
} | null): AuraAvatar | null {
  if (!profile || !profile.auraSeat || !profile.auraFormat) return null;
  return {
    seat: profile.auraSeat,
    format: profile.auraFormat,
    label: profile.auraLabel || `The ${profile.auraSeat} ${profile.auraFormat}`,
    seatGate: 0,
    seatCentre: "throat",
    seatCentreName: "Throat",
    seatCentreOpen: false,
    formatLine: 0,
    formatNote: "",
    formatCount: 0,
    coordinate: "",
    contested: false,
  };
}

/**
 * The shell shown to a signed-in applicant whose membership is not approved.
 *
 * It names the application state honestly — pending, denied, or never filed —
 * and gives one route forward.
 *
 * @param props.user - The applicant.
 * @param props.demo - Whether this is the demo fallback member.
 */
async function MembershipPendingShell({
  user,
  demo,
}: {
  user: User;
  demo: boolean;
}) {
  const store = getStore();
  const application = await store.getApplicationByUser(user.id);
  const status = application?.status ?? (user.membershipStatus === "denied" ? "denied" : "none");

  const copy: Record<string, { title: string; body: string; tone: "warn" | "danger" | "info" }> = {
    pending: {
      title: "Your application is with us",
      body: "A human reads every application. You will get a notification the moment a decision is made, and the reading you already generated stays yours either way.",
      tone: "warn",
    },
    denied: {
      title: "This application was not taken forward",
      body: "That is a no on this cohort, not a verdict on your chart. You can read your chart, and you can apply again when your circumstances change.",
      tone: "danger",
    },
    none: {
      title: "Membership is not active",
      body: "The dashboard opens once your application is approved. Apply and you will be placed in a cohort, an archetype and a lane from your own chart.",
      tone: "info",
    },
  };
  const active = copy[status] ?? copy.none;

  return (
    <PageShell width="md">
      <PageHeader
        eyebrow="The Cipher"
        title="Membership"
        description={`Signed in as ${displayName(user)}.`}
        actions={
          <Badge tone={active.tone} size="sm">
            {status === "none" ? "No application" : status}
          </Badge>
        }
      />

      {demo ? (
        <p
          role="status"
          className="rounded-md border border-warn/30 bg-warn/10 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-warn"
        >
          Demo mode — data is not durable.
        </p>
      ) : null}

      <section className="surface rounded-lg p-6">
        <h2 className="font-display text-2xl text-bone">{active.title}</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{active.body}</p>
        {application?.decisionNote && status === "denied" ? (
          <p className="mt-4 rounded-md border border-hairline bg-raised p-3 text-sm text-bone">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
              Note from the reviewer
            </span>
            <br />
            {application.decisionNote}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="primary" size="md">
            <Link href="/membership/apply">
              {status === "none" ? "Apply for membership" : "Review your application"}
            </Link>
          </Button>
          <Button asChild variant="secondary" size="md">
            <Link href="/dashboard/chart">Read your chart</Link>
          </Button>
        </div>
      </section>
    </PageShell>
  );
}

/**
 * The dashboard layout.
 *
 * @param props.children - The routed page.
 * @returns The members-only shell.
 */
export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const { user, demo } = await resolveDashboardUser();

  if (!user) redirect("/sign-in");
  if (!user.onboardingCompletedAt) redirect("/onboarding");

  const isAdmin = user.role === "admin";
  if (user.membershipStatus !== "approved" && !isAdmin) {
    return <MembershipPendingShell user={user} demo={demo} />;
  }

  const store = getStore();
  const [profile, notifications] = await Promise.all([
    store.getBirthProfileByUser(user.id),
    store.listNotifications(user.id, 50),
  ]);
  const unread = notifications.filter((row) => row.readAt === null).length;

  const chromeUser: ChromeUser = {
    id: user.id,
    name: displayName(user),
    imageUrl: user.imageUrl ?? null,
    tier: user.tier,
    role: user.role,
    avatar: chipAvatar(profile),
  };

  return (
    <DashboardShell
      user={chromeUser}
      clerkEnabled={clerkConfigured}
      demoMode={demo || !process.env.DATABASE_URL}
      initialUnread={unread}
    >
      {children}
    </DashboardShell>
  );
}
