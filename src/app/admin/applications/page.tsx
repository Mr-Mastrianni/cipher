"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileCheck2,
  Inbox,
  Loader2,
} from "lucide-react";

import { useSound } from "@/components/providers/sound-provider";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import { cn, timeAgo } from "@/lib/utils";

/**
 * The application review queue — the console's most important screen.
 *
 * It is a client component because review is inherently interactive: rows
 * expand in place, decisions are optimistic, and the reviewer keeps their
 * position in the list. Nothing is trusted to the client for authorisation:
 * the page sits inside the gated `/admin` layout, and both the list and the
 * decision endpoints re-check `requireAdmin()` on the server.
 *
 * Keyboard contract: the whole row header is a real button (`aria-expanded` /
 * `aria-controls`), the note is a labelled textarea, and every async outcome is
 * announced through a polite live region.
 */

type Status = "pending" | "approved" | "denied" | "withdrawn";

interface ApplicationRow {
  id: string;
  userId: string;
  status: Status;
  answers: Record<string, unknown>;
  reviewedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  applicant: {
    id: string;
    displayName: string | null;
    email: string | null;
    membershipStatus: string;
    tier: string;
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

interface ListResponse {
  ok: boolean;
  items?: ApplicationRow[];
  total?: number;
  page?: number;
  totalPages?: number;
  error?: string;
}

interface DecisionResponse {
  ok: boolean;
  application?: { id: string; status: Status; decisionNote: string | null };
  tier?: string | null;
  error?: string;
}

const ANSWER_LABELS: Record<string, string> = {
  why: "Why they want in",
  whatYouMake: "What they make",
  experienceLevel: "Human Design / astrology experience",
  referral: "Referred by",
  tier: "Tier applied for",
};

const STATUS_TONE: Record<Status, "warn" | "ok" | "danger" | "neutral"> = {
  pending: "warn",
  approved: "ok",
  denied: "danger",
  withdrawn: "neutral",
};

const PAGE_SIZE = 20;

/** Render an unknown answer value without ever printing `[object Object]`. */
function renderAnswer(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function answerEntries(answers: Record<string, unknown>) {
  const preferred = Object.keys(ANSWER_LABELS);
  const seen = new Set<string>();
  const ordered: Array<[string, unknown]> = [];
  for (const key of preferred) {
    if (key in answers) {
      ordered.push([key, answers[key]]);
      seen.add(key);
    }
  }
  for (const [key, value] of Object.entries(answers)) {
    if (!seen.has(key)) ordered.push([key, value]);
  }
  return ordered;
}

export default function AdminApplicationsPage() {
  const { play } = useSound();

  const [status, setStatus] = useState<Status | "all">("pending");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  // `loading` is derived: the queue is loading until a response for the
  // current (status, page, retry) has settled.
  const [reloadToken, setReloadToken] = useState(0);
  const queryKey = `${status}|${page}|${reloadToken}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const loading = settledKey !== queryKey;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const requestRef = useRef(0);

  /* ── Load the queue ────────────────────────────────────────────────────── */

  const load = useCallback(async (key: string) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    try {
      const params = new URLSearchParams({
        status,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      const response = await fetch(`/api/applications?${params.toString()}`, {
        headers: { accept: "application/json" },
      });
      if (requestRef.current !== requestId) return;
      const data = (await response.json()) as ListResponse;
      if (!response.ok || !data.ok) {
        setLoadError(data.error ?? "The queue could not be loaded.");
        setRows([]);
        return;
      }
      const items = data.items ?? [];
      // An emptied pending page (the last rows were decided) steps back one.
      if (status === "pending" && items.length === 0 && page > 1) {
        setPage((current) => current - 1);
        return;
      }
      setLoadError(null);
      setRows(items);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      if (requestRef.current !== requestId) return;
      setLoadError("The queue could not be loaded.");
      setRows([]);
    } finally {
      if (requestRef.current === requestId) setSettledKey(key);
    }
  }, [page, status]);

  useEffect(() => {
    // False positive: `load` only sets state after its first `await`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(queryKey);
  }, [load, queryKey]);

  /* ── Optimistic decision ───────────────────────────────────────────────── */

  const decide = useCallback(
    async (row: ApplicationRow, decision: "approve" | "deny") => {
      const previous = rows;
      const optimisticStatus: Status = decision === "approve" ? "approved" : "denied";
      const note = notes[row.id]?.trim() ?? "";

      setBusyId(row.id);
      setActionError(null);
      setRows((current) =>
        current.map((item) =>
          item.id === row.id
            ? {
                ...item,
                status: optimisticStatus,
                decisionNote: note || item.decisionNote,
              }
            : item,
        ),
      );
      play(decision === "approve" ? "confirm" : "tick");

      try {
        const response = await fetch(`/api/applications/${row.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision, note: note || undefined }),
        });
        const data = (await response.json()) as DecisionResponse;
        if (!response.ok || !data.ok || !data.application) {
          setRows(previous);
          const message = data.error ?? "The decision could not be saved.";
          setActionError(message);
          setAnnouncement(`Error. ${message}`);
          play("error");
          return;
        }
        setRows((current) =>
          current.map((item) =>
            item.id === row.id
              ? {
                  ...item,
                  status: data.application?.status ?? optimisticStatus,
                  decisionNote: data.application?.decisionNote ?? (note || null),
                  reviewedAt: new Date().toISOString(),
                }
              : item,
          ),
        );
        setAnnouncement(
          decision === "approve"
            ? "Application approved. The member has been placed."
            : "Application denied.",
        );
        // A pending row no longer belongs in the pending queue.
        if (status === "pending") {
          setRows((current) => current.filter((item) => item.id !== row.id));
          setTotal((current) => Math.max(0, current - 1));
          if (previous.every((item) => item.id === row.id) && page > 1) {
            setPage((current) => current - 1);
          }
        }
        setExpandedId(null);
        play("success");
      } catch {
        setRows(previous);
        setActionError("The decision could not be saved.");
        setAnnouncement("Error. The decision could not be saved.");
        play("error");
      } finally {
        setBusyId(null);
      }
    },
    [notes, page, play, rows, status],
  );

  const pendingCount = useMemo(
    () => rows.filter((row) => row.status === "pending").length,
    [rows],
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
            Applications
          </p>
          <h1 className="mt-3 font-display text-3xl leading-tight text-bone">
            The review queue
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            Expand a row to read the full application and the applicant&apos;s
            chart. Approving sets the tier they applied for and places them in
            their cohort channels.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <Field label="Filter by status" className="w-48">
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as Status | "all");
                setPage(1);
              }}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="denied">Denied</option>
              <option value="withdrawn">Withdrawn</option>
              <option value="all">All</option>
            </Select>
          </Field>
          <p className="pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
            {total} total
            {status === "all" ? "" : ` · ${pendingCount} on this page`}
          </p>
        </div>
      </header>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {actionError && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0"
            strokeWidth={1.5}
          />
          {actionError}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-muted">
          <Spinner />
          <span className="font-mono text-[10px] uppercase tracking-[0.24em]">
            Loading the queue
          </span>
        </div>
      ) : loadError ? (
        <EmptyState
          icon={<CircleAlert aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />}
          title="The queue could not be loaded"
          description={loadError}
          action={<Button onClick={() => setReloadToken((token) => token + 1)}>Try again</Button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Inbox aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />}
          title={status === "pending" ? "Nothing waiting" : "No applications here"}
          description={
            status === "pending"
              ? "Every application has been decided. New ones will appear here."
              : "Try a different status filter."
          }
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => {
            const open = expandedId === row.id;
            const name = row.applicant?.displayName ?? "Unknown applicant";
            const detailsId = `application-${row.id}`;
            const busy = busyId === row.id;

            return (
              <li key={row.id}>
                <Card className={cn(open && "border-gold/30")}>
                  <div className="flex flex-wrap items-start gap-4 p-5">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={detailsId}
                      onClick={() => {
                        play("select");
                        setExpandedId(open ? null : row.id);
                      }}
                      className="flex min-w-0 flex-1 items-start gap-3 rounded-md text-left focus-visible:ring-2 focus-visible:ring-gold"
                    >
                      <ChevronDown
                        aria-hidden="true"
                        strokeWidth={1.5}
                        className={cn(
                          "mt-1 h-4 w-4 shrink-0 text-muted transition-transform",
                          open && "rotate-180",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-lg tracking-wide text-bone">
                            {name}
                          </span>
                          <Badge tone={STATUS_TONE[row.status]} size="sm">
                            {row.status}
                          </Badge>
                          {row.chart?.auraLabel && (
                            <Badge tone="purple" size="sm">
                              {row.chart.auraLabel}
                            </Badge>
                          )}
                        </span>
                        <span className="mt-1 block truncate text-sm text-muted">
                          {row.applicant?.email ?? "no email on file"}
                        </span>
                        <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                          applied {timeAgo(row.createdAt)}
                          {row.chart?.type ? ` · ${row.chart.type}` : ""}
                          {row.chart?.profile ? ` · ${row.chart.profile}` : ""}
                        </span>
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      {row.status === "pending" ? (
                        <>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busy}
                            onClick={() => void decide(row, "deny")}
                            aria-label={`Deny ${name}`}
                          >
                            Deny
                          </Button>
                          <Button
                            size="sm"
                            loading={busy}
                            onClick={() => void decide(row, "approve")}
                            aria-label={`Approve ${name}`}
                          >
                            Approve
                          </Button>
                        </>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                          decided {row.reviewedAt ? timeAgo(row.reviewedAt) : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {open && (
                    <div
                      id={detailsId}
                      className="border-t border-hairline px-5 pb-6 pt-5"
                    >
                      <div className="grid gap-8 lg:grid-cols-2">
                        <section aria-labelledby={`${detailsId}-answers`}>
                          <h3
                            id={`${detailsId}-answers`}
                            className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold"
                          >
                            The application
                          </h3>
                          <dl className="mt-4 flex flex-col gap-4">
                            {answerEntries(row.answers).map(([key, value]) => (
                              <div key={key}>
                                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-faint">
                                  {ANSWER_LABELS[key] ?? key}
                                </dt>
                                <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-bone">
                                  {renderAnswer(value)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </section>

                        <section aria-labelledby={`${detailsId}-chart`}>
                          <h3
                            id={`${detailsId}-chart`}
                            className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold"
                          >
                            The chart
                          </h3>
                          {row.chart ? (
                            <dl className="mt-4 grid grid-cols-2 gap-4">
                              <div>
                                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-faint">
                                  Type
                                </dt>
                                <dd className="mt-1 text-sm text-bone">
                                  {row.chart.type ?? "—"}
                                </dd>
                              </div>
                              <div>
                                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-faint">
                                  Profile
                                </dt>
                                <dd className="mt-1 text-sm text-bone">
                                  {row.chart.profile ?? "—"}
                                </dd>
                              </div>
                              <div>
                                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-faint">
                                  Authority
                                </dt>
                                <dd className="mt-1 text-sm text-bone">
                                  {row.chart.authority ?? "—"}
                                </dd>
                              </div>
                              <div>
                                <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-faint">
                                  Aura Avatar
                                </dt>
                                <dd className="mt-1 text-sm text-bone">
                                  {row.chart.auraLabel ||
                                    `${row.chart.auraSeat} ${row.chart.auraFormat}`.trim() ||
                                    "—"}
                                </dd>
                              </div>
                            </dl>
                          ) : (
                            <p className="mt-4 text-sm leading-relaxed text-muted">
                              No birth profile on file yet. The applicant has not
                              completed onboarding, so there is no chart to read.
                            </p>
                          )}

                          {row.status === "pending" && (
                            <div className="mt-6 flex flex-col gap-4">
                              <Field
                                label="Decision note (optional)"
                                description="Stored on the application and shown to the applicant."
                              >
                                <Textarea
                                  value={notes[row.id] ?? ""}
                                  onChange={(event) =>
                                    setNotes((current) => ({
                                      ...current,
                                      [row.id]: event.target.value,
                                    }))
                                  }
                                  maxLength={2000}
                                  rows={3}
                                />
                              </Field>
                              <div className="flex flex-wrap gap-3">
                                <Button
                                  loading={busy}
                                  onClick={() => void decide(row, "approve")}
                                  iconLeft={<FileCheck2 className="h-3.5 w-3.5" strokeWidth={1.5} />}
                                >
                                  Approve and grant tier
                                </Button>
                                <Button
                                  variant="danger"
                                  disabled={busy}
                                  onClick={() => void decide(row, "deny")}
                                >
                                  Deny
                                </Button>
                              </div>
                            </div>
                          )}

                          {row.decisionNote && (
                            <p className="mt-5 rounded-md border border-hairline bg-raised/60 px-4 py-3 text-sm leading-relaxed text-muted">
                              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-faint">
                                Note ·{" "}
                              </span>
                              {row.decisionNote}
                            </p>
                          )}
                        </section>
                      </div>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Application pages"
          className="flex items-center justify-between gap-4"
        >
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            iconLeft={<ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />}
          >
            Previous
          </Button>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
            Page {page} of {totalPages}
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            iconRight={<ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />}
          >
            Next
          </Button>
        </nav>
      )}

      {loading && rows.length > 0 && (
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
          <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
          Refreshing
        </p>
      )}
    </div>
  );
}
