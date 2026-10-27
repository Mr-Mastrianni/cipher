import { auth, currentUser } from "@clerk/nextjs/server";
import { getStore } from "@/lib/db/store";
import type { TierKey, User } from "@/lib/db/schema";
import { hasTierAccess } from "@/lib/payments/stripe";
import {
  roleForNewUser,
  roleFromClerkMetadata,
  shouldPromoteToAdmin,
  verifiedEmailFromUser,
  type MetadataRole,
} from "./roles";

export { roleFromClerkMetadata };
export type { MetadataRole };

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
const ROLE_RESYNC_MS = 5 * 60_000;
const lastRoleSync = new Map<string, number>();

/** Public metadata exposed in the session token, when the token is customised to carry it. */
async function sessionMetadataRole(): Promise<MetadataRole | null> {
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
    // Keep the local role in step with Clerk: from the session token when it
    // carries the metadata (free), otherwise from the Clerk API at most once
    // per ROLE_RESYNC_MS per user and instance. That one fetch also lets the
    // ADMIN_EMAILS allowlist promote an account that already exists — without
    // it, setting the variable after signing up had no effect at all.
    let metadataRole = await sessionMetadataRole();
    if (!metadataRole) {
      const last = lastRoleSync.get(clerkUserId) ?? 0;
      if (Date.now() - last > ROLE_RESYNC_MS) {
        lastRoleSync.set(clerkUserId, Date.now());
        try {
          const clerkUser = await currentUser();
          metadataRole = roleFromClerkMetadata(clerkUser?.publicMetadata);
          if (
            shouldPromoteToAdmin({
              metadataRole,
              verifiedEmail: verifiedEmailFromUser(clerkUser),
              allowlist: ADMIN_EMAILS,
              currentRole: existing.role,
            })
          ) {
            return (
              (await store.updateUser(existing.id, { role: "admin" })) ?? existing
            );
          }
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
  let verifiedEmail: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  let imageUrl: string | null = null;
  let metadataRole: MetadataRole | null = null;
  try {
    const user = await currentUser();
    metadataRole = roleFromClerkMetadata(user?.publicMetadata);
    email =
      user?.primaryEmailAddress?.emailAddress ??
      user?.emailAddresses?.[0]?.emailAddress ??
      "";
    verifiedEmail = verifiedEmailFromUser(user);
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
    role: roleForNewUser({
      metadataRole,
      verifiedEmail,
      allowlist: ADMIN_EMAILS,
    }),
  });
}

/**
 * The admin allowlist.
 *
 * A comma-separated list of email addresses. A **verified** address on it
 * grants admin on sign-in, including for an account that already exists — so
 * setting `ADMIN_EMAILS` after a member has signed up still promotes them.
 * Clerk's public metadata still wins when it names a role, and nothing here
 * demotes: remove the address *and* change the role in the console.
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

/** The seeded demo member, used only when Clerk is not configured. */
async function demoMember(): Promise<User | null> {
  if (clerkConfigured) return null;
  try {
    return await getStore().getUserByClerkId("user_demo_member");
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<User> {
  const user = (await getCurrentUser()) ?? (await demoMember());
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
