import { redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { CircleAlert, Search, Users } from "lucide-react";

import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
} from "@/components/ui";
import { getAccessLevel, requireAdmin } from "@/lib/auth";
import type {
  MembershipStatus,
  TierKey,
  User,
  UserRole,
} from "@/lib/db/schema";
import { getStore } from "@/lib/db/store";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Member administration.
 *
 * Fully server-rendered: search, filters and pagination are URL state, and
 * every edit is a Server Action that re-checks `requireAdmin()` before it
 * writes. That means the page works without JavaScript and there is exactly one
 * authority for authorisation — the same helper the rest of the app uses.
 *
 * Every write records an audit entry with `before` and `after`, so a role or
 * tier change is never silent.
 */

const ROLES: readonly UserRole[] = ["member", "moderator", "admin"];
const STATUSES: readonly MembershipStatus[] = [
  "none",
  "pending",
  "approved",
  "denied",
  "suspended",
];
const TIERS: readonly TierKey[] = ["free", "initiate", "adept", "oracle"];

const ROLE_TONE: Record<UserRole, "neutral" | "info" | "gold"> = {
  member: "neutral",
  moderator: "info",
  admin: "gold",
};

const STATUS_TONE: Record<MembershipStatus, "neutral" | "warn" | "ok" | "danger"> = {
  none: "neutral",
  pending: "warn",
  approved: "ok",
  denied: "danger",
  suspended: "danger",
};

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function isRole(value: string): value is UserRole {
  return (ROLES as readonly string[]).includes(value);
}

function isStatus(value: string): value is MembershipStatus {
  return (STATUSES as readonly string[]).includes(value);
}

function isTier(value: string): value is TierKey {
  return (TIERS as readonly string[]).includes(value);
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function displayNameOf(user: User): string {
  return (
    user.displayName ??
    ([user.firstName, user.lastName].filter(Boolean).join(" ") || user.email) ??
    "Unnamed"
  );
}

/** Build a query string from the current filter state, dropping blanks. */
function buildQuery(
  filters: { q: string; role: string; status: string; tier: string },
  page: number,
): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  if (filters.tier) params.set("tier", filters.tier);
  if (page > 1) params.set("page", String(page));
  return params.toString();
}

