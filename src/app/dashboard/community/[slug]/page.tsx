"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  CircleAlert,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/input";
import { useSound } from "@/components/providers/sound-provider";
import { cn, timeAgo, uid } from "@/lib/utils";

/**
 * A single community channel.
 *
 * ## Why polling
 *
 * No realtime provider is configured in this deployment (no WebSocket service,
 * no Pusher/Ably key, no database-backed LISTEN/NOTIFY), and the brief explicitly
 * does not require realtime. The stream therefore polls `GET
 * /api/community/[slug]/messages` every five seconds and merges by id. That
 * keeps the transport to plain HTTP, works identically on the in-memory demo
 * store and on Postgres, and costs one small request per open channel. The
 * trade-off is up to five seconds of latency, which the `role="log"` live region
 * makes legible rather than silent.
 */

/** How often the channel stream is refetched, in milliseconds. */
const POLL_INTERVAL_MS = 5000;

interface ChannelInfo {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: string;
  tierRequired: string | null;
}

interface WireMessage {
  id: string;
  channelId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  author: { id: string; name: string; imageUrl: string | null };
}

interface Payload {
  ok: boolean;
  error?: string;
  channel?: ChannelInfo;
  me?: { id: string; name: string; role: string };
  messages?: WireMessage[];
  nextCursor?: string | null;
}

/** Sort oldest-first, then merge incoming rows over existing ones by id. */
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
 * The channel page.
 *
 * @returns The message stream, composer, and edit controls.
 */
