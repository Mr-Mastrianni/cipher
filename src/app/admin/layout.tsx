/* The admin sidebar uses
   document navigations on purpose: a shared layout is not re-rendered on
   client-side navigation, so the only way the server can keep the active-route
   highlight correct is for each click to be a fresh document request. */

import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  Activity,
  BookOpen,
  FileCheck2,
  LayoutDashboard,
  ScrollText,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Avatar, Badge, Button } from "@/components/ui";
import { getAccessLevel } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  // Repeated deliberately: a nested layout that sets `title` stops inheriting
  // the root's title template, so the suffix has to be re-declared here.
  title: { default: "Admin", template: "%s · The Cipher" },
  description: "The Cipher admin console.",
  robots: { index: false, follow: false },
};

/**
 * Admin shell.
 *
 * The gate lives here *and* in every page: Next.js does not re-run a layout on
 * client-side navigation, so a layout-only check would leave the door open for
 * a client transition into a page. Each page repeats `getAccessLevel()`.
 *
 * Anonymous visitors go to sign-in; signed-in non-admins go to their dashboard
 * rather than a 404, because "why can't I get in" is the expensive failure mode.
 */
export const dynamic = "force-dynamic";

const NAV: ReadonlyArray<{
  href: string;
  label: string;
  icon: LucideIcon;
  /** Exact match for the overview, prefix match for the rest. */
  exact?: boolean;
}> = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/applications", label: "Applications", icon: FileCheck2 },
  { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/agent", label: "Agent", icon: Activity },
  { href: "/admin/audit", label: "Audit", icon: ScrollText },
  { href: "/admin/manual", label: "Manual", icon: BookOpen },
];

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Shown to a signed-in account that is not an administrator.
 *
 * It names the signed-in address and both ways to grant the role, because the
 * old behaviour — redirect to `/dashboard` — was indistinguishable from being
 * forced through onboarding, with nothing to act on.
 */
function AdminAccessRequired({ email }: { email: string | null }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-5 px-6 py-16">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
        Admin
      </p>
      <h1 className="font-display text-3xl leading-tight text-bone text-balance">
        Administrator access required
      </h1>
      <p className="text-sm leading-relaxed text-muted text-pretty">
        You are signed in as{" "}
        <span className="text-bone">
          {email ?? "an account with no email on file"}
        </span>
        , which is not an administrator on this deployment.
      </p>
      <div className="rounded-lg border border-gold/30 bg-gold/5 px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
          How to fix it
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted text-pretty">
          Add that exact address to <code className="text-bone">ADMIN_EMAILS</code>{" "}
          in this deployment&apos;s environment and redeploy, or set{" "}
          <code className="text-bone">publicMetadata.role</code> to{" "}
          <code className="text-bone">&quot;admin&quot;</code> for the account in
          Clerk. The address must be verified in Clerk. Then reload this page.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary" size="sm">
          <Link href="/dashboard">Back to the dashboard</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/">The public site</Link>
        </Button>
      </div>
    </main>
  );
}

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { level, user } = await getAccessLevel();

  if (level === "anonymous") {
    redirect("/sign-in?redirect_url=/admin");
  }

  // A signed-in member who is not an admin gets an explanation, not a silent
  // bounce into the dashboard — which, for an account that had never
  // onboarded, used to feel like being forced through the application flow
  // with no hint about why. The signed-in address is shown so the fix is
  // obvious: put that exact address in ADMIN_EMAILS (or set Clerk metadata).
  if (level !== "admin" || !user) {
    return <AdminAccessRequired email={user?.email ?? null} />;
  }

  // Provided by `src/proxy.ts`; a server layout cannot read the URL itself.
  const pathname = (await headers()).get("x-cipher-pathname") ?? "/admin";

  const displayName =
    user.displayName ??
    ([user.firstName, user.lastName].filter(Boolean).join(" ") || user.email) ??
    "Administrator";

  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-hairline bg-ink/40 px-5 py-6 lg:flex">
        <Link
          href="/"
          className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted transition-colors hover:text-gold"
        >
          The Cipher
        </Link>
        <p className="mt-2 font-display text-lg tracking-wide text-bone">Admin</p>

        <nav aria-label="Admin sections" className="mt-8 flex-1">
          <ul className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href, Boolean(item.exact));
              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors",
                      active
                        ? "border-gold/40 bg-gold/10 text-gold"
                        : "border-transparent text-muted hover:border-hairline hover:bg-raised hover:text-bone",
                    )}
                  >
                    <item.icon
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0"
                      strokeWidth={1.5}
                    />
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-6 border-t border-hairline pt-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-faint">
            Signed in as
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Avatar name={displayName} src={user.imageUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-bone">{displayName}</p>
              <p className="truncate text-[11px] text-faint">
                {user.email ?? "no email on file"}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <Badge tone="gold" size="sm">
              {user.role}
            </Badge>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Compact navigation for narrow viewports. */}
        <nav
          aria-label="Admin sections"
          className="flex gap-1 overflow-x-auto border-b border-hairline bg-ink/60 px-3 py-2 lg:hidden"
        >
          {NAV.map((item) => {
            const active = isActive(pathname, item.href, Boolean(item.exact));
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-md px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em]",
                  active ? "bg-gold/10 text-gold" : "text-muted",
                )}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <main id="main" className="min-w-0 flex-1 px-5 py-8 sm:px-8 sm:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
