/**
 * Personalised recommendations for the dashboard.
 *
 * A pure, deterministic ranking over what the platform already knows about a
 * member: their verified chart (KP timing, Human Design type), the interests
 * they chose, their course progress, their tier, upcoming events, their
 * matching state and their saved places. Every recommendation carries the
 * reason it was made, in plain words, so nothing feels like a black box.
 *
 * Kept free of I/O so it can be unit-tested and later swapped for, or blended
 * with, a learned ranker without touching the dashboard.
 */

import { GRAHA_LABEL, type Graha } from "../kp/constants";

export type RecommendationKind =
  | "setup"
  | "timing"
  | "event"
  | "course"
  | "community"
  | "match"
  | "map"
  | "practice";

export interface Recommendation {
  id: string;
  kind: RecommendationKind;
  title: string;
  body: string;
  href: string;
  /** Why this was recommended. */
  reason: string;
  /** Higher ranks first. */
  priority: number;
}

export interface RecommendationContext {
  now: Date;
  tierRank: number;
  hasBirthProfile: boolean;
  interests: string[];
  hdType: string | null;
  timing: {
    running: Array<{ lord: Graha; start: Date; end: Date }>;
    nextBhukti: { lord: Graha; start: Date; end: Date } | null;
  } | null;
  courses: Array<{ slug: string; title: string; tierRank: number; percent: number; interests: string[] }>;
  events: Array<{ id: string; title: string; startsAt: Date; tierRank: number }>;
  channels: Array<{ slug: string; name: string; interests: string[]; tierRank: number }>;
  matchingOptIn: boolean;
  topMatch: { name: string; score: number } | null;
  savedPlaces: number;
  dueFlashcards: number;
}

const DAY = 86_400_000;

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

const lord = (g: Graha) => GRAHA_LABEL[g].english;

