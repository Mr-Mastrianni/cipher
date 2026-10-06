import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarClock,
  Compass,
  Globe2,
  HeartHandshake,
  Hourglass,
  Layers,
  MessagesSquare,
  Repeat,
  Sparkles,
  Timer,
} from "lucide-react";
import { clerkConfigured, getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { getCompleteProfile } from "@/lib/cipher/profile-snapshot";
import type { BirthProfile, User } from "@/lib/db/schema";
import type { Bodygraph as StoredBodygraph } from "@/lib/db/schema";
import { COURSES } from "@/content";
import { COLLECTIVE_ROOMS } from "@/lib/community/rooms";
import { memberTiming } from "@/lib/kp/periods";
import { findMatches } from "@/lib/matching/find";
import { tierRank } from "@/lib/payments/stripe";
import { COURSE_INTERESTS } from "@/lib/recommendations/catalog";
import { recommend, type RecommendationKind } from "@/lib/recommendations/recommend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { PageHeader, PageShell } from "@/components/chrome/page-shell";
import { Section } from "@/components/chrome/section";
import { Bodygraph, type BodygraphVisualization } from "@/components/cipher/bodygraph";
import { AuraAvatarChip } from "@/components/cipher/aura-avatar-card";
import type { AuraAvatar } from "@/lib/cipher/aura-avatar";
import { timeAgo } from "@/lib/utils";
import { Countdown, RsvpButton } from "./_components/dashboard-shell";

/**
 * The dashboard overview.
 *
 * One server render gathers everything the member needs on arrival: who they
 * are, the state of their chart, the next live call, what is waiting in the
 * community and in DMs, course progress, and the flashcard queue. Every block
 * degrades to an `EmptyState` with a route forward, so a member who has just
 * finished onboarding sees an actionable page rather than an empty one.
 */

export const metadata: Metadata = {
  title: "Overview",
  robots: { index: false, follow: false },
};

const DEMO_MEMBER_CLERK_ID = "user_demo_member";

/**
 * Resolve the member, falling back to the seeded demo member without Clerk.
 *
 * @returns The member, or `null` when Clerk is configured and nobody is signed
 *   in (the layout will already have redirected in that case).
 */
async function currentMember(): Promise<User | null> {
  const signedIn = await getCurrentUser();
  if (signedIn) return signedIn;
  if (clerkConfigured) return null;
  return getStore().getUserByClerkId(DEMO_MEMBER_CLERK_ID);
}

/** The member's display name. */
function displayName(user: User): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return user.displayName ?? (full || "Member");
}

/**
 * Adapt the stored bodygraph projection to the SVG visualiser's input.
 *
 * The database keeps a flat projection (gates with a side, channels with two
 * gates); the renderer wants nodes, edges and the defined-centre list. This is
 * the cheap read used on the overview — the chart page recomputes the full
 * engine graph instead.
 *
 * @param graph - The projected bodygraph.
 * @returns Nodes, edges and defined centres.
 */
function visualizationFromStored(graph: StoredBodygraph): BodygraphVisualization {
  const nodes = graph.gates.map((gate) => ({
    gate: gate.gate,
    line: gate.line,
    source: gate.side,
  }));

  const edges = graph.channels.map((channel) => {
    const [a, b] = channel.gates;
    const sides = new Set(
      graph.gates
        .filter((gate) => gate.gate === a || gate.gate === b)
        .map((gate) => gate.side),
    );
    const source: "personality" | "design" | "both" =
      sides.size > 1 ? "both" : (sides.values().next().value ?? "personality");
    return { gates: channel.gates, source };
  });

  return { nodes, edges, definedCenters: graph.definedCenters };
}

/**
 * Rebuild the chip-ready avatar from the persisted profile fields.
 *
 * @param profile - The member's birth profile.
 * @returns A chip-ready avatar, or `null` when none was stored.
 */
