import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, Check, Clock, Lock, Sparkles } from "lucide-react";
import { clerkConfigured, getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { COURSES } from "@/content";
import { hasTierAccess } from "@/lib/payments/stripe";
import type { TierKey } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell } from "@/components/chrome/page-shell";
import { Section } from "@/components/chrome/section";

/**
 * The course catalogue.
 *
 * Progress is derived from the same stable per-lesson key the player writes, so
 * it round-trips whether or not the database was seeded with matching course
 * slugs: the store's own lesson id when one exists, otherwise a synthetic
 * `content:<course>:<lesson>` key. Courses above the member's tier are shown
 * rather than hidden — a locked syllabus is a better argument than a blank page.
 */

export const metadata: Metadata = {
  title: "Courses",
  robots: { index: false, follow: false },
};

const DEMO_MEMBER_CLERK_ID = "user_demo_member";

const TIER_LABEL: Readonly<Record<string, string>> = {
  free: "Threshold",
  initiate: "Initiate",
  adept: "Adept",
  oracle: "Oracle",
};

const LEVEL_TONE: Readonly<
  Record<string, "neutral" | "purple" | "gold" | "teal">
> = {
  foundation: "teal",
  intermediate: "purple",
  advanced: "gold",
};

/**
 * Resolve the member, falling back to the seeded demo member when Clerk is not
 * configured so the catalogue is explorable in a secretless deployment.
 */
async function currentUser() {
  const signedIn = await getCurrentUser();
  if (signedIn) return signedIn;
  if (clerkConfigured) return null;
  return getStore().getUserByClerkId(DEMO_MEMBER_CLERK_ID);
}

