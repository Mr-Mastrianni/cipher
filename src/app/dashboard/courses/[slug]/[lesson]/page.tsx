import { COURSES, type Course } from "@/content";
import { clerkConfigured, getCurrentUser } from "@/lib/auth";
import type { TierKey } from "@/lib/db/schema";
import { getStore } from "@/lib/db/store";
import { hasTierAccess } from "@/lib/payments/stripe";
import { LessonPlayer, type CourseOutline } from "./lesson-player";

/** The seeded member used when Clerk is not configured (demo mode). */
const DEMO_MEMBER_CLERK_ID = "user_demo_member";

/**
 * Whether the current viewer may read a course's lesson text.
 *
 * Free courses are open to anyone who reaches the dashboard. Paid courses need
 * an approved member whose tier includes the course's tier, or an admin. This
 * runs on the server, so locked lesson text is never sent to the browser.
 */
async function canReadCourse(tier: Course["tier"]): Promise<boolean> {
  if (tier === "free") return true;
  const user =
    (await getCurrentUser()) ??
    (!clerkConfigured
      ? await getStore().getUserByClerkId(DEMO_MEMBER_CLERK_ID)
      : null);
  if (!user) return false;
  if (user.role === "admin") return true;
  return (
    user.membershipStatus === "approved" &&
    hasTierAccess(user.tier as TierKey, tier as TierKey)
  );
}

/** Strip a course down to navigation metadata — no lesson bodies. */
function outlineOf(course: Course): CourseOutline {
  return {
    slug: course.slug,
    title: course.title,
    tier: course.tier,
    modules: course.modules.map((module) => ({
      slug: module.slug,
      title: module.title,
      lessons: module.lessons.map(({ slug, title, summary, minutes }) => ({
        slug,
        title,
        summary,
        minutes,
      })),
    })),
  };
}

/**
 * The lesson page.
 *
 * @returns The lesson player, with the lesson body only when the viewer may read it.
 */
export default async function LessonPage({
  params,
}: PageProps<"/dashboard/courses/[slug]/[lesson]">) {
  const { slug, lesson: lessonSlug } = await params;
  const course = COURSES.find((entry) => entry.slug === slug) ?? null;
  const lesson =
    course?.modules
      .flatMap((module) => module.lessons)
      .find((entry) => entry.slug === lessonSlug) ?? null;
  const blocks =
    course && lesson && (await canReadCourse(course.tier)) ? lesson.blocks : null;

  return (
    <LessonPlayer
      key={course?.slug ?? slug}
      course={course ? outlineOf(course) : null}
      lessonSlug={lessonSlug}
      blocks={blocks}
    />
  );
}
