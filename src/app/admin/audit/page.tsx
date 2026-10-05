import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";

import { Badge, Card, EmptyState } from "@/components/ui";
import { getAccessLevel } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * The audit log, newest first.
 *
 * Audit entries are append-only and never edited, so this page is a straight
 * read. The detail payload is a native `<details>` expander rather than a
 * custom widget: it is keyboard-operable and screen-reader-announced for free.
 */

const MAX_ENTRIES = 250;

const ACTION_TONE: Record<string, "gold" | "danger" | "ok" | "purple" | "info"> = {
  "membership.approve": "ok",
  "membership.deny": "danger",
  "user.update": "gold",
};

function toneFor(action: string) {
  return ACTION_TONE[action] ?? "purple";
}

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function renderDetail(value: unknown): string {
  if (value === null || value === undefined) return "null";
  return JSON.stringify(value, null, 2);
}

export default async function AdminAuditPage() {
  const { level } = await getAccessLevel();
  if (level === "anonymous") redirect("/sign-in?redirect_url=/admin/audit");
  if (level !== "admin") redirect("/dashboard");

  const store = getStore();
  const entries = await store.listAuditLog(MAX_ENTRIES);

  // Resolve every distinct actor once rather than once per row.
  const actorIds = [
    ...new Set(
      entries
        .map((entry) => entry.actorUserId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const actorRows = await Promise.all(
    actorIds.map((id) => store.getUserById(id)),
  );
  const actors = new Map(
    actorRows
      .filter((user): user is NonNullable<typeof user> => Boolean(user))
      .map((user) => [
        user.id,
        user.displayName ??
          ([user.firstName, user.lastName].filter(Boolean).join(" ") ||
            user.email) ??
          user.id,
      ]),
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
          Audit
        </p>
        <h1 className="mt-3 font-display text-3xl leading-tight text-bone">
          Every privileged action
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Approvals, denials, role changes and agent tool calls. Append-only —
          entries are never edited or removed. Showing the most recent{" "}
          {MAX_ENTRIES} entries.
        </p>
      </header>

      {entries.length === 0 ? (
        <EmptyState
          icon={<ScrollText aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />}
          title="Nothing logged yet"
          description="Privileged actions will appear here as soon as one is taken."
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {entries.map((entry) => {
            const actor = entry.actorUserId
              ? (actors.get(entry.actorUserId) ?? "unknown actor")
              : "system";
            const hasDetail = Boolean(
              entry.before ?? entry.after ?? entry.metadata ?? entry.actorIp,
            );
            return (
              <li key={entry.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-4 p-5">
                    <Badge tone={toneFor(entry.action)} size="sm">
                      {entry.action.replace(/\./g, " ")}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-bone">{actor}</p>
                      <p className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                        {entry.targetType ?? "—"}
                        {entry.targetId ? ` · ${entry.targetId}` : ""}
                      </p>
                    </div>
                    <time
                      dateTime={entry.createdAt.toISOString()}
                      className="shrink-0 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-faint"
                    >
                      {formatTimestamp(entry.createdAt)}
                      <span className="mt-1 block normal-case tracking-normal">
                        {timeAgo(entry.createdAt)}
                      </span>
                    </time>
                  </div>

                  {hasDetail && (
                    <details className="border-t border-hairline px-5 py-4">
                      <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-gold">
                        Detail
                      </summary>
                      <div className="mt-4 grid gap-4 sm:grid-cols-3">
                        <div>
                          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-faint">
                            Before
                          </p>
                          <pre className="mt-2 overflow-x-auto rounded-md border border-hairline bg-abyss p-3 font-mono text-[11px] leading-relaxed text-code">
                            {renderDetail(entry.before)}
                          </pre>
                        </div>
                        <div>
                          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-faint">
                            After
                          </p>
                          <pre className="mt-2 overflow-x-auto rounded-md border border-hairline bg-abyss p-3 font-mono text-[11px] leading-relaxed text-code">
                            {renderDetail(entry.after)}
                          </pre>
                        </div>
                        <div>
                          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-faint">
                            Metadata
                          </p>
                          <pre className="mt-2 overflow-x-auto rounded-md border border-hairline bg-abyss p-3 font-mono text-[11px] leading-relaxed text-code">
                            {renderDetail(entry.metadata)}
                          </pre>
                        </div>
                      </div>
                      {entry.actorIp && (
                        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                          actor ip · {entry.actorIp}
                        </p>
                      )}
                    </details>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