export default async function CoursesPage() {
  const user = await currentUser();
  const store = getStore();

  const [progressRows, storeCourse] = await Promise.all([
    user ? store.getLessonProgressForUser(user.id) : Promise.resolve([]),
    store.getCourseWithLessons(COURSES[0]?.slug ?? "").catch(() => null),
  ]);

  const completed = new Set(
    progressRows
      .filter((row) => row.status === "complete")
      .map((row) => row.lessonId),
  );

  // Map the store's lesson ids onto content slugs for the first course, which
  // is the only one the seeded store knows about.
  const storeIdBySlug = new Map(
    (storeCourse?.lessons ?? []).map((lesson) => [lesson.slug, lesson.id]),
  );

  const memberTier = (user?.tier ?? "free") as TierKey;

  const catalogue = COURSES.map((course) => {
    const lessons = course.modules.flatMap((module) => module.lessons);
    const progressKey = (slug: string) =>
      storeIdBySlug.get(slug) ?? `content:${course.slug}:${slug}`;

    const doneCount = lessons.filter((lesson) =>
      completed.has(progressKey(lesson.slug)),
    ).length;
    const percent =
      lessons.length === 0 ? 0 : Math.round((doneCount / lessons.length) * 100);
    const unlocked = hasTierAccess(memberTier, course.tier as TierKey);
    const nextLesson =
      lessons.find((lesson) => !completed.has(progressKey(lesson.slug))) ??
      lessons[0];

    return { course, lessons, doneCount, percent, unlocked, nextLesson };
  });

  const started = catalogue.filter((entry) => entry.doneCount > 0).length;
  const finished = catalogue.filter(
    (entry) => entry.percent === 100 && entry.lessons.length > 0,
  ).length;

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="The curriculum"
        title="Courses"
        description={
          user
            ? `${started} of ${catalogue.length} started · ${finished} complete. Every course is written to be used on your own chart, not read about.`
            : "Every course is written to be used on your own chart, not read about."
        }
      />

      {catalogue.length === 0 ? (
        <Section>
          <EmptyState
            icon={<BookOpen className="h-5 w-5" />}
            title="No courses yet"
            description="The curriculum is being written. Check back shortly."
          />
        </Section>
      ) : (
        <Section>
          <ul className="grid gap-5 lg:grid-cols-2">
            {catalogue.map(
              ({ course, lessons, doneCount, percent, unlocked, nextLesson }) => (
                <li key={course.slug}>
                  <article
                    className={[
                      "flex h-full flex-col rounded-xl border bg-ink/60 p-6 transition-colors",
                      unlocked
                        ? "border-hairline hover:border-line"
                        : "border-hairline/60",
                    ].join(" ")}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={LEVEL_TONE[course.level] ?? "neutral"}>
                        {course.level}
                      </Badge>
                      <Badge tone={unlocked ? "gold" : "neutral"}>
                        {!unlocked && (
                          <Lock
                            className="mr-1 h-3 w-3"
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                        )}
                        {TIER_LABEL[course.tier] ?? course.tier}
                      </Badge>
                    </div>

                    <h2 className="mt-3 font-display text-xl tracking-wide text-bone">
                      {course.title}
                    </h2>
                    <p className="mt-1 text-sm text-muted">{course.subtitle}</p>

                    <p className="mt-4 flex-1 text-pretty text-sm leading-relaxed text-muted">
                      {course.description}
                    </p>

                    <dl className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                      <div className="flex items-center gap-1.5">
                        <BookOpen
                          className="h-3.5 w-3.5"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                        <dt className="sr-only">Lessons</dt>
                        <dd>{lessons.length} lessons</dd>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock
                          className="h-3.5 w-3.5"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                        <dt className="sr-only">Duration</dt>
                        <dd>{course.minutes} min</dd>
                      </div>
                    </dl>

                    <div className="mt-5">
                      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                        <span>
                          {doneCount}/{lessons.length} complete
                        </span>
                        <span>{percent}%</span>
                      </div>
                      <div
                        className="mt-2 h-1 w-full overflow-hidden rounded-full bg-hairline"
                        role="progressbar"
                        aria-valuenow={percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${course.title} progress`}
                      >
                        <div
                          className={[
                            "h-full rounded-full transition-[width] duration-500",
                            percent === 100 ? "bg-ok" : "bg-gold",
                          ].join(" ")}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-6">
                      {unlocked ? (
                        <Link
                          href={`/dashboard/courses/${course.slug}/${nextLesson?.slug ?? ""}`}
                          className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-on-accent transition-all hover:brightness-110"
                        >
                          {percent === 100 ? (
                            <>
                              <Check className="h-4 w-4" strokeWidth={2} />
                              Review from the start
                            </>
                          ) : doneCount > 0 ? (
                            <>Continue · {nextLesson?.title}</>
                          ) : (
                            <>Start · {nextLesson?.title}</>
                          )}
                        </Link>
                      ) : (
                        <div className="rounded-md border border-line bg-raised/40 px-4 py-3">
                          <p className="flex items-center gap-2 text-sm text-muted">
                            <Lock
                              className="h-4 w-4"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            Included with{" "}
                            <span className="text-gold">
                              {TIER_LABEL[course.tier] ?? course.tier}
                            </span>
                          </p>
                          <Link
                            href="/membership"
                            className="mt-2 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-gold transition-colors hover:text-gold-hi"
                          >
                            <Sparkles
                              className="h-3 w-3"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            See what unlocks
                          </Link>
                        </div>
                      )}
                    </div>

                    {course.outcomes.length > 0 && (
                      <details className="mt-5 border-t border-hairline pt-4">
                        <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-[0.18em] text-faint transition-colors hover:text-gold">
                          What you will be able to do
                        </summary>
                        <ul className="mt-3 space-y-2">
                          {course.outcomes.map((outcome) => (
                            <li
                              key={outcome}
                              className="flex gap-2.5 text-[13px] leading-relaxed text-muted"
                            >
                              <span
                                aria-hidden="true"
                                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold"
                              />
                              {outcome}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </article>
                </li>
              ),
            )}
          </ul>
        </Section>
      )}
    </PageShell>
  );
}