export default async function AdminMembersPage({
  searchParams,
}: PageProps<"/admin/members">) {
  const { level } = await getAccessLevel();
  if (level === "anonymous") redirect("/sign-in?redirect_url=/admin/members");
  if (level !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const q = firstValue(params.q).slice(0, 200);
  const role = firstValue(params.role);
  const status = firstValue(params.status);
  const tier = firstValue(params.tier);
  const pageParam = Number.parseInt(firstValue(params.page), 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const saved = firstValue(params.saved) === "1";

  const filters = { q, role, status, tier };

  const store = getStore();
  const result = await store.listUsers({
    search: q || undefined,
    role: isRole(role) ? role : undefined,
    membershipStatus: isStatus(status) ? status : undefined,
    tier: isTier(tier) ? tier : undefined,
    page,
    pageSize: 25,
  });

  /**
   * Apply an admin edit from the row form.
   *
   * Declared inside the page so it closes over nothing mutable; the caller is
   * re-checked here because a Server Action is a public endpoint.
   */
  async function updateMember(formData: FormData): Promise<void> {
    "use server";

    const admin = await requireAdmin();
    const userId = String(formData.get("userId") ?? "");
    const nextRole = String(formData.get("role") ?? "");
    const nextStatus = String(formData.get("membershipStatus") ?? "");
    const nextTier = String(formData.get("tier") ?? "");
    const returnTo = String(formData.get("returnTo") ?? "");

    if (!userId || !isRole(nextRole) || !isStatus(nextStatus) || !isTier(nextTier)) {
      redirect(`/admin/members${returnTo ? `?${returnTo}` : ""}`);
    }

    const actionStore = getStore();
    const before = await actionStore.getUserById(userId);
    if (!before) {
      redirect(`/admin/members${returnTo ? `?${returnTo}` : ""}`);
    }

    const changed =
      before.role !== nextRole ||
      before.membershipStatus !== nextStatus ||
      before.tier !== nextTier;

    if (changed) {
      await actionStore.updateUser(userId, {
        role: nextRole,
        membershipStatus: nextStatus,
        tier: nextTier,
      });
      await actionStore.recordAuditLog({
        actorUserId: admin.id,
        action: "user.update",
        targetType: "user",
        targetId: userId,
        before: {
          role: before.role,
          membershipStatus: before.membershipStatus,
          tier: before.tier,
        },
        after: {
          role: nextRole,
          membershipStatus: nextStatus,
          tier: nextTier,
        },
      });
    }

    revalidatePath("/admin/members");
    const suffix = returnTo ? `?${returnTo}&saved=1` : "?saved=1";
    redirect(`/admin/members${suffix}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
          Members
        </p>
        <h1 className="mt-3 font-display text-3xl leading-tight text-bone">
          Everyone with an account
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Search by name or email, filter by role, membership and tier, and edit
          in place. Every change is written to the audit log.
        </p>
      </header>

      {saved && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok"
        >
          The member was updated and the change was audited.
        </p>
      )}

      <Card>
        <form
          method="get"
          action="/admin/members"
          className="flex flex-wrap items-end gap-5 p-5"
        >
          <label className="flex min-w-56 flex-1 flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Search
            </span>
            <span className="relative flex items-center">
              <Search
                aria-hidden="true"
                strokeWidth={1.5}
                className="pointer-events-none absolute left-0 h-4 w-4 text-faint"
              />
              <Input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Name or email"
                className="pl-6"
              />
            </span>
          </label>

          <label className="flex w-40 flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Role
            </span>
            <Select name="role" defaultValue={isRole(role) ? role : ""}>
              <option value="">Any role</option>
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex w-44 flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Membership
            </span>
            <Select name="status" defaultValue={isStatus(status) ? status : ""}>
              <option value="">Any status</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex w-36 flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Tier
            </span>
            <Select name="tier" defaultValue={isTier(tier) ? tier : ""}>
              <option value="">Any tier</option>
              {TIERS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </label>

          <div className="flex items-center gap-3 pb-0.5">
            <Button type="submit" variant="secondary" size="sm">
              Apply
            </Button>
            {(q || role || status || tier) && (
              <Link
                href="/admin/members"
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-gold"
              >
                Clear
              </Link>
            )}
          </div>
        </form>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<Users aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />}
          title="No members match"
          description="Adjust the search or clear the filters."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Members, page {result.page} of {result.totalPages}
            </caption>
            <thead>
              <tr className="border-b border-line font-mono text-[9px] uppercase tracking-[0.2em] text-faint">
                <th scope="col" className="px-3 py-3">Member</th>
                <th scope="col" className="px-3 py-3">Current</th>
                <th scope="col" className="px-3 py-3">Joined</th>
                <th scope="col" className="px-3 py-3">Last seen</th>
                <th scope="col" className="px-3 py-3">Edit</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((user) => (
                <tr key={user.id} className="border-b border-hairline align-top">
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={displayNameOf(user)} src={user.imageUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-bone">
                          {displayNameOf(user)}
                        </p>
                        <p className="truncate text-xs text-faint">
                          {user.email ?? "no email"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={ROLE_TONE[user.role]} size="sm">
                        {user.role}
                      </Badge>
                      <Badge tone={STATUS_TONE[user.membershipStatus]} size="sm">
                        {user.membershipStatus}
                      </Badge>
                      <Badge tone="purple" size="sm">
                        {user.tier}
                      </Badge>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-xs text-muted">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-xs text-muted">
                    {formatDate(user.lastSeenAt)}
                  </td>
                  <td className="px-3 py-4">
                    <form action={updateMember} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <input
                        type="hidden"
                        name="returnTo"
                        value={buildQuery(filters, page)}
                      />
                      <label className="flex flex-col gap-1">
                        <span className="sr-only">
                          Role for {displayNameOf(user)}
                        </span>
                        <Select name="role" defaultValue={user.role} className="w-32">
                          {ROLES.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="sr-only">
                          Membership status for {displayNameOf(user)}
                        </span>
                        <Select
                          name="membershipStatus"
                          defaultValue={user.membershipStatus}
                          className="w-36"
                        >
                          {STATUSES.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="sr-only">
                          Tier for {displayNameOf(user)}
                        </span>
                        <Select name="tier" defaultValue={user.tier} className="w-28">
                          {TIERS.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <Button type="submit" size="sm" variant="secondary">
                        Save
                      </Button>
                    </form>
                    {user.deletedAt && (
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-danger">
                        <CircleAlert
                          aria-hidden="true"
                          className="h-3 w-3"
                          strokeWidth={1.5}
                        />
                        deleted in Clerk
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav
        aria-label="Member pages"
        className={cn(
          "flex items-center justify-between gap-4",
          result.totalPages <= 1 && "hidden",
        )}
      >
        <Link
          aria-disabled={page <= 1}
          href={`/admin/members?${buildQuery(filters, Math.max(1, page - 1))}`}
          className={cn(
            "font-mono text-[10px] uppercase tracking-[0.2em]",
            page <= 1 ? "pointer-events-none text-faint" : "text-gold hover:text-gold-hi",
          )}
        >
          ← Previous
        </Link>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
          Page {result.page} of {result.totalPages} · {result.total} members
        </p>
        <Link
          aria-disabled={page >= result.totalPages}
          href={`/admin/members?${buildQuery(filters, Math.min(result.totalPages, page + 1))}`}
          className={cn(
            "font-mono text-[10px] uppercase tracking-[0.2em]",
            page >= result.totalPages
              ? "pointer-events-none text-faint"
              : "text-gold hover:text-gold-hi",
          )}
        >
          Next →
        </Link>
      </nav>
    </div>
  );
}