export default function ChannelPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const { play } = useSound();
  const reduced = useReducedMotion();

  const [channel, setChannel] = useState<ChannelInfo | null>(null);
  const [me, setMe] = useState<{ id: string; name: string; role: string } | null>(null);
  const [messages, setMessages] = useState<WireMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  const seen = useRef<Set<string>>(new Set());
  const hydrated = useRef(false);
  const meIdRef = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const atBottom = useRef(true);
  const [announcement, setAnnouncement] = useState("");

  /** Merge a page of messages and fire the new-message cue when appropriate. */
  const applyIncoming = useCallback(
    (incoming: WireMessage[]) => {
      let hasNewFromOthers = false;
      for (const message of incoming) {
        if (seen.current.has(message.id)) continue;
        seen.current.add(message.id);
        if (hydrated.current && meIdRef.current && message.author.id !== meIdRef.current) {
          hasNewFromOthers = true;
        }
      }
      setMessages((previous) => mergeMessages(previous, incoming));
      if (hasNewFromOthers) {
        play("message");
        setAnnouncement("New message received.");
      }
    },
    [play],
  );

  const handlePayload = useCallback(
    (data: Payload) => {
      if (data.channel) setChannel(data.channel);
      if (data.me) {
        setMe(data.me);
        meIdRef.current = data.me.id;
      }
      if (data.messages) applyIncoming(data.messages);
      if (data.nextCursor !== undefined) setNextCursor(data.nextCursor);
      setStatus("ready");
    },
    [applyIncoming],
  );

  /* ── Initial load ──────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/community/${slug}/messages`, {
          cache: "no-store",
        });
        const data = (await response.json()) as Payload;
        if (cancelled) return;
        if (!response.ok || !data.ok) {
          setError(data.error ?? "This channel could not be opened.");
          setStatus("error");
          play("error");
          return;
        }
        handlePayload(data);
        hydrated.current = true;
      } catch {
        if (cancelled) return;
        setError("This channel could not be opened.");
        setStatus("error");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, handlePayload, play]);

  /* ── Polling ───────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!slug || status !== "ready") return;
    let cancelled = false;
    const tick = async () => {
      // Do not poll while the tab is hidden; there is nobody to read it.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const response = await fetch(`/api/community/${slug}/messages`, {
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as Payload;
        if (cancelled || !data.ok) return;
        handlePayload(data);
      } catch {
        /* a dropped poll is not worth surfacing; the next one will catch up */
      }
    };
    const id = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [slug, status, handlePayload]);

  /* ── Scroll management ─────────────────────────────────────────────────── */

  useEffect(() => {
    if (!atBottom.current) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  /* ── Actions ───────────────────────────────────────────────────────────── */

  const send = async () => {
    const body = draft.trim();
    if (!body || !me || sending) return;
    const tempId = `pending-${uid("m")}`;
    const optimistic: WireMessage = {
      id: tempId,
      channelId: channel?.id ?? "",
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
      const response = await fetch(`/api/community/${slug}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await response.json()) as { ok: boolean; message?: WireMessage; error?: string };
      if (!response.ok || !data.ok || !data.message) {
        setMessages((previous) => previous.filter((message) => message.id !== tempId));
        setDraft(body);
        setError(data.error ?? "The message did not send.");
        setAnnouncement(data.error ?? "The message did not send.");
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
      setAnnouncement("Message sent.");
      play("confirm");
    } catch {
      setMessages((previous) => previous.filter((message) => message.id !== tempId));
      setDraft(body);
      setError("The message did not send.");
      setAnnouncement("The message did not send.");
      play("error");
    } finally {
      setSending(false);
    }
  };

  const startEdit = (message: WireMessage) => {
    setEditingId(message.id);
    setEditDraft(message.body);
    play("select");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
    play("tick");
  };

  const saveEdit = async (id: string) => {
    const body = editDraft.trim();
    if (!body) return;
    try {
      const response = await fetch(`/api/community/messages/${id}`, {
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
      const response = await fetch(`/api/community/messages/${message.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError("The message could not be removed.");
        play("error");
        return;
      }
      setMessages((previous) =>
        previous.map((item) =>
          item.id === message.id
            ? { ...item, deletedAt: new Date().toISOString(), body: "" }
            : item,
        ),
      );
      setAnnouncement("Message removed.");
      play("confirm");
    } catch {
      setError("The message could not be removed.");
      play("error");
    }
  };

  const loadEarlier = async () => {
    if (!nextCursor || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const response = await fetch(
        `/api/community/${slug}/messages?cursor=${encodeURIComponent(nextCursor)}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const data = (await response.json()) as Payload;
      if (!data.ok || !data.messages) return;
      for (const message of data.messages) seen.current.add(message.id);
      setMessages((previous) => mergeMessages(previous, data.messages ?? []));
      setNextCursor(data.nextCursor ?? null);
      play("advance");
    } finally {
      setLoadingEarlier(false);
    }
  };

  const visible = messages;

  if (status === "error") {
    return (
      <div className="flex flex-col gap-6">
        <EmptyState
          icon={<CircleAlert className="h-5 w-5" />}
          title="This channel is not available"
          description={error ?? "It may not exist, or your tier may not include it yet."}
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/community">Back to channels</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 border-b border-hairline pb-6">
        <Link
          href="/dashboard/community"
          className="inline-flex w-fit items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted hover:text-gold"
        >
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
          All channels
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-bone">
              {channel?.name ?? `#${slug}`}
            </h1>
            {channel?.description ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                {channel.description}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {channel?.kind === "private" ? (
              <Badge tone="neutral" size="sm">
                Private
              </Badge>
            ) : null}
            {channel?.tierRequired ? (
              <Badge tone="warn" size="sm">
                {channel.tierRequired}
              </Badge>
            ) : null}
            <Badge tone="info" size="sm">
              Live in ~5s
            </Badge>
          </div>
        </div>
      </header>

      {nextCursor ? (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loadEarlier()}
            loading={loadingEarlier}
          >
            Load earlier messages
          </Button>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="max-h-[52vh] overflow-y-auto rounded-lg border border-hairline bg-ink/60 p-4"
        aria-busy={sending}
      >
        {status === "loading" ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted">
            <Spinner size="sm" label="Loading messages" /> Loading the room…
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title="No messages yet"
            description="Say hello. Short, specific and kind is the house style."
          />
        ) : (
          <div role="log" aria-live="polite" aria-relevant="additions text" aria-label={`Messages in ${channel?.name ?? slug}`}>
            <ul className="flex flex-col gap-4">
              {visible.map((message) => {
                const mine = me !== null && message.author.id === me.id;
                const canDelete = mine || me?.role === "admin";
                const pending = message.id.startsWith("pending-");
                const removed = message.deletedAt !== null;
                return (
                  <motion.li
                    key={message.id}
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduced ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      "surface rounded-lg p-4",
                      pending && "opacity-60",
                    )}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm">
                        <span className={cn("font-medium", mine ? "text-gold" : "text-bone")}>
                          {message.author.name}
                        </span>
                        {mine ? (
                          <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
                            you
                          </span>
                        ) : null}
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
                            onClick={() => startEdit(message)}
                            className="rounded p-1 text-faint hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                            aria-label="Edit your message"
                          >
                            <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        {canDelete && !pending && !removed ? (
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
                        <label className="sr-only" htmlFor={`edit-${message.id}`}>
                          Edit your message
                        </label>
                        <Textarea
                          id={`edit-${message.id}`}
                          value={editDraft}
                          rows={3}
                          maxLength={4000}
                          onChange={(event) => setEditDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault();
                              cancelEdit();
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
                            onClick={cancelEdit}
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
        <label htmlFor="channel-composer" className="text-sm text-muted">
          Write to {channel?.name ?? `#${slug}`}
        </label>
        <Textarea
          id="channel-composer"
          value={draft}
          rows={3}
          maxLength={4000}
          placeholder="Say something specific."
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Cmd/Ctrl+Enter sends without leaving the keyboard.
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
          <Button type="submit" variant="primary" size="sm" loading={sending} disabled={!draft.trim()}>
            <Send aria-hidden="true" className="h-4 w-4" />
            Send
          </Button>
        </div>
      </form>

      <p
        aria-live="polite"
        className="min-h-5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted"
      >
        {announcement}
        {error ? ` · ${error}` : ""}
      </p>
    </div>
  );
}
