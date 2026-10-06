import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, Clock, Download, Repeat, Timer, Users, Video } from "lucide-react";
import { clerkConfigured, getCurrentUser, userHasTier } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import type { LiveCall, User } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell } from "@/components/chrome/page-shell";
import { Section } from "@/components/chrome/section";
import { RsvpButton } from "../_components/dashboard-shell";

/**
 * Live calls.
 *
 * Upcoming and past sessions, each with the start time rendered in the member's
 * own timezone, the host, the duration and an RSVP toggle. The join link is
 * rendered only for approved members — applicants never reach this shell, and
 * the check is repeated here so the rule survives a future routing change. The
 * `.ics` download is a plain link to the hand-rolled calendar route, which
 * enforces membership server-side.
 */

export const metadata: Metadata = {
  title: "Calls",
  robots: { index: false, follow: false },
};

const DEMO_MEMBER_CLERK_ID = "user_demo_member";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

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

/** Format an instant in the member's timezone. */
function formatInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

/**
 * The calls page.
 *
 * @returns Upcoming and past calls with RSVP controls.
 */
export default async function CallsPage() {
  const user = await currentMember();
  if (!user) return null;

  const store = getStore();
  const [upcoming, past] = await Promise.all([
    store.listUpcomingCalls(20),
    store.listPastCalls(8),
  ]);

  const isApproved = user.membershipStatus === "approved" || user.role === "admin";
  const timezone = user.timezone ?? "UTC";

  /** Enrich one call with its host and the member's RSVP. */
  const detail = async (call: LiveCall) => {
    const [host, rsvps] = await Promise.all([
      call.hostId ? store.getUserById(call.hostId) : Promise.resolve(null),
      store.listRsvps(call.id),
    ]);
    return {
      call,
      hostName:
        host?.displayName ??
        ([host?.firstName, host?.lastName].filter(Boolean).join(" ") || "The Cipher"),
      going: rsvps.filter((rsvp) => rsvp.status === "going").length,
      mine: rsvps.find((rsvp) => rsvp.userId === user.id)?.status ?? null,
      // Live calls are a paid feature; a call can raise the floor further.
      canJoin: isApproved && userHasTier(user, call.tierRequired ?? "initiate"),
    };
  };

  const upcomingDetails = await Promise.all(upcoming.map(detail));
  const pastDetails = await Promise.all(past.map(detail));
  const recurring = upcomingDetails.find((entry) => entry.call.recurring) ?? null;

  return (
    <PageShell width="lg">
      <PageHeader
        eyebrow="Live"
        title="Calls and circles"
        description="Everything is scheduled in the room's timezone and shown in yours. RSVP so the host knows who is coming."
        actions={
          <Badge tone="info" size="sm">
            Your timezone: {timezone}
          </Badge>
        }
      />

      <div className="flex flex-col gap-12">
        {recurring ? (
          <Section
            eyebrow="Every week"
            title="The recurring circle"
            description="A standing slot, same day, same time. Missing one is allowed; the room runs whether or not you are there."
          >
            <Card className="border-gold/30">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <CardTitle>{recurring.call.title}</CardTitle>
                  <Badge tone="teal" size="sm">
                    <Repeat aria-hidden="true" className="mr-1 h-3 w-3" />
                    Weekly
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm leading-relaxed text-muted">
                  {recurring.call.description ?? "No description yet."}
                </p>
                <dl className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                      Cadence
                    </dt>
                    <dd className="text-sm text-bone">
                      {recurring.call.recurrenceDay !== null
                        ? `Every ${DAY_NAMES[recurring.call.recurrenceDay] ?? "week"}`
                        : "Weekly"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                      Room clock
                    </dt>
                    <dd className="text-sm text-bone">
                      {recurring.call.recurrenceTime ?? "—"}
                      {recurring.call.recurrenceTz
                        ? ` (${recurring.call.recurrenceTz})`
                        : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                      Next in your time
                    </dt>
                    <dd className="text-sm text-bone">
                      {formatInZone(recurring.call.startsAt, timezone)}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </Section>
        ) : null}

        <Section
          eyebrow="Upcoming"
          title="What is next"
          description="RSVP to hold your place. The join link appears here when you are approved."
        >
          {upcomingDetails.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-5 w-5" />}
              title="Nothing on the calendar"
              description="The next circle will appear here as soon as it is scheduled."
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {upcomingDetails.map(({ call, hostName, going, mine, canJoin }) => (
                <li key={call.id}>
                  <Card>
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle>{call.title}</CardTitle>
                          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                            {call.description ?? "No description yet."}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {call.recurring ? (
                            <Badge tone="teal" size="sm">
                              Weekly
                            </Badge>
                          ) : (
                            <Badge tone="gold" size="sm">
                              One-off
                            </Badge>
                          )}
                          {call.tierRequired ? (
                            <Badge tone="neutral" size="sm">
                              {call.tierRequired}+
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-3">
                      <p className="flex items-center gap-2 text-sm text-muted">
                        <Clock aria-hidden="true" className="h-4 w-4 text-gold" />
                        {formatInZone(call.startsAt, timezone)}
                      </p>
                      <p className="flex items-center gap-2 text-sm text-muted">
                        <Timer aria-hidden="true" className="h-4 w-4 text-gold" />
                        {call.durationMinutes} minutes
                      </p>
                      <p className="flex items-center gap-2 text-sm text-muted">
                        <Users aria-hidden="true" className="h-4 w-4 text-gold" />
                        Hosted by {hostName}
                      </p>
                    </CardContent>
                    <CardFooter className="flex flex-wrap items-center justify-between gap-3">
                      <RsvpButton callId={call.id} initialStatus={mine} initialGoingCount={going} />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button asChild variant="secondary" size="sm">
                          <a href={`/api/calls/${call.id}/ics`} download>
                            <Download aria-hidden="true" className="h-4 w-4" />
                            Add to calendar
                          </a>
                        </Button>
                        {canJoin && call.roomUrl ? (
                          <Button asChild variant="primary" size="sm">
                            <a href={call.roomUrl} target="_blank" rel="noreferrer noopener">
                              <Video aria-hidden="true" className="h-4 w-4" />
                              Join the room
                            </a>
                          </Button>
                        ) : (
                          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                            {canJoin
                              ? "The room opens 10 minutes before"
                              : isApproved
                                ? `Join link unlocks at ${call.tierRequired ?? "initiate"}`
                                : "Join link unlocks on approval"}
                          </span>
                        )}
                      </div>
                    </CardFooter>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          eyebrow="Archive"
          title="Past calls"
          description="Recordings and notes from previous sessions."
        >
          {pastDetails.length === 0 ? (
            <EmptyState
              icon={<Video className="h-5 w-5" />}
              title="No past calls yet"
              description="Once a call ends it moves here with its recording, when there is one."
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {pastDetails.map(({ call, hostName, mine, canJoin }) => (
                <li key={call.id}>
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="text-base">{call.title}</CardTitle>
                      <p className="mt-2 text-xs text-muted">
                        {formatInZone(call.startsAt, timezone)} · {call.durationMinutes} min ·
                        {" "}
                        {hostName}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed text-muted">
                        {call.description ?? "No notes were kept for this session."}
                      </p>
                    </CardContent>
                    <CardFooter className="flex flex-wrap items-center gap-3">
                      <Badge tone={mine === "going" ? "ok" : "neutral"} size="sm">
                        {mine === "going" ? "You attended" : "You did not RSVP"}
                      </Badge>
                      {canJoin && call.recordingUrl ? (
                        <Button asChild variant="secondary" size="sm">
                          <a href={call.recordingUrl} target="_blank" rel="noreferrer noopener">
                            Watch the recording
                          </a>
                        </Button>
                      ) : null}
                    </CardFooter>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <p className="text-xs text-faint">
          Looking for a course instead?{" "}
          <Link href="/dashboard/courses" className="text-gold hover:text-gold-hi">
            Browse the catalogue
          </Link>
          .
        </p>
      </div>
    </PageShell>
  );
}
