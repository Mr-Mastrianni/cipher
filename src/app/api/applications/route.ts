import type { NextRequest } from "next/server";
import { z } from "zod";

import { handleAuthError, requireAdmin, requireUser } from "@/lib/auth";
import type { ApplicationStatus } from "@/lib/db/schema";
import { getStore } from "@/lib/db/store";

/**
 * Membership applications.
 *
 * `POST` is the applicant's entry point: one open application at a time, and
 * the submission immediately mirrors `membershipStatus: "pending"` onto the
 * user so the rest of the app can reason about where they are.
 *
 * `GET` is the admin review queue. The store returns applications newest-first
 * without pagination, so pagination is applied here after filtering and each
 * row is enriched with the applicant's identity and chart summary — which is
 * what the review screen actually renders.
 */

const TIERS = ["free", "initiate", "adept", "oracle"] as const;

const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "pending",
  "approved",
  "denied",
  "withdrawn",
];

const answersSchema = z.object({
  why: z.string().min(1).max(4000),
  whatYouMake: z.string().min(1).max(500),
  experienceLevel: z.string().min(1).max(200),
  referral: z.string().max(500).optional(),
  /** The tier applied for. Validated again on approval before it is granted. */
  tier: z.enum(TIERS).optional(),
});

function isApplicationStatus(value: string | null): value is ApplicationStatus {
  return (
    value !== null &&
    (APPLICATION_STATUSES as readonly string[]).includes(value)
  );
}

function clampInt(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

/** A review-queue row: the application plus everything the reviewer needs. */
interface ApplicationRow {
  id: string;
  userId: string;
  status: ApplicationStatus;
  answers: Record<string, unknown>;
  reviewedById: string | null;
  reviewedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
  applicant: {
    id: string;
    displayName: string | null;
    email: string | null;
    imageUrl: string | null;
    membershipStatus: string;
    tier: string;
    createdAt: string;
  } | null;
  chart: {
    type: string | null;
    profile: string | null;
    authority: string | null;
    auraSeat: string;
    auraFormat: string;
    auraLabel: string;
  } | null;
}

/**
 * Submit an application for the signed-in user.
 *
 * A denied application may be resubmitted; anything else open is a conflict so
 * the queue cannot be spammed.
 */
export async function POST(request: NextRequest): Promise<Response> {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return Response.json({ ok: false, error: "Unauthorised." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = answersSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "Some fields are missing or too long.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const store = getStore();
  const existing = await store.getApplicationByUser(user.id);
  if (
    existing &&
    existing.status !== "denied" &&
    existing.status !== "withdrawn"
  ) {
    return Response.json(
      {
        ok: false,
        error:
          existing.status === "pending"
            ? "Your application is already with the reviewers."
            : "You are already a member.",
        application: existing,
      },
      { status: 409 },
    );
  }

  const application = await store.createApplication({
    userId: user.id,
    answers: { ...parsed.data },
  });

  // `createApplication` mirrors this too, but stating it here keeps the
  // contract obvious at the call site and covers a store that only inserts.
  await store.updateUser(user.id, { membershipStatus: "pending" });

  return Response.json({ ok: true, application }, { status: 201 });
}

/** Admin-only, paginated review queue with applicant and chart detail. */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    await requireAdmin();
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return Response.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const statusParam = params.get("status");
  // `status=all` (or an unknown value) means "no status filter".
  const status =
    statusParam && statusParam !== "all" && isApplicationStatus(statusParam)
      ? statusParam
      : undefined;

  const page = clampInt(params.get("page"), 1, 1, 10_000);
  const pageSize = clampInt(params.get("pageSize"), 20, 1, 100);

  const store = getStore();
  const all = await store.listApplications(status);
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const slice = all.slice(start, start + pageSize);

  const items: ApplicationRow[] = await Promise.all(
    slice.map(async (application) => {
      const [applicant, profile] = await Promise.all([
        store.getUserById(application.userId),
        store.getBirthProfileByUser(application.userId),
      ]);
      return {
        id: application.id,
        userId: application.userId,
        status: application.status,
        answers: application.answers as Record<string, unknown>,
        reviewedById: application.reviewedById,
        reviewedAt: application.reviewedAt
          ? application.reviewedAt.toISOString()
          : null,
        decisionNote: application.decisionNote,
        createdAt: application.createdAt.toISOString(),
        updatedAt: application.updatedAt.toISOString(),
        applicant: applicant
          ? {
              id: applicant.id,
              displayName:
                applicant.displayName ??
                ([applicant.firstName, applicant.lastName]
                  .filter(Boolean)
                  .join(" ") ||
                  null),
              email: applicant.email,
              imageUrl: applicant.imageUrl,
              membershipStatus: applicant.membershipStatus,
              tier: applicant.tier,
              createdAt: applicant.createdAt.toISOString(),
            }
          : null,
        chart: profile
          ? {
              type: profile.bodygraph?.type ?? null,
              profile: profile.bodygraph?.profile ?? null,
              authority: profile.bodygraph?.authority ?? null,
              auraSeat: profile.auraSeat,
              auraFormat: profile.auraFormat,
              auraLabel: profile.auraLabel,
            }
          : null,
      };
    }),
  );

  return Response.json({
    ok: true,
    items,
    total,
    page,
    pageSize,
    totalPages,
  });
}