function chipAvatar(profile: BirthProfile | null): AuraAvatar | null {
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

/** A time-of-day greeting, computed on the server. */
function greeting(): string {
  const hour = new Date().getUTCHours();
  if (hour < 5) return "Still awake";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The overview page.
 *
 * @returns The member's dashboard home.
 */
const RECOMMENDATION_ICON: Record<RecommendationKind, typeof Sparkles> = {
  setup: Compass,
  timing: Hourglass,
  event: CalendarClock,
  course: BookOpen,
  community: MessagesSquare,
  match: HeartHandshake,
  map: Globe2,
  practice: Repeat,
};

const RECOMMENDATION_LABEL: Record<RecommendationKind, string> = {
  setup: "Begin",
  timing: "KP timing",
  event: "Event",
  course: "Study",
  community: "Collective",
  match: "Matching",
  map: "Cosmic map",
  practice: "Practice",
};

export default async function DashboardOverviewPage() {
  const user = await currentMember();
  if (!user) return null;

  const store = getStore();
  const [profile, channels, progressRows, decks, dueCards, upcoming] =
    await Promise.all([
      getCompleteProfile(user.id),
      store.listChannels(),
      store.getLessonProgressForUser(user.id),
      store.listFlashcardDecks(),
      store.getDueFlashcards(user.id, undefined, 500),
      store.listUpcomingCalls(1),
    ]);

  const name = displayName(user);
  const avatar = chipAvatar(profile);
  const graph = profile?.bodygraph ?? null;

  /* ── Live call ─────────────────────────────────────────────────────────── */

  const nextCall = upcoming[0] ?? null;
  const rsvps = nextCall ? await store.listRsvps(nextCall.id) : [];
  const myRsvp = rsvps.find((rsvp) => rsvp.userId === user.id) ?? null;
  const goingCount = rsvps.filter((rsvp) => rsvp.status === "going").length;

  /* ── Community + DMs ───────────────────────────────────────────────────── */

  const since = user.lastSeenAt ? user.lastSeenAt.getTime() : 0;
  const authorCache = new Map<string, string>();

  const recent: {
    id: string;
    body: string;
    createdAt: Date;
    channelName: string;
    channelSlug: string;
    author: string;
    unread: boolean;
  }[] = [];

  for (const channel of channels) {
    const page = await store.listMessages(channel.id, { limit: 6 });
    for (const message of page.items) {
      if (message.deletedAt) continue;
      if (!authorCache.has(message.authorId)) {
        const author = await store.getUserById(message.authorId);
        authorCache.set(
          message.authorId,
          author?.displayName ??
            ([author?.firstName, author?.lastName].filter(Boolean).join(" ") ||
              "Member"),
        );
      }
      recent.push({
        id: message.id,
        body: message.body,
        createdAt: message.createdAt,
        channelName: channel.name,
        channelSlug: channel.slug,
        author: authorCache.get(message.authorId) ?? "Member",
        unread: message.authorId !== user.id && message.createdAt.getTime() > since,
      });
    }
  }
  recent.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const activity = recent.slice(0, 6);
  const unread = recent.filter((item) => item.unread);

  /* ── Course progress ───────────────────────────────────────────────────── */

  const completedKeys = new Set(
    progressRows.filter((row) => row.status === "complete").map((row) => row.lessonId),
  );
  const courseProgress: {
    slug: string;
    title: string;
    tier: string;
    total: number;
    done: number;
    percent: number;
  }[] = [];
  for (const course of COURSES) {
    // The same persistence-key derivation the progress API uses: the store
    // lesson id when the course was seeded into the database, otherwise a
    // deterministic content key.
    const storeCourse = await store.getCourseWithLessons(course.slug);
    const storeIdBySlug = new Map(
      (storeCourse?.lessons ?? []).map((lesson) => [lesson.slug, lesson.id]),
    );
    const lessons = course.modules.flatMap((module) => module.lessons);
    const done = lessons.filter((lesson) =>
      completedKeys.has(storeIdBySlug.get(lesson.slug) ?? `content:${course.slug}:${lesson.slug}`),
    ).length;
    courseProgress.push({
      slug: course.slug,
      title: course.title,
      tier: course.tier,
      total: lessons.length,
      done,
      percent: lessons.length === 0 ? 0 : Math.round((done / lessons.length) * 100),
    });
  }
  const nextCourse = courseProgress.find((course) => course.percent < 100) ?? null;

  /* ── Flashcards ────────────────────────────────────────────────────────── */

  const dueToday = dueCards.length;

  /* ── For you ───────────────────────────────────────────────────────────── */

  const now = new Date();
  const rankOf = (tier: string | null | undefined) =>
    tierRank((tier ?? "initiate") as Parameters<typeof tierRank>[0]);
  const memberRank = user.role === "admin" ? 3 : user.membershipStatus === "approved" ? tierRank(user.tier) : 0;
  const [events, savedPlaces, topMatches] = await Promise.all([
    store.listUpcomingCalls(10),
    store.listSavedLocations(user.id),
    // Matching is for approved members (the API enforces the same rule).
    profile && user.matchingOptIn && (user.membershipStatus === "approved" || user.role === "admin")
      ? findMatches(store, user, profile, 1, now).catch(() => [])
      : Promise.resolve([]),
  ]);
  const recommendations = recommend({
    now,
    tierRank: memberRank,
    hasBirthProfile: Boolean(profile),
    interests: user.interests ?? [],
    hdType: profile?.bodygraph?.type ?? null,
    timing: profile ? memberTiming(profile, now) : null,
    courses: courseProgress.map((course) => ({
      slug: course.slug,
      title: course.title,
      tierRank: rankOf(course.tier),
      percent: course.percent,
      interests: COURSE_INTERESTS[course.slug] ?? [],
    })),
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      // Live calls are a paid feature; a call can raise the floor further.
      tierRank: rankOf(event.tierRequired ?? "initiate"),
    })),
    channels: COLLECTIVE_ROOMS.map((room) => ({
      slug: room.slug,
      name: room.name,
      interests: room.interests,
      tierRank: room.tierRequired ? rankOf(room.tierRequired) : 0,
    })),
    matchingOptIn: user.matchingOptIn,
    topMatch: topMatches[0] ? { name: topMatches[0].member.name, score: topMatches[0].score } : null,
    savedPlaces: savedPlaces.length,
    dueFlashcards: dueToday,
  });

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="The Cipher"
        title={`${greeting()}, ${name}`}
        description={
          profile?.bodygraph
            ? `Your chart reads ${profile.bodygraph.type}, ${profile.bodygraph.profile}, ${profile.bodygraph.authority} authority.`
            : "Your chart is not stored yet. Generate it once and the whole dashboard fills in."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {avatar ? <AuraAvatarChip avatar={avatar} /> : null}
            {profile?.bodygraph ? (
              <Badge tone="purple" size="sm">
                {profile.bodygraph.type}
              </Badge>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-col gap-12">
        {/* For you ---------------------------------------------------------- */}
        {recommendations.length > 0 ? (
          <Section eyebrow="For you" title="What your chart and the Collective suggest now">
            <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
              {recommendations.map((item) => {
                const Icon = RECOMMENDATION_ICON[item.kind];
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="surface group flex h-full flex-col gap-3 rounded-lg p-5 transition-colors hover:border-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                    >
                      <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-gold">
                        <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
                        {RECOMMENDATION_LABEL[item.kind]}
                      </span>
                      <span className="font-display text-lg leading-snug text-bone">{item.title}</span>
                      <span className="text-sm leading-relaxed text-muted">{item.body}</span>
                      <span className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-faint">
                        <span>Why: {item.reason}</span>
                        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Section>
        ) : null}

        {/* Chart at a glance ------------------------------------------------ */}
        <Section
          eyebrow="At a glance"
          title="Your bodygraph"
          description="Definition lights up centre by centre. Open centres are where you take in the room, not where you are broken."
          actions={
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/chart">
                Open the full reading
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
          }
        >
          {graph ? (
            <div className="surface grid gap-6 rounded-lg p-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <Bodygraph data={visualizationFromStored(graph)} showGates={false} />
              <dl className="flex flex-col gap-3 self-center">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
                    Type
                  </dt>
                  <dd className="font-display text-xl text-bone">{graph.type}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
                    Authority
                  </dt>
                  <dd className="font-display text-xl text-bone">{graph.authority}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
                    Profile
                  </dt>
                  <dd className="font-display text-xl text-bone">{graph.profile}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">
                    Definition
                  </dt>
                  <dd className="text-sm text-muted">{graph.definition}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <EmptyState
              icon={<Sparkles className="h-5 w-5" />}
              title="No chart on file"
              description="Add your birth date, time and place once, and your bodygraph, aura avatar and reading appear here."
              action={
                <Button asChild variant="primary" size="sm">
                  <Link href="/onboarding">Complete onboarding</Link>
                </Button>
              }
            />
          )}
        </Section>

        {/* Next call -------------------------------------------------------- */}
        <Section
          eyebrow="Live"
          title="The next call"
          description="Calls are members-only. The join link appears here when you are approved and the room is open."
        >
          {nextCall ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <CardTitle>{nextCall.title}</CardTitle>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                      {nextCall.description ?? "No description yet."}
                    </p>
                  </div>
                  <Badge tone={nextCall.recurring ? "teal" : "gold"} size="sm">
                    {nextCall.recurring ? "Weekly" : "One-off"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <Countdown to={nextCall.startsAt.toISOString()} label={nextCall.title} />
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                    {new Intl.DateTimeFormat("en-GB", {
                      timeZone: user.timezone ?? "UTC",
                      dateStyle: "full",
                      timeStyle: "short",
                    }).format(nextCall.startsAt)}{" "}
                    · {nextCall.durationMinutes} min
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <RsvpButton
                    callId={nextCall.id}
                    initialStatus={myRsvp?.status ?? null}
                    initialGoingCount={goingCount}
                  />
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/dashboard/calls">
                      All calls
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              icon={<Timer className="h-5 w-5" />}
              title="No calls scheduled"
              description="When a circle is on the calendar it appears here with a countdown and a one-tap RSVP."
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/calls">See past calls</Link>
                </Button>
              }
            />
          )}
        </Section>

        {/* Messages --------------------------------------------------------- */}
        <Section
          eyebrow="Waiting for you"
          title={unread.length > 0 ? `${unread.length} unread messages` : "Unread messages"}
          description="Posts from other members since you last opened the dashboard."
          actions={
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/messages">
                Direct messages
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </Button>
          }
        >
          {unread.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {unread.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/dashboard/community/${item.channelSlug}`}
                    className="surface flex items-start gap-3 rounded-lg p-4 transition-colors hover:border-gold/40"
                  >
                    <Bell aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                    <div className="min-w-0">
                      <p className="text-sm text-bone">
                        <span className="text-muted">{item.author}</span> in{" "}
                        <span className="text-gold">{item.channelName}</span>
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{item.body}</p>
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                        {timeAgo(item.createdAt)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<MessagesSquare className="h-5 w-5" />}
              title="Nothing unread"
              description="You are caught up. The community and your conversations will surface here when something arrives."
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/community">Open community</Link>
                </Button>
              }
            />
          )}
        </Section>

        {/* Courses + flashcards --------------------------------------------- */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Section eyebrow="Study" title="Course progress">
            {courseProgress.length > 0 ? (
              <ul className="flex flex-col gap-4">
                {courseProgress.map((course) => (
                  <li key={course.slug} className="surface rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-display text-base text-bone">{course.title}</p>
                      <Badge tone="neutral" size="sm">
                        {course.tier}
                      </Badge>
                    </div>
                    <Progress
                      className="mt-3"
                      value={course.percent}
                      label={`${course.title}: ${course.done} of ${course.total} lessons`}
                      showValue
                    />
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                      {course.done} / {course.total} lessons
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<BookOpen className="h-5 w-5" />}
                title="No courses yet"
                description="The catalogue opens with the first cohort release."
              />
            )}
            {nextCourse ? (
              <Button asChild variant="secondary" size="sm" className="mt-4">
                <Link href={`/dashboard/courses/${nextCourse.slug}`}>
                  Continue {nextCourse.title}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </Section>

          <Section eyebrow="Review" title="Flashcards">
            <Card>
              <CardContent className="flex flex-col gap-4 pt-6">
                <p className="font-display text-4xl text-gold">{dueToday}</p>
                <p className="text-sm text-muted">
                  {dueToday === 1 ? "card is" : "cards are"} due today across{" "}
                  {decks.length} {decks.length === 1 ? "deck" : "decks"}.
                </p>
                <Button asChild variant="primary" size="sm">
                  <Link href="/dashboard/flashcards">
                    Start a session
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </Section>
        </div>

        {/* Recent activity --------------------------------------------------- */}
        <Section
          eyebrow="The room"
          title="Recent community activity"
          description="The last few posts across every channel you can read."
        >
          {activity.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {activity.map((item) => (
                <li
                  key={item.id}
                  className="surface flex flex-col gap-2 rounded-lg p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-bone">
                      <span className="text-muted">{item.author}</span> in{" "}
                      <Link
                        href={`/dashboard/community/${item.channelSlug}`}
                        className="text-gold hover:text-gold-hi"
                      >
                        {item.channelName}
                      </Link>
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{item.body}</p>
                  </div>
                  <p className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                    {timeAgo(item.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Layers className="h-5 w-5" />}
              title="The room is quiet"
              description="No posts yet. Be the first to say something in General."
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/dashboard/community">Open community</Link>
                </Button>
              }
            />
          )}
        </Section>
      </div>
    </PageShell>
  );
}
