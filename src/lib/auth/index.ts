import { auth, currentUser } from "@clerk/nextjs/server";
import { getStore } from "@/lib/db/store";
import type { User } from "@/lib/db/schema";

/**
 * Server-side auth helpers.
 *
 * Everything privileged goes through here so that role and membership checks
 * live in exactly one place. The pattern follows Clerk's current guidance for
 * Next.js 16: the proxy (formerly middleware) is used only for cheap optimistic
 * redirects, and every resource re-checks authorisation on the server.
 */

export const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY,
);

/** The signed-in Clerk user id, or null. Safe when Clerk is unconfigured. */
export async function getClerkUserId(): Promise<string | null> {
  if (!clerkConfigured) return null;
  try {
    const { userId } = await auth();
    return userId ?? null;
  } catch {
    return null;
  }
}

/**
 * The application user record for the signed-in Clerk user, creating it on
 * first sight so that a brand-new sign-up always has a row to attach
 * onboarding data to.
 */
export async function getCurrentUser(): Promise<User | null> {
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return null;

  const store = getStore();
  const existing = await store.getUserByClerkId(clerkUserId);
  if (existing) return existing;

  // First sight: mirror the minimum from Clerk so the row is usable.
  let email = "";
  let firstName: string | null = null;
  let lastName: string | null = null;
  let imageUrl: string | null = null;
  try {
    const user = await currentUser();
    email =
      user?.primaryEmailAddress?.emailAddress ??
      user?.emailAddresses?.[0]?.emailAddress ??
      "";
    firstName = user?.firstName ?? null;
    lastName = user?.lastName ?? null;
    imageUrl = user?.imageUrl ?? null;
  } catch {
    // Non-fatal: the row is still created with whatever we have.
  }

  return store.upsertUser({
    clerkUserId,
    email,
    firstName,
    lastName,
    imageUrl,
    role: ADMIN_EMAILS.has(email.toLowerCase()) ? "admin" : "member",
  });
}

/**
 * Bootstrap admins.
 *
 * Anyone whose email is listed in `ADMIN_EMAILS` (comma-separated) is promoted
 * on first sign-in. This is how the first admin is created without a manual
 * database edit. After that, roles are managed in the admin console.
 */
export const ADMIN_EMAILS: ReadonlySet<string> = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase());
}

export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "admin";
}

/** Approved member (any paid tier) or admin. */
export async function isApprovedMember(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.membershipStatus === "approved";
}

export type AccessLevel = "anonymous" | "member" | "applicant" | "admin";

export async function getAccessLevel(): Promise<{
  level: AccessLevel;
  user: User | null;
}> {
  const user = await getCurrentUser();
  if (!user) return { level: "anonymous", user: null };
  if (user.role === "admin") return { level: "admin", user };
  if (user.membershipStatus === "approved") return { level: "member", user };
  return { level: "applicant", user };
}

/**
 * Throwing guards for API routes and server actions. They return the user so
 * callers do not have to re-fetch.
 */
export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthorizationError("You must be signed in.", 401);
  }
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new AuthorizationError("Administrator access is required.", 403);
  }
  return user;
}

export async function requireMember(): Promise<User> {
  const user = await requireUser();
  if (user.role === "admin") return user;
  if (user.membershipStatus !== "approved") {
    throw new AuthorizationError(
      "Your membership is not active yet.",
      403,
    );
  }
  return user;
}

/** Turn a thrown AuthorizationError into a JSON Response, or rethrow. */
export function handleAuthError(error: unknown): Response | null {
  if (error instanceof AuthorizationError) {
    return Response.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }
  return null;
}
