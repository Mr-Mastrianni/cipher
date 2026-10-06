"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  CircleAlert,
  MessageCircle,
  Pencil,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Input, Textarea } from "@/components/ui/input";
import { useSound } from "@/components/providers/sound-provider";
import { cn, timeAgo, uid } from "@/lib/utils";

/**
 * Direct messages.
 *
 * A thread list and a conversation pane. Threads are created through
 * `findOrCreateDirectThread` (exposed as `POST /api/messages/threads`), history
 * comes from `listDirectMessages` (`GET /api/messages/threads/[id]`), and the
 * member picker searches `store.listUsers` through the same endpoint's `?q=`.
 *
 * Polling, not realtime: no realtime provider is configured, and the brief does
 * not require one, so the open conversation is refetched every five seconds and
 * merged by id. See the community channel page for the same trade-off.
 */

/** How often the open conversation is refetched, in milliseconds. */
const POLL_INTERVAL_MS = 5000;

interface MemberSummary {
  id: string;
  name: string;
  imageUrl: string | null;
  tier: string;
}

interface ThreadSummary {
  id: string;
  other: MemberSummary;
  lastMessage: { id: string; body: string; createdAt: string; authorId: string } | null;
  lastMessageAt: string | null;
}

interface WireMessage {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  author: { id: string; name: string; imageUrl: string | null };
}

/** Merge incoming rows over existing ones by id, oldest first. */
function mergeMessages(existing: WireMessage[], incoming: WireMessage[]): WireMessage[] {
  const byId = new Map(existing.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => {
    const delta = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return delta !== 0 ? delta : a.id.localeCompare(b.id);
  });
}

