import { redirect } from "next/navigation";
import { clerkConfigured, getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { COURSES } from "@/content";

/**
 * The course entry point.
 *
 * A course URL with no lesson resolves to the member's next lesson — the first
 * one they have not completed, or the first lesson of the course when they have
 * finished it. That keeps "Continue" from the catalogue meaningful without the
 * catalogue needing to know the lesson order.
 */

const DEMO_MEMBER_CLERK_ID = "user_demo_member";

/**
 * Resolve the member, falling back to the seeded demo member without Clerk.
 *
 * @returns The member's id, or `null`.
 */
async function currentUserId(): Promise<string | null> {
  const signedIn = await getCurrentUser();
  if (signedIn) return signedIn.id;
  if (!clerkConfigured) {
    const demo = await getStore().getUserByClerkId(DEMO_MEMBER_CLERK_ID);
    return demo?.id ?? null;
  }
  return null;
}

/**
 * Redirect to the member's next lesson in a course.
 *
 * @param props - Route props carrying the course `slug`.
 * @returns Never; always redirects.
 */
export default async function CourseEntryPage({
  params,
}: PageProps<"/dashboard/courses/[slug]">) {
  const { slug } = await params;
  const course = COURSES.find((entry) => entry.slug === slug);
  if (!course) redirect("/dashboard/courses");

  const lessons = course.modules.flatMap((module) => module.lessons);
  const firstLesson = lessons[0];
  if (!firstLesson) redirect("/dashboard/courses");

  const userId = await currentUserId();
  if (!userId) redirect(`/dashboard/courses/${course.slug}/${firstLesson.slug}`);

  const store = getStore();
  const [storeCourse, progressRows] = await Promise.all([
    store.getCourseWithLessons(course.slug),
    store.getLessonProgressForUser(userId),
  ]);
  const completed = new Set(
    progressRows.filter((row) => row.status === "complete").map((row) => row.lessonId),
  );
  const storeIdBySlug = new Map(
    (storeCourse?.lessons ?? []).map((lesson) => [lesson.slug, lesson.id]),
  );

  const next =
    lessons.find(
      (lesson) =>
        !completed.has(
          storeIdBySlug.get(lesson.slug) ?? `content:${course.slug}:${lesson.slug}`,
        ),
    ) ?? firstLesson;

  redirect(`/dashboard/courses/${course.slug}/${next.slug}`);
}