export function recommend(ctx: RecommendationContext, limit = 6): Recommendation[] {
  const out: Recommendation[] = [];

  if (!ctx.hasBirthProfile) {
    out.push({
      id: "setup:birth",
      kind: "setup",
      title: "Verify your birth moment",
      body: "Your KP chart, dashas, map and matches all start from your birth time to the second.",
      href: "/onboarding",
      reason: "No verified birth moment on file yet.",
      priority: 100,
    });
  }

  // KP timing.
  if (ctx.timing && ctx.timing.running.length >= 2) {
    const [maha, bhukti] = ctx.timing.running;
    const next = ctx.timing.nextBhukti;
    const changesSoon = next && next.start.getTime() - ctx.now.getTime() <= 30 * DAY;
    out.push({
      id: `timing:${maha.lord}:${bhukti.lord}`,
      kind: "timing",
      title: changesSoon && next
        ? `Your bhukti changes to ${lord(next.lord)} on ${formatDate(next.start)}`
        : `You are in ${lord(maha.lord)}–${lord(bhukti.lord)}`,
      body: changesSoon && next
        ? `The ${lord(maha.lord)}–${lord(bhukti.lord)} period closes. Look up what ${lord(next.lord)} signifies in your chart before it begins.`
        : `${lord(bhukti.lord)} bhukti runs until ${formatDate(bhukti.end)} within your ${lord(maha.lord)} mahadasha. Read both lords' significations in your KP chart.`,
      href: "/dashboard/chart#kp-dasha",
      reason: "From your Vimshottari dasha.",
      priority: changesSoon ? 90 : 60,
    });
  }

  // Events: the next one open to the member; otherwise say what unlocks it.
  const upcoming = ctx.events
    .filter((event) => event.startsAt.getTime() > ctx.now.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const openEvent = upcoming.find((event) => event.tierRank <= ctx.tierRank);
  if (openEvent) {
    const soon = openEvent.startsAt.getTime() - ctx.now.getTime() <= 3 * DAY;
    out.push({
      id: `event:${openEvent.id}`,
      kind: "event",
      title: openEvent.title,
      body: `Live on ${formatDate(openEvent.startsAt)}. Add it to your calendar and RSVP from Calls.`,
      href: "/dashboard/calls",
      reason: soon ? "Starting within three days." : "The next event open to your tier.",
      priority: soon ? 85 : 50,
    });
  } else if (upcoming[0]) {
    out.push({
      id: `event-locked:${upcoming[0].id}`,
      kind: "event",
      title: `${upcoming[0].title} — opens at Initiate`,
      body: "Live calls and events are part of the paid tiers.",
      href: "/membership",
      reason: "An upcoming event above your tier.",
      priority: 20,
    });
  }

  // Courses: unfinished, open to the tier, ranked by interest overlap.
  const courses = ctx.courses
    .filter((course) => course.percent < 100 && course.tierRank <= ctx.tierRank)
    .map((course) => ({
      course,
      overlap: course.interests.filter((i) => ctx.interests.includes(i)).length,
    }))
    .sort((a, b) => b.overlap - a.overlap || b.course.percent - a.course.percent);
  const course = courses[0];
  if (course) {
    out.push({
      id: `course:${course.course.slug}`,
      kind: "course",
      title: course.course.percent > 0 ? `Continue ${course.course.title}` : `Start ${course.course.title}`,
      body: course.course.percent > 0 ? `${course.course.percent}% complete.` : "A foundation for reading your own chart.",
      href: `/dashboard/courses/${course.course.slug}`,
      reason: course.overlap > 0 ? "Matches the interests you chose." : course.course.percent > 0 ? "You have started it." : "Open to your tier.",
      priority: course.course.percent > 0 ? 55 : 45 + course.overlap * 5,
    });
  }

  // Community: a room for the member's interests.
  const room = ctx.channels
    .filter((channel) => channel.tierRank <= ctx.tierRank)
    .map((channel) => ({ channel, overlap: channel.interests.filter((i) => ctx.interests.includes(i)).length }))
    .filter((entry) => entry.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)[0];
  if (room) {
    out.push({
      id: `community:${room.channel.slug}`,
      kind: "community",
      title: `Join ${room.channel.name}`,
      body: "A room in the Starseed Collective for what you came here for.",
      href: `/dashboard/community/${room.channel.slug}`,
      reason: "Matches the interests you chose.",
      priority: 40 + room.overlap * 3,
    });
  }

  // Matching.
  if (ctx.hasBirthProfile && !ctx.matchingOptIn) {
    out.push({
      id: "match:opt-in",
      kind: "match",
      title: "Find your resonances",
      body: "Opt in to cosmic matching to meet members through shared interests, Human Design and KP.",
      href: "/dashboard/matching",
      reason: "You have a chart but have not opted in to matching.",
      priority: 35,
    });
  } else if (ctx.topMatch) {
    out.push({
      id: "match:top",
      kind: "match",
      title: `Meet ${ctx.topMatch.name}`,
      body: `Resonance ${ctx.topMatch.score}. See why on the matching page.`,
      href: "/dashboard/matching",
      reason: "Your strongest current match.",
      priority: 45,
    });
  }

  if (ctx.hasBirthProfile && ctx.savedPlaces === 0) {
    out.push({
      id: "map:explore",
      kind: "map",
      title: "Explore your cosmic map",
      body: "See where each graha rises and culminates on Earth, and read your KP chart relocated anywhere.",
      href: "/dashboard/map",
      reason: ctx.interests.includes("astrocartography") ? "You are interested in astrocartography." : "You have not saved a place yet.",
      priority: ctx.interests.includes("astrocartography") ? 50 : 30,
    });
  }

  if (ctx.dueFlashcards > 0) {
    out.push({
      id: "practice:flashcards",
      kind: "practice",
      title: `${ctx.dueFlashcards} flashcard${ctx.dueFlashcards === 1 ? "" : "s"} due`,
      body: "A few minutes of spaced repetition keeps the system in your hands.",
      href: "/dashboard/flashcards",
      reason: "Due for review today.",
      priority: 25 + Math.min(10, ctx.dueFlashcards),
    });
  }

  return out.sort((a, b) => b.priority - a.priority).slice(0, limit);
}
