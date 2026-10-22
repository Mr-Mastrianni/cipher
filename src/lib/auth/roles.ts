/**
 * Role resolution, shared by the request path and the Clerk webhook.
 *
 * Pure on purpose — no Clerk import, no store, no environment read — so the
 * rules can be tested directly and both callers cannot drift apart. The
 * impure parts (fetching the Clerk user, writing the row) stay in the callers.
 *
 * The rules, in priority order:
 *
 *  1. A role in Clerk's **public metadata** wins outright. Only the Clerk
 *     dashboard or a server can write it, so a member cannot grant it to
 *     themselves, and it is the one place an operator can say "member" and be
 *     obeyed.
 *  2. Otherwise a **verified** address on the `ADMIN_EMAILS` allowlist grants
 *     admin. This is checked on first sight *and* on later sign-ins, so adding
 *     an address works for an account that already exists — the failure mode
 *     that used to require a database edit.
 *  3. Everyone else is a member.
 *
 * Unverified addresses never count: an account cannot claim an allowlisted
 * email it has not proved it owns.
 */

/** The two roles Clerk metadata can assign. */
export type MetadataRole = "admin" | "member";

/** The role Clerk's public metadata assigns, if any. */
export function roleFromClerkMetadata(metadata: unknown): MetadataRole | null {
  if (!metadata || typeof metadata !== "object") return null;
  const role = (metadata as { role?: unknown }).role;
  return role === "admin" || role === "member" ? role : null;
}

/** The subset of a Clerk API user this module needs. */
export interface ClerkUserEmails {
  primaryEmailAddress?: {
    emailAddress?: string | null;
    verification?: { status?: string | null } | null;
  } | null;
}

/**
 * The verified primary email of a Clerk API user, lower-cased, or `null`.
 *
 * @param user - The user object returned by Clerk's `currentUser()`.
 */
export function verifiedEmailFromUser(
  user: ClerkUserEmails | null | undefined,
): string | null {
  const primary = user?.primaryEmailAddress;
  if (primary?.verification?.status !== "verified") return null;
  const email = primary.emailAddress?.trim().toLowerCase();
  return email ? email : null;
}

/** The subset of a Clerk webhook user payload this module needs. */
export interface WebhookUserEmails {
  primary_email_address_id?: string | null;
  email_addresses?: readonly {
    id?: string;
    email_address?: string | null;
    verification?: { status?: string | null } | null;
  }[];
}

/**
 * The verified primary email of a Clerk webhook payload, lower-cased, or `null`.
 *
 * @param data - The `user.created` / `user.updated` payload.
 */
export function verifiedEmailFromWebhook(
  data: WebhookUserEmails,
): string | null {
  const primary = (data.email_addresses ?? []).find(
    (address) => address.id === data.primary_email_address_id,
  );
  if (primary?.verification?.status !== "verified") return null;
  const email = primary.email_address?.trim().toLowerCase();
  return email ? email : null;
}

/** The role a brand-new row should be created with. */
export function roleForNewUser(input: {
  metadataRole: MetadataRole | null;
  verifiedEmail: string | null;
  allowlist: ReadonlySet<string>;
}): MetadataRole {
  if (input.metadataRole) return input.metadataRole;
  const allowlisted = Boolean(
    input.verifiedEmail && input.allowlist.has(input.verifiedEmail),
  );
  return allowlisted ? "admin" : "member";
}

/**
 * Whether an existing account should be promoted to admin now.
 *
 * Only ever promotes. A role set in the console is left alone unless Clerk
 * metadata speaks, and nothing here demotes: removing an address from the
 * allowlist is a forward-only decision an operator should make in the console.
 */
export function shouldPromoteToAdmin(input: {
  metadataRole: MetadataRole | null;
  verifiedEmail: string | null;
  allowlist: ReadonlySet<string>;
  currentRole: string;
}): boolean {
  if (input.metadataRole) return false;
  if (input.currentRole === "admin") return false;
  return Boolean(
    input.verifiedEmail && input.allowlist.has(input.verifiedEmail),
  );
}
