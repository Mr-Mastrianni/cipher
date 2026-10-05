import type { NextRequest } from "next/server";
import { z } from "zod";
import { handleAuthError, requireMember } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { COURSES, type Course as ContentCourse } from "@/content";

/**
 * `/api/courses/[slug]/progress`
 *
 * - `GET`  — the caller's progress through one course, the unlock flag, and the
 *   map from a content lesson slug to its persistence key.
 * - `POST` — mark one lesson complete.
 *
 * ## Why a persistence key rather than a raw lesson id
 *
 * The course *content* lives in the static library (`@/content`), which is the
 * canonical source for lessons and their blocks. The database may additionally
 * hold a matching course row (the seeded demo does, under different slugs), and
 * `lesson_progress` needs a lesson id.
 *
 * The route therefore derives one stable key per content lesson: the matching
 * store lesson id when a store course of the same slug exists, otherwise a
 * deterministic synthetic key `content:<course>:<lesson>`. Reads and writes use
 * the same derivation, so progress round-trips whether or not the database was
 * seeded with the course. Only keys this route derived are accepted on write,
 * so a caller cannot invent arbitrary lesson ids.
 */

/** Ascending tier order used for every membership comparison. */
const TIER_RANK: Readonly<Record<string, number>> = {
  free: 0,
  initiate: 1,
  adept: 2,
  oracle: 3,
};

const progressSchema = z.object({
  lessonKey: z.string().min(1),
  progressPct: z.number().int().min(0).max(100).optional(),
});

/** A resolved course: content plus the key derivation for its lessons. */
interface ResolvedCourse {
  content: ContentCourse;
  /** Content lesson slug → persistence key. */
  keys: Map<string, string>;
  /** Persistence key → content lesson slug, for read-back. */
  slugsByKey: Map<string, string>;
  tier: string;
}

/** Flatten a content course's modules into its ordered lesson list. */
function contentLessons(course: ContentCourse) {
  return course.modules.flatMap((module) => module.lessons);
}

/**
 * Resolve a course by slug and derive its lesson persistence keys.
 *
 * @param slug - The content course slug.
 * @returns The resolved course, or `null` when the slug is unknown.
 */
async function resolveCourse(slug: string): Promise<ResolvedCourse | null> {
  const content = COURSES.find((course) => course.slug === slug);
  if (!content) return null;

  const store = getStore();
  const storeCourse = await store.getCourseWithLessons(slug);

  const storeIdBySlug = new Map(
    (storeCourse?.lessons ?? []).map((lesson) => [lesson.slug, lesson.id]),
  );

  const keys = new Map<string, string>();
  const slugsByKey = new Map<string, string>();
  for (const lesson of contentLessons(content)) {
    const key = storeIdBySlug.get(lesson.slug) ?? `content:${content.slug}:${lesson.slug}`;
    keys.set(lesson.slug, key);
    slugsByKey.set(key, lesson.slug);
  }

  return { content, keys, slugsByKey, tier: content.tier };
}

/**
 * Read progress for a course.
 *
 * @param _request - Unused.
 * @param context - Route context carrying the course `slug`.
 * @returns Progress rows keyed by lesson, the key map, and the unlock flag.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/courses/[slug]/progress">,
) {
  try {
    const user = await requireMember();
    const { slug } = await context.params;

    const resolved = await resolveCourse(slug);
    if (!resolved) {
      return Response.json({ ok: false, error: "Course not found." }, { status: 404 });
    }

    const store = getStore();
    const rows = await store.getLessonProgressForUser(user.id);
    const rowByKey = new Map(rows.map((row) => [row.lessonId, row]));

    const locked =
      user.role !== "admin" &&
      (TIER_RANK[user.tier] ?? 0) < (TIER_RANK[resolved.tier] ?? 0);

    const progress = [...resolved.keys.entries()].map(([lessonSlug, key]) => {
      const row = rowByKey.get(key);
      return {
        lessonSlug,
        lessonKey: key,
        status: row?.status ?? "not_started",
        progressPct: row?.progressPct ?? 0,
        completedAt: row?.completedAt ? row.completedAt.toISOString() : null,
      };
    });

    return Response.json({
      ok: true,
      course: {
        slug: resolved.content.slug,
        title: resolved.content.title,
        tier: resolved.tier,
        lessonKeys: Object.fromEntries(resolved.keys),
      },
      tier: user.tier,
      locked,
      progress,
    });
  } catch (error) {
    return (
      handleAuthError(error) ??
      Response.json({ ok: false, error: "Could not load your progress." }, { status: 500 })
    );
  }
}

/**
 * Mark one content lesson complete.
 *
 * @param request - JSON body `{ lessonKey: string, progressPct?: number }`.
 * @param context - Route context carrying the course `slug`.
 * @returns The refreshed progress rows.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/courses/[slug]/progress">,
) {
  try {
    const user = await requireMember();
    const { slug } = await context.params;

    const resolved = await resolveCourse(slug);
    if (!resolved) {
      return Response.json({ ok: false, error: "Course not found." }, { status: 404 });
    }

    if (
      user.role !== "admin" &&
      (TIER_RANK[user.tier] ?? 0) < (TIER_RANK[resolved.tier] ?? 0)
    ) {
      return Response.json(
        { ok: false, error: `This course needs the ${resolved.tier} tier.` },
        { status: 403 },
      );
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Expected a JSON body." }, { status: 400 });
    }

    const parsed = progressSchema.safeParse(payload);
    if (!parsed.success) {
      return Response.json({ ok: false, error: "A lesson key is required." }, { status: 400 });
    }

    if (!resolved.slugsByKey.has(parsed.data.lessonKey)) {
      return Response.json(
        { ok: false, error: "That lesson is not part of this course." },
        { status: 400 },
      );
    }

    const store = getStore();
    const saved = await store.markLessonComplete(
      user.id,
      parsed.data.lessonKey,
      parsed.data.progressPct ?? 100,
    );

    await store.recordAuditLog({
      actorUserId: user.id,
      action: "course.lesson.complete",
      targetType: "lesson",
      targetId: parsed.data.lessonKey,
      after: { status: saved.status, progressPct: saved.progressPct, course: slug },
    });

    const rows = await store.getLessonProgressForUser(user.id);
    const rowByKey = new Map(rows.map((row) => [row.lessonId, row]));
    const progress = [...resolved.keys.entries()].map(([lessonSlug, key]) => {
      const row = rowByKey.get(key);
      return {
        lessonSlug,
        lessonKey: key,
        status: row?.status ?? "not_started",
        progressPct: row?.progressPct ?? 0,
        completedAt: row?.completedAt ? row.completedAt.toISOString() : null,
      };
    });

    return Response.json({ ok: true, progress });
  } catch (error) {
    return (
      handleAuthError(error) ??
      Response.json({ ok: false, error: "Could not save your progress." }, { status: 500 })
    );
  }
}