/** A full timestamp for the `title` attribute. */
function fullStamp(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

/**
 * The messages page.
 *
 * @returns The thread list, member picker and conversation pane.
 */
export default function MessagesPage() {
  const { play } = useSound();
  const reduced = useReducedMotion();

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WireMessage[]>([]);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [starting, setStarting] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const seen = useRef<Set<string>>(new Set());
  const hydrated = useRef(false);
  const meIdRef = useRef<string | null>(null);
  // The thread whose messages are on screen; responses for any other thread
  // (a slow fetch or poll from before a switch) are dropped.
  const activeIdRef = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const atBottom = useRef(true);

  const activeThread = threads.find((thread) => thread.id === activeId) ?? null;

  /** Switch conversations, clearing the previous one's messages first. */
  const selectThread = useCallback((threadId: string) => {
    if (activeIdRef.current === threadId) return;
    activeIdRef.current = threadId;
    setMessages([]);
    setLoadingConversation(true);
    setActiveId(threadId);
  }, []);

  /* ── Thread list ───────────────────────────────────────────────────────── */

  const loadThreads = useCallback(
    async (selectFirst: boolean) => {
      try {
        const response = await fetch("/api/messages/threads", { cache: "no-store" });
        const data = (await response.json()) as {
          ok: boolean;
          me?: { id: string; name: string };
          threads?: ThreadSummary[];
          error?: string;
        };
        if (!response.ok || !data.ok) {
          setError(data.error ?? "Conversations could not be loaded.");
          return;
        }
        if (data.me) {
          setMe(data.me);
          meIdRef.current = data.me.id;
        }
        const rows = data.threads ?? [];
        setThreads(rows);
        if (selectFirst && rows.length > 0 && activeIdRef.current === null) {
          selectThread(rows[0].id);
        }
      } catch {
        setError("Conversations could not be loaded.");
      } finally {
        setLoadingThreads(false);
      }
    },
    [selectThread],
  );

  useEffect(() => {
    // False positive: `loadThreads` only sets state after its first `await`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadThreads(true);
  }, [loadThreads]);

  /* ── Conversation ──────────────────────────────────────────────────────── */

  const applyIncoming = useCallback(
    (incoming: WireMessage[]) => {
      let hasNewFromOthers = false;
      for (const message of incoming) {
        if (seen.current.has(message.id)) continue;
        seen.current.add(message.id);
        if (hydrated.current && meIdRef.current && message.authorId !== meIdRef.current) {
          hasNewFromOthers = true;
        }
      }
      setMessages((previous) => mergeMessages(previous, incoming));
      if (hasNewFromOthers) {
        play("message");
        setAnnouncement("New direct message.");
      }
    },
    [play],
  );

  const loadConversation = useCallback(
    async (threadId: string) => {
      try {
        const response = await fetch(`/api/messages/threads/${threadId}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          ok: boolean;
          me?: { id: string; name: string };
          other?: MemberSummary;
          messages?: WireMessage[];
          error?: string;
        };
        if (threadId !== activeIdRef.current) return;
        if (!response.ok || !data.ok) {
          setError(data.error ?? "That conversation could not be opened.");
          return;
        }
        if (data.me) {
          setMe(data.me);
          meIdRef.current = data.me.id;
        }
        if (data.other) {
          setThreads((previous) =>
            previous.map((thread) =>
              thread.id === threadId ? { ...thread, other: data.other as MemberSummary } : thread,
            ),
          );
        }
        if (data.messages) applyIncoming(data.messages);
      } catch {
        setError("That conversation could not be opened.");
      }
    },
    [applyIncoming],
  );

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    seen.current = new Set();
    hydrated.current = false;
    // False positive: `loadConversation` only sets state after its first `await`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConversation(activeId).finally(() => {
      if (!cancelled) {
        hydrated.current = true;
        setLoadingConversation(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeId, loadConversation]);

  /* ── Polling ───────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    const tick = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (cancelled) return;
      await loadConversation(activeId);
    };
    const id = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeId, loadConversation]);

  /* ── Member picker ─────────────────────────────────────────────────────── */

  useEffect(() => {
    const term = query.trim();
    // An empty query renders the search prompt, not the member list.
    if (term.length === 0) return;
    const id = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/messages/threads?q=${encodeURIComponent(term)}`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as { ok: boolean; members?: MemberSummary[] };
        if (data.ok) setMembers(data.members ?? []);
      } catch {
        setMembers([]);
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [query]);

  const startConversation = async (member: MemberSummary) => {
    setStarting(true);
    try {
      const response = await fetch("/api/messages/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.id }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        threadId?: string;
        other?: MemberSummary;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.threadId) {
        setError(data.error ?? "That conversation could not be started.");
        play("error");
        return;
      }
      const threadId = data.threadId;
      setThreads((previous) => {
        if (previous.some((thread) => thread.id === threadId)) return previous;
        return [
          {
            id: threadId,
            other: data.other ?? member,
            lastMessage: null,
            lastMessageAt: new Date().toISOString(),
          },
          ...previous,
        ];
      });
      selectThread(threadId);
      setPickerOpen(false);
      setQuery("");
      setMembers([]);
      setAnnouncement(`Conversation with ${member.name} opened.`);
      play("join");
    } catch {
      setError("That conversation could not be started.");
      play("error");
    } finally {
      setStarting(false);
    }
  };

  // Arriving from cosmic matching with `?with=<memberId>` opens that
  // conversation once. The URL is read directly (not via useSearchParams) so
  // the page needs no Suspense boundary.
  const openedFromLink = useRef(false);
  useEffect(() => {
    if (openedFromLink.current) return;
    const target = new URLSearchParams(window.location.search).get("with");
    if (!target) return;
    openedFromLink.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    void Promise.resolve().then(() =>
      startConversation({ id: target, name: "member", imageUrl: null, tier: "" }),
    );
    // startConversation is stable for this purpose; run once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Scroll ────────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!atBottom.current) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  /* ── Actions ───────────────────────────────────────────────────────────── */

  const send = async () => {
    const body = draft.trim();
    if (!body || !activeId || !me || sending) return;
    const tempId = `pending-${uid("dm")}`;
    const optimistic: WireMessage = {
      id: tempId,
      authorId: me.id,
      body,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      author: { id: me.id, name: me.name, imageUrl: null },
    };
    setMessages((previous) => mergeMessages(previous, [optimistic]));
    setDraft("");
    setSending(true);
    setAnnouncement("Sending message.");
    try {
      const response = await fetch(`/api/messages/threads/${activeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: WireMessage;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.message) {
        setMessages((previous) => previous.filter((message) => message.id !== tempId));
        setDraft(body);
        setError(data.error ?? "The message did not send.");
        play("error");
        return;
      }
      seen.current.add(data.message.id);
      setMessages((previous) =>
        mergeMessages(
          previous.filter((message) => message.id !== tempId),
          [data.message as WireMessage],
        ),
      );
      void loadThreads(false);
      setAnnouncement("Message sent.");
      play("confirm");
    } catch {
      setMessages((previous) => previous.filter((message) => message.id !== tempId));
      setDraft(body);
      setError("The message did not send.");
      play("error");
    } finally {
      setSending(false);
    }
  };

  const saveEdit = async (id: string) => {
    const body = editDraft.trim();
    if (!body) return;
    try {
      const response = await fetch(`/api/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: { id: string; body: string; editedAt: string | null };
        error?: string;
      };
      if (!response.ok || !data.ok || !data.message) {
        setError(data.error ?? "The edit was not saved.");
        play("error");
        return;
      }
      const updated = data.message;
      setMessages((previous) =>
        previous.map((message) =>
          message.id === id
            ? { ...message, body: updated.body, editedAt: updated.editedAt }
            : message,
        ),
      );
      setEditingId(null);
      setEditDraft("");
      setAnnouncement("Message updated.");
      play("confirm");
    } catch {
      setError("The edit was not saved.");
      play("error");
    }
  };

  const remove = async (message: WireMessage) => {
    try {
      const response = await fetch(`/api/messages/${message.id}`, { method: "DELETE" });
      if (!response.ok) {
        setError("The message could not be removed.");
        play("error");
        return;
      }
      setMessages((previous) =>
        previous.map((item) =>
          item.id === message.id ? { ...item, deletedAt: new Date().toISOString() } : item,
        ),
      );
      setAnnouncement("Message removed.");
      play("confirm");
    } catch {
      setError("The message could not be removed.");
      play("error");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-6">
        <div>
          <h1 className="font-display text-3xl text-bone">Messages</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Direct conversations, member to member. Polling keeps the thread
            fresh within about five seconds.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setPickerOpen((open) => !open);
            play("select");
          }}
          aria-expanded={pickerOpen}
        >
          <MessageCircle aria-hidden="true" className="h-4 w-4" />
          New conversation
        </Button>
      </header>

      {pickerOpen ? (
        <section aria-labelledby="picker-heading" className="surface rounded-lg p-4">
          <h2 id="picker-heading" className="font-display text-lg text-bone">
            Start a conversation
          </h2>
          <div className="mt-3">
            <label htmlFor="member-search" className="sr-only">
              Search members by name or email
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
              />
              <Input
                id="member-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search members…"
                className="pl-9"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="mt-3" aria-live="polite">
            {query.trim().length === 0 ? (
              <p className="text-sm text-muted">
                Type a name or email to search approved members.
              </p>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted">No members match that search.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {members.map((member) => (
                  <li key={member.id}>
                    <button
                      type="button"
                      onClick={() => void startConversation(member)}
                      disabled={starting}
                      className="flex w-full items-center justify-between gap-3 rounded-md border border-hairline px-3 py-2 text-left transition-colors hover:border-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50"
                    >
                      <span className="text-sm text-bone">{member.name}</span>
                      <Badge tone="neutral" size="sm">
                        {member.tier}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Thread list ------------------------------------------------------ */}
        <section aria-labelledby="threads-heading" className="surface rounded-lg p-3">
          <h2
            id="threads-heading"
            className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-faint"
          >
            Conversations
          </h2>
          {loadingThreads ? (
            <div className="flex items-center gap-2 px-2 py-4 text-sm text-muted">
              <Spinner size="sm" label="Loading conversations" /> Loading…
            </div>
          ) : threads.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted">
              No conversations yet. Start one from the picker above.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {threads.map((thread) => {
                const active = thread.id === activeId;
                return (
                  <li key={thread.id}>
                    <button
                      type="button"
                      onClick={() => {
                        selectThread(thread.id);
                        play("select");
                      }}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "w-full rounded-md px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                        active ? "bg-raised text-gold" : "text-muted hover:bg-raised hover:text-bone",
                      )}
                    >
                      <span className="block text-sm">{thread.other.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-faint">
                        {thread.lastMessage
                          ? thread.lastMessage.body || "Removed message"
                          : "No messages yet"}
                      </span>
                      {thread.lastMessageAt ? (
                        <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
                          {timeAgo(thread.lastMessageAt)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Conversation ----------------------------------------------------- */}
        <section aria-labelledby="conversation-heading" className="flex flex-col gap-4">
          <h2 id="conversation-heading" className="sr-only">
            Conversation
          </h2>

          {!activeId ? (
            <EmptyState
              icon={<MessageCircle className="h-5 w-5" />}
              title="Pick a conversation"
              description="Choose a thread on the left, or start a new one with a member."
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-xl text-bone">
                  {activeThread?.other.name ?? "Conversation"}
                </p>
                <Link
                  href="/dashboard/community"
                  className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted hover:text-gold"
                >
                  Community
                </Link>
              </div>

              <div
                onScroll={(event) => {
                  const el = event.currentTarget;
                  atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                }}
                className="max-h-[48vh] min-h-[16rem] overflow-y-auto rounded-lg border border-hairline bg-ink/60 p-4"
                aria-busy={sending}
              >
                {loadingConversation && messages.length === 0 ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-muted">
                    <Spinner size="sm" label="Loading conversation" /> Loading…
                  </div>
                ) : messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted">
                    No messages yet. Say hello.
                  </p>
                ) : (
                  <div
                    role="log"
                    aria-live="polite"
                    aria-relevant="additions text"
                    aria-label={`Conversation with ${activeThread?.other.name ?? "member"}`}
                  >
                    <ul className="flex flex-col gap-4">
                      {messages.map((message) => {
                        const mine = me !== null && message.authorId === me.id;
                        const pending = message.id.startsWith("pending-");
                        const removed = message.deletedAt !== null;
                        return (
                          <motion.li
                            key={message.id}
                            initial={reduced ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              duration: reduced ? 0 : 0.28,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className={cn(
                              "surface rounded-lg p-4",
                              mine ? "border-gold/30" : "",
                              pending && "opacity-60",
                            )}
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="text-sm">
                                <span
                                  className={cn("font-medium", mine ? "text-gold" : "text-bone")}
                                >
                                  {message.author.name}
                                </span>
                              </p>
                              <div className="flex items-center gap-2">
                                <time
                                  dateTime={message.createdAt}
                                  title={fullStamp(message.createdAt)}
                                  className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint"
                                >
                                  {pending ? "sending…" : timeAgo(message.createdAt)}
                                  {message.editedAt ? " · edited" : ""}
                                </time>
                                {mine && !pending && !removed ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingId(message.id);
                                      setEditDraft(message.body);
                                      play("select");
                                    }}
                                    className="rounded p-1 text-faint hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                                    aria-label="Edit your message"
                                  >
                                    <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                                  </button>
                                ) : null}
                                {mine && !pending && !removed ? (
                                  <button
                                    type="button"
                                    onClick={() => void remove(message)}
                                    className="rounded p-1 text-faint hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                                    aria-label="Delete this message"
                                  >
                                    <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                                  </button>
                                ) : null}
                              </div>
                            </div>

                            {removed ? (
                              <p className="mt-2 text-sm italic text-faint">
                                This message was removed.
                              </p>
                            ) : editingId === message.id ? (
                              <form
                                className="mt-3 flex flex-col gap-2"
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  void saveEdit(message.id);
                                }}
                              >
                                <label className="sr-only" htmlFor={`dm-edit-${message.id}`}>
                                  Edit your message
                                </label>
                                <Textarea
                                  id={`dm-edit-${message.id}`}
                                  value={editDraft}
                                  rows={3}
                                  maxLength={4000}
                                  onChange={(event) => setEditDraft(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      setEditingId(null);
                                      setEditDraft("");
                                      play("tick");
                                    }
                                  }}
                                />
                                <div className="flex gap-2">
                                  <Button type="submit" size="sm" variant="primary">
                                    Save
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditDraft("");
                                      play("tick");
                                    }}
                                  >
                                    <X aria-hidden="true" className="h-4 w-4" />
                                    Cancel
                                  </Button>
                                </div>
                              </form>
                            ) : (
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-bone">
                                {message.body}
                              </p>
                            )}
                          </motion.li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              <form
                className="flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
              >
                <label htmlFor="dm-composer" className="text-sm text-muted">
                  Write to {activeThread?.other.name ?? "this member"}
                </label>
                <Textarea
                  id="dm-composer"
                  value={draft}
                  rows={3}
                  maxLength={4000}
                  placeholder="Keep it specific."
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                    {draft.length}/4000 · Ctrl/⌘ + Enter to send
                  </p>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={sending}
                    disabled={!draft.trim()}
                  >
                    <Send aria-hidden="true" className="h-4 w-4" />
                    Send
                  </Button>
                </div>
              </form>
            </>
          )}

          {error ? (
            <p className="flex items-center gap-2 text-sm text-danger" role="status">
              <CircleAlert aria-hidden="true" className="h-4 w-4" />
              {error}
            </p>
          ) : null}
          <p aria-live="polite" className="min-h-5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {announcement}
          </p>

          <Link
            href="/dashboard"
            className="inline-flex w-fit items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted hover:text-gold"
          >
            <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
            Back to overview
          </Link>
        </section>
      </div>
    </div>
  );
}
