import { auth, currentUser } from "@clerk/nextjs/server";
import { getStore } from "@/lib/db/store";
import type { TierKey, User } from "@/lib/db/schema";
import { hasTierAccess } from "@/lib/payments/stripe";

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
/**
 * The role Clerk's public metadata assigns, if any: `{ "role": "admin" }` or
 * `{ "role": "member" }`. Public metadata can only be written from the Clerk
 * dashboard or a server, never by the user, so it is trusted.
 */
export function roleFromClerkMetadata(metadata: unknown): "admin" | "member" | null {
  if (!metadata || typeof metadata !== "object") return null;
  const role = (metadata as { role?: unknown }).role;
  return role === "admin" || role === "member" ? role : null;
}

const ROLE_RESYNC_MS = 5 * 60_000;
const lastRoleSync = new Map<string, number>();

/** Public metadata exposed in the session token, when the token is customised to carry it. */
async function sessionMetadataRole(): Promise<"admin" | "member" | null> {
  try {
    const { sessionClaims } = await auth();
    const claims = sessionClaims as Record<string, unknown> | null | undefined;
    return roleFromClerkMetadata(claims?.metadata ?? claims?.publicMetadata ?? claims?.public_metadata);
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return null;

  const store = getStore();
  const existing = await store.getUserByClerkId(clerkUserId);
  if (existing) {
    // Keep the local role in step with Clerk's public metadata: from the
    // session token when it carries the metadata (free), otherwise from the
    // Clerk API at most once per ROLE_RESYNC_MS per user and instance.
    let metadataRole = await sessionMetadataRole();
    if (!metadataRole) {
      const last = lastRoleSync.get(clerkUserId) ?? 0;
      if (Date.now() - last > ROLE_RESYNC_MS) {
        lastRoleSync.set(clerkUserId, Date.now());
        try {
          metadataRole = roleFromClerkMetadata((await currentUser())?.publicMetadata);
        } catch {
          // Clerk unreachable: keep the stored role.
        }
      }
    }
    if (metadataRole && metadataRole !== existing.role) {
      return (await store.updateUser(existing.id, { role: metadataRole })) ?? existing;
    }
    return existing;
  }

  // First sight: mirror the minimum from Clerk so the row is usable.
  let email = "";
  let firstName: string | null = null;
  let lastName: string | null = null;
  let imageUrl: string | null = null;
  let emailVerified = false;
  let metadataRole: "admin" | "member" | null = null;
  try {
    const user = await currentUser();
    metadataRole = roleFromClerkMetadata(user?.publicMetadata);
    email =
      user?.primaryEmailAddress?.emailAddress ??
      user?.emailAddresses?.[0]?.emailAddress ??
      "";
    // Admin bootstrap only trusts the primary address, and only once verified.
    emailVerified =
      user?.primaryEmailAddress?.verification?.status === "verified" &&
      user.primaryEmailAddress.emailAddress.toLowerCase() === email.toLowerCase();
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
    // Clerk public metadata wins; otherwise the verified ADMIN_EMAILS allowlist.
    role: metadataRole ?? (emailVerified && ADMIN_EMAILS.has(email.toLowerCase()) ? "admin" : "member"),
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
/**
 * Whether a user's paid tier covers `required`. Admins always pass.
 *
 * `requireMember` only proves the membership was approved; an approved member
 * can still be on the free tier, so paid features must check this as well.
 */
export function userHasTier(user: User, required: TierKey | null | undefined): boolean {
  if (user.role === "admin") return true;
  return hasTierAccess(user.tier, required);
}

/** Throw a 403 unless the user's tier covers `required`. */
export function requireTier(user: User, required: TierKey | null | undefined, feature: string): void {
  if (!userHasTier(user, required)) {
    throw new AuthorizationError(
      `${feature} needs the ${required} tier or above.`,
      403,
    );
  }
}

export function handleAuthError(error: unknown): Response | null {
  if (error instanceof AuthorizationError) {
    return Response.json(
      { ok: false, error: error.message },
      { status: error.status },
    );
  }
  return null;
}
