import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  FileClock,
  Users,
} from "lucide-react";

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui";
import { getAccessLevel } from "@/lib/auth";
import { TIER_SEED } from "@/lib/db/schema";
import { getStore } from "@/lib/db/store";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Format an instant in UTC — the schedule is published in UTC everywhere. */
function formatUtc(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function StatCard({
  label,
  value,
  hint,
  icon,
  href,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const body = (
    <Card className="h-full" interactive={Boolean(href)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            {label}
          </p>
          <span aria-hidden="true" className="text-gold">
            {icon}
          </span>
        </div>
        <p className="font-display text-4xl text-bone">{value}</p>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-faint">{hint}</p>
        {href && (
          <ArrowUpRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted"
            strokeWidth={1.5}
          />
        )}
      </CardContent>
    </Card>
  );

  if (!href) return body;
  return (
    <Link href={href} className="block rounded-lg focus-visible:ring-2 focus-visible:ring-gold">
      {body}
    </Link>
  );
}

/** The admin overview: the numbers a reviewer checks before anything else. */
export default async function AdminOverviewPage() {
  const { level } = await getAccessLevel();
  if (level === "anonymous") redirect("/sign-in?redirect_url=/admin");
  if (level !== "admin") redirect("/dashboard");

  const store = getStore();
  const tierKeys = TIER_SEED.map((tier) => tier.key);

  const [pending, approved, allMembers, tierTotals, calls, audit] =
    await Promise.all([
      store.listApplications("pending"),
      store.listUsers({ membershipStatus: "approved", pageSize: 1 }),
      store.listUsers({ pageSize: 1 }),
      Promise.all(
        tierKeys.map(async (tier) => ({
          tier,
          total: (await store.listUsers({ tier, pageSize: 1 })).total,
        })),
      ),
      store.listUpcomingCalls(5),
      store.listAuditLog(8),
    ]);

  const actors = await Promise.all(
    audit.map((entry) =>
      entry.actorUserId
        ? store.getUserById(entry.actorUserId)
        : Promise.resolve(null),
    ),
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
          Overview
        </p>
        <h1 className="mt-3 font-display text-3xl leading-tight text-bone">
          The room, at a glance
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Applications waiting, members who are through, the next calls, and the
          last privileged actions taken in this console.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending"
          value={pending.length}
          hint="Applications awaiting a decision."
          href="/admin/applications"
          icon={<FileClock className="h-4 w-4" strokeWidth={1.5} />}
        />
        <StatCard
          label="Approved"
          value={approved.total}
          hint="Members whose membership is active."
          href="/admin/members"
          icon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />}
        />
        <StatCard
          label="Accounts"
          value={allMembers.total}
          hint="Every account, including applicants."
          href="/admin/members"
          icon={<Users className="h-4 w-4" strokeWidth={1.5} />}
        />
        <StatCard
          label="Upcoming calls"
          value={calls.length}
          hint="Scheduled calls starting from now."
          icon={<CalendarClock className="h-4 w-4" strokeWidth={1.5} />}
        />
      </div>

      <section aria-labelledby="tiers-heading" className="flex flex-col gap-4">
        <h2
          id="tiers-heading"
          className="font-mono text-[10px] uppercase tracking-[0.24em] text-gold"
        >
          Members by tier
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tierTotals.map(({ tier, total }) => {
            const meta = TIER_SEED.find((entry) => entry.key === tier);
            return (
              <Card key={tier}>
                <CardHeader>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
                    {meta?.name ?? tier}
                  </p>
                  <p className="font-display text-3xl text-bone">{total}</p>
                </CardHeader>
                <CardContent>
                  <p className="text-xs leading-relaxed text-faint">
                    {meta?.description ?? "—"}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="calls-heading" className="flex flex-col gap-4">
          <h2
            id="calls-heading"
            className="font-mono text-[10px] uppercase tracking-[0.24em] text-gold"
          >
            Upcoming calls
          </h2>
          {calls.length === 0 ? (
            <EmptyState
              icon={<CalendarClock aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />}
              title="Nothing scheduled"
              description="The weekly call has not been created yet."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {calls.map((call) => (
                <li key={call.id}>
                  <Card>
                    <CardHeader className="flex-row items-center justify-between gap-4">
                      <CardTitle className="text-base">{call.title}</CardTitle>
                      <Badge tone={call.status === "live" ? "ok" : "info"} size="sm">
                        {call.status}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                        {formatUtc(call.startsAt)} UTC · {call.durationMinutes} min
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="audit-heading" className="flex flex-col gap-4">
          <h2
            id="audit-heading"
            className="font-mono text-[10px] uppercase tracking-[0.24em] text-gold"
          >
            Recent actions
          </h2>
          {audit.length === 0 ? (
            <EmptyState
              icon={<FileClock aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />}
              title="No privileged actions yet"
              description="Approvals, denials and role changes appear here."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-hairline rounded-lg border border-hairline">
              {audit.map((entry, index) => (
                <li key={entry.id} className="flex items-center gap-4 px-4 py-3">
                  <Badge tone="purple" size="sm">
                    {entry.action.replace(/\./g, " ")}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted">
                    {actors[index]?.displayName ??
                      actors[index]?.email ??
                      (entry.actorUserId ? "unknown actor" : "system")}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                    {timeAgo(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/audit"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold transition-colors hover:text-gold-hi"
          >
            Full audit log →
          </Link>
        </section>
      </div>
    </div>
  );
}
