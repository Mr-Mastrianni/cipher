"use client";

/**
 * The Cipher — admin agent console.
 *
 * A full transcript with streamed tokens, a tool-call timeline that shows each
 * tool's arguments and result, a session list, voice in and out, and an
 * explicit read-only/write indicator.
 *
 * The console talks to a newline-delimited JSON stream, so tokens render as
 * they arrive and every tool call surfaces as a structured event rather than
 * being hidden inside a spinner. Nothing in this component decides what the
 * agent may do: the server owns the allowlist, the audit trail, and the
 * confirmation requirement for destructive tools. The UI only renders what the
 * server reports and can echo a confirmation token back.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  AlertTriangle,
  Ban,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleSlash,
  Database,
  FileText,
  GitPullRequest,
  Globe,
  Loader2,
  MessageSquarePlus,
  Mic,
  Send,
  ShieldCheck,
  Square,
  Terminal,
  Trash2,
  Wrench,
  XCircle,
} from "lucide-react";

import {
  AgentVoice,
  type AgentVoiceMode,
} from "@/components/admin/agent-voice";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Spinner,
  Textarea,
} from "@/components/ui";
import { useSound } from "@/components/providers/sound-provider";
import { cn, timeAgo, uid } from "@/lib/utils";
import type { AgentStreamEvent } from "@/lib/agent/runner";

/* ────────────────────────────────────────────────────────────────────────────
 * Local view models
 * ──────────────────────────────────────────────────────────────────────────── */

/** A tool call as persisted with an assistant message. */
interface StoredToolCall {
  /** Provider call id. */
  id: string;
  /** Tool name. */
  name: string;
  /** Arguments the model supplied. */
  arguments: Record<string, unknown>;
  /** Result payload, when the tool completed. */
  result?: unknown;
  /** Outcome. */
  status: "pending" | "success" | "error";
  /** Failure summary, when there was one. */
  error?: string;
}

/** A rendered transcript row. */
interface TranscriptMessage {
  /** Stable id. */
  id: string;
  /** Who produced the message. */
  role: "user" | "assistant" | "system" | "tool";
  /** Text body. */
  content: string;
  /** Tool calls attached to an assistant turn. */
  toolCalls?: StoredToolCall[] | null;
  /** Local echo that is not yet persisted. */
  local?: boolean;
}

/** A session row in the sidebar. */
interface SessionSummary {
  /** Session uuid. */
  id: string;
  /** Operator-visible title. */
  title: string;
  /** `active` or `archived`. */
  status: string;
  /** Model id the session was opened with. */
  model: string | null;
  /** ISO creation time. */
  createdAt: string;
  /** ISO last-update time. */
  updatedAt: string;
}

/** The deployment's agent capability snapshot. */
interface AgentStatus {
  /** Whether a model key is present. */
  configured: boolean;
  /** Whether write tools are exposed. */
  mode: "read-only" | "write";
  /** Model id, or null. */
  model: string | null;
  /** Tool names available. */
  tools: string[];
  /** Whether GitHub is configured. */
  github: boolean;
  /** Whether writes are enabled. */
  writes: boolean;
}

/** A live tool entry in the current turn's timeline. */
interface TimelineEntry {
  /** Provider call id. */
  id: string;
  /** Tool name. */
  name: string;
  /** Arguments supplied by the model. */
  args: Record<string, unknown>;
  /** Lifecycle state. */
  status: "running" | "success" | "error";
  /** One-line result summary. */
  summary?: string;
  /** Full result payload. */
  data?: unknown;
  /** Wall-clock duration. */
  durationMs?: number;
  /** Present when the operator must approve the call. */
  confirmation?: { token: string; argumentsHash: string; reason: string };
}

/** Tools grouped by what they touch, for the capability explainer. */
const TOOL_EXPLAINER: readonly {
  name: string;
  label: string;
  detail: string;
  icon: "globe" | "file" | "db" | "pr" | "note";
}[] = [
  {
    name: "search_web",
    label: "Search the web",
    detail: "Reads public search results. Needs a search provider key.",
    icon: "globe",
  },
  {
    name: "fetch_url",
    label: "Fetch a page",
    detail: "Reads one public URL. Private and local addresses are refused.",
    icon: "globe",
  },
  {
    name: "read_repo_file",
    label: "Read a file",
    detail: "Reads an allowlisted source file. Secrets and build output are denied.",
    icon: "file",
  },
  {
    name: "list_repo_files",
    label: "List a directory",
    detail: "Lists one allowlisted directory level.",
    icon: "file",
  },
  {
    name: "query_database",
    label: "Query site data",
    detail: "Runs curated read-only views. It cannot execute SQL.",
    icon: "db",
  },
  {
    name: "propose_file_change",
    label: "Propose an edit",
    detail: "Records a reviewable proposal. It never writes a file.",
    icon: "note",
  },
  {
    name: "record_note",
    label: "Record a note",
    detail: "Writes an entry into the audit trail.",
    icon: "note",
  },
  {
    name: "open_pull_request",
    label: "Open a pull request",
    detail: "Commits to a new branch and opens a draft PR. Needs approval.",
    icon: "pr",
  },
  {
    name: "create_issue",
    label: "File an issue",
    detail: "Files a GitHub issue. Needs approval.",
    icon: "pr",
  },
];

/** Render the icon for a tool explainer row. */
function explainerIcon(kind: "globe" | "file" | "db" | "pr" | "note") {
  switch (kind) {
    case "globe":
      return <Globe aria-hidden="true" className="h-3.5 w-3.5" />;
    case "file":
      return <FileText aria-hidden="true" className="h-3.5 w-3.5" />;
    case "db":
      return <Database aria-hidden="true" className="h-3.5 w-3.5" />;
    case "pr":
      return <GitPullRequest aria-hidden="true" className="h-3.5 w-3.5" />;
    case "note":
      return <Terminal aria-hidden="true" className="h-3.5 w-3.5" />;
    default:
      return <Wrench aria-hidden="true" className="h-3.5 w-3.5" />;
  }
}

/** Pretty-print an unknown payload for the timeline. */
function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

/** Extract a human error message from a failed JSON response. */
function errorFromPayload(payload: unknown, fallback: string): string {
  if (
    payload !== null &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }
  return fallback;
}

/* ────────────────────────────────────────────────────────────────────────────
 * The console
 * ──────────────────────────────────────────────────────────────────────────── */

/** The admin-only agent console. */
export default function AgentConsolePage() {
  const { play } = useSound();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streamText, setStreamText] = useState("");
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingSession, setLoadingSession] = useState(false);
  const [voiceMode, setVoiceMode] = useState<AgentVoiceMode>("push");
  const [speakText, setSpeakText] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<{
    id: string;
    tool: string;
    token: string;
    argumentsHash: string;
    reason: string;
  } | null>(null);

  const streamRef = useRef("");
  const timelineRef = useRef<TimelineEntry[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  /* ── Session list and capability snapshot ── */

  // `loadingSessions` starts true for the first load; later refreshes update
  // the list in place instead of flashing the spinner.
  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/agent/sessions", { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setAccessError(
          response.status === 401 || response.status === 403
            ? errorFromPayload(
                payload,
                "Administrator access is required. Sign in with an admin account, or set ADMIN_EMAILS and configure Clerk.",
              )
            : errorFromPayload(payload, "Sessions could not be loaded."),
        );
        return;
      }
      setAccessError(null);
      const record = payload as { sessions?: SessionSummary[]; agent?: AgentStatus };
      setSessions(Array.isArray(record.sessions) ? record.sessions : []);
      if (record.agent) setStatus(record.agent);
    } catch {
      setAccessError("The console could not reach the server.");
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    // False positive: `loadSessions` only sets state after its first `await`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSessions();
  }, [loadSessions]);

  /* ── Transcript scrolling ── */

  useEffect(() => {
    const node = transcriptEndRef.current;
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ block: "end" });
    }
  }, [messages, streamText, timeline]);

  /* ── Session loading ── */

  const openSession = useCallback(async (sessionId: string) => {
    setLoadingSession(true);
    setError(null);
    setStreamText("");
    setTimeline([]);
    timelineRef.current = [];
    streamRef.current = "";
    try {
      const response = await fetch(`/api/agent/sessions/${sessionId}`, {
        cache: "no-store",
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorFromPayload(payload, "That session could not be loaded."));
        return;
      }
      const record = payload as {
        session?: SessionSummary;
        messages?: TranscriptMessage[];
      };
      setActiveSessionId(sessionId);
      setMessages(Array.isArray(record.messages) ? record.messages : []);
      setSpeakText(null);
    } catch {
      setError("That session could not be loaded.");
    } finally {
      setLoadingSession(false);
    }
  }, []);

  const startNewSession = useCallback(() => {
    setActiveSessionId(null);
    setMessages([]);
    setStreamText("");
    setTimeline([]);
    timelineRef.current = [];
    streamRef.current = "";
    setSpeakText(null);
    setError(null);
    setPendingApproval(null);
  }, []);

  const archiveSession = useCallback(
    async (sessionId: string) => {
      try {
        const response = await fetch(`/api/agent/sessions/${sessionId}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const payload: unknown = await response.json().catch(() => null);
          setError(errorFromPayload(payload, "That session could not be archived."));
          return;
        }
        if (activeSessionId === sessionId) startNewSession();
        await loadSessions();
      } catch {
        setError("That session could not be archived.");
      }
    },
    [activeSessionId, loadSessions, startNewSession],
  );

  /* ── Stream handling ── */

  const applyEvent = useCallback((event: AgentStreamEvent) => {
    switch (event.type) {
      case "status": {
        setStatus({
          configured: event.configured,
          mode: event.mode,
          model: event.model,
          tools: event.tools,
          github: event.github,
          writes: event.writes,
        });
        if (event.sessionId) setActiveSessionId(event.sessionId);
        setMessages((previous) =>
          previous.map((message) =>
            message.local ? { ...message, local: false } : message,
          ),
        );
        break;
      }
      case "token": {
        streamRef.current += event.value;
        setStreamText(streamRef.current);
        break;
      }
      case "tool": {
        const entry: TimelineEntry = {
          id: event.id,
          name: event.name,
          args: event.args,
          status: "running",
        };
        timelineRef.current = [...timelineRef.current, entry];
        setTimeline(timelineRef.current);
        break;
      }
      case "tool_result": {
        timelineRef.current = timelineRef.current.map((item) =>
          item.id === event.id
            ? {
                ...item,
                status: event.ok ? "success" : "error",
                summary: event.summary,
                data: event.data,
                durationMs: event.durationMs,
              }
            : item,
        );
        setTimeline(timelineRef.current);
        break;
      }
      case "confirmation": {
        timelineRef.current = timelineRef.current.map((item) =>
          item.id === event.id
            ? {
                ...item,
                confirmation: {
                  token: event.token,
                  argumentsHash: event.argumentsHash,
                  reason: event.reason,
                },
              }
            : item,
        );
        setTimeline(timelineRef.current);
        setPendingApproval({
          id: event.id,
          tool: event.tool,
          token: event.token,
          argumentsHash: event.argumentsHash,
          reason: event.reason,
        });
        play("reveal");
        break;
      }
      case "error": {
        setError(event.message);
        setMessages((previous) => [
          ...previous,
          {
            id: uid("agent-error"),
            role: "system",
            content: event.message,
          },
        ]);
        break;
      }
      case "done": {
        const finalText = streamRef.current;
        const toolCalls: StoredToolCall[] = timelineRef.current.map((item) => ({
          id: item.id,
          name: item.name,
          arguments: item.args,
          result: item.data,
          status:
            item.status === "running"
              ? "pending"
              : item.status === "success"
                ? "success"
                : "error",
          error: item.status === "error" ? item.summary : undefined,
        }));
        if (finalText !== "" || toolCalls.length > 0) {
          setMessages((previous) => [
            ...previous,
            {
              id: uid("agent-turn"),
              role: "assistant",
              content: finalText,
              toolCalls,
            },
          ]);
          if (finalText.trim() !== "") setSpeakText(finalText);
        }
        streamRef.current = "";
        setStreamText("");
        timelineRef.current = [];
        setTimeline([]);
        break;
      }
      default:
        break;
    }
  }, [play]);

  const send = useCallback(
    async (message: string, confirmationToken?: string) => {
      const trimmed = message.trim();
      if (trimmed === "" || busy) return;

      play("message");
      if (confirmationToken) setPendingApproval(null);
      setBusy(true);
      setError(null);
      streamRef.current = "";
      timelineRef.current = [];
      setStreamText("");
      setTimeline([]);
      setSpeakText(null);
      setMessages((previous) => [
        ...previous,
        { id: uid("agent-user"), role: "user", content: trimmed, local: true },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId: activeSessionId ?? undefined,
            message: trimmed,
            confirmationToken,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const payload: unknown = await response.json().catch(() => null);
          setError(errorFromPayload(payload, "The agent could not start a turn."));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });

          let newline = buffer.indexOf("\n");
          while (newline >= 0) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            newline = buffer.indexOf("\n");
            if (line === "") continue;
            try {
              applyEvent(JSON.parse(line) as AgentStreamEvent);
            } catch {
              // A malformed line is skipped rather than killing the stream.
            }
          }
        }
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setError("The stream ended unexpectedly.");
        }
      } finally {
        abortRef.current = null;
        setBusy(false);
        void loadSessions();
      }
    },
    [activeSessionId, applyEvent, busy, loadSessions, play],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }, []);

  /* ── Voice ── */

  const handleTranscript = useCallback(
    (text: string, final: boolean) => {
      if (!final) {
        setDraft(text);
        return;
      }
      setDraft(text);
      if (voiceMode === "handsfree") {
        setDraft("");
        void send(text);
      }
    },
    [send, voiceMode],
  );

  const handleComposerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const value = draft;
        setDraft("");
        void send(value);
      }
    },
    [draft, send],
  );

  const availableToolNames = useMemo(
    () => new Set(status?.tools ?? []),
    [status],
  );

  /* ── Access gate ── */

  if (accessError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <EmptyState
          icon={<ShieldCheck aria-hidden="true" className="h-5 w-5" />}
          title="Administrator access required"
          description={accessError}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6 lg:px-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-2xl text-bone">Agent console</h1>
            <p className="text-sm leading-relaxed text-muted">
              An admin-only agent that can research, read the codebase, and — when
              write mode is enabled — prepare pull requests for your review.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status?.configured ? "ok" : "warn"}>
              {status?.configured ? "Model connected" : "No model key"}
            </Badge>
            <Badge tone={status?.mode === "write" ? "danger" : "teal"}>
              {status?.mode === "write" ? "Write mode" : "Read-only"}
            </Badge>
            <Badge tone="neutral">{status?.model ?? "model unset"}</Badge>
          </div>
        </div>
      </header>

      {!status?.configured ? (
        <Card className="border-warn/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle aria-hidden="true" className="h-4 w-4 text-warn" />
              The agent is not connected to a model yet
            </CardTitle>
            <CardDescription>
              Set <code className="text-code">OPENAI_API_KEY</code> (optionally{" "}
              <code className="text-code">OPENAI_BASE_URL</code> and{" "}
              <code className="text-code">AGENT_MODEL</code>) to bring it online.
              Until then it answers honestly that it cannot run, and this page
              still shows the exact tool surface this deployment exposes.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {/* What it can and cannot do — deliberately prominent. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-gold" />
            What this agent can and cannot do
          </CardTitle>
          <CardDescription>
            Every tool call is written to the audit log. Destructive actions stop
            and wait for your explicit approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOOL_EXPLAINER.map((tool) => {
              const enabled = availableToolNames.has(tool.name);
              return (
                <div
                  key={tool.name}
                  className={cn(
                    "flex items-start gap-3 rounded-md border p-3",
                    enabled
                      ? "border-hairline bg-raised/40"
                      : "border-hairline/60 bg-void/40 opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 shrink-0",
                      enabled ? "text-gold" : "text-faint",
                    )}
                  >
                    {explainerIcon(tool.icon)}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="flex items-center gap-2 text-sm text-bone">
                      {tool.label}
                      {enabled ? (
                        <CheckCircle2
                          aria-label="Available"
                          className="h-3.5 w-3.5 text-ok"
                        />
                      ) : (
                        <CircleSlash
                          aria-label="Not available on this deployment"
                          className="h-3.5 w-3.5 text-faint"
                        />
                      )}
                    </span>
                    <span className="text-xs leading-relaxed text-faint">
                      {tool.detail}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-hairline bg-abyss/50 p-3">
              <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ok">
                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                In bounds
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-xs leading-relaxed text-muted">
                <li>Reads allowlisted source files and lists directories.</li>
                <li>Answers data questions through curated read-only views.</li>
                <li>Proposes edits without writing them.</li>
                <li>Opens draft pull requests on new branches after approval.</li>
              </ul>
            </div>
            <div className="rounded-md border border-hairline bg-abyss/50 p-3">
              <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-danger">
                <Ban aria-hidden="true" className="h-3.5 w-3.5" />
                Out of bounds
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-xs leading-relaxed text-muted">
                <li>No SQL, no shell, no arbitrary code execution.</li>
                <li>Never writes to the default branch and cannot deploy.</li>
                <li>Never reads secrets, <code className="text-code">.env</code> files, or the database credentials.</li>
                <li>Never returns an API key or environment value to this page.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* Transcript */}
          <Card className="flex min-h-[26rem] flex-col overflow-hidden">
            <CardHeader className="flex-row items-center justify-between gap-3 border-b border-hairline py-3">
              <CardTitle className="text-sm">
                {activeSessionId
                  ? sessions.find((session) => session.id === activeSessionId)
                      ?.title ?? "Session"
                  : "New session"}
              </CardTitle>
              <div className="flex items-center gap-2">
                {busy ? (
                  <Badge tone="info" size="sm">
                    <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
                    Running
                  </Badge>
                ) : null}
                {busy ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={<Square aria-hidden="true" />}
                    onClick={stop}
                  >
                    Stop
                  </Button>
                ) : null}
              </div>
            </CardHeader>

            <CardContent
              role="log"
              aria-live="polite"
              aria-busy={busy}
              aria-label="Agent transcript"
              className="flex max-h-[32rem] min-h-[20rem] flex-col gap-4 overflow-y-auto py-4"
            >
              {loadingSession ? (
                <div className="flex justify-center py-10">
                  <Spinner label="Loading session" />
                </div>
              ) : messages.length === 0 && streamText === "" && timeline.length === 0 ? (
                <EmptyState
                  icon={<MessageSquarePlus aria-hidden="true" className="h-5 w-5" />}
                  title="Ask the agent something"
                  description="Try “summarise the newest membership applications”, “what does the payments webhook do?”, or hold the talk button and speak."
                />
              ) : null}

              {messages.map((message) => (
                <article
                  key={message.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-md border p-3",
                    message.role === "user"
                      ? "border-gold/30 bg-gold/5"
                      : message.role === "system"
                        ? "border-danger/30 bg-danger/5"
                        : "border-hairline bg-raised/40",
                  )}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                    {message.role === "user"
                      ? "You"
                      : message.role === "system"
                        ? "System"
                        : "Agent"}
                    {message.local ? " · not yet saved" : ""}
                  </p>
                  {message.content !== "" ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-bone">
                      {message.content}
                    </p>
                  ) : null}
                  {message.toolCalls && message.toolCalls.length > 0 ? (
                    <ToolTimeline entries={message.toolCalls.map(storedToEntry)} />
                  ) : null}
                </article>
              ))}

              {(streamText !== "" || timeline.length > 0) && (
                <article className="flex flex-col gap-2 rounded-md border border-hairline bg-raised/40 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                    Agent
                  </p>
                  {streamText !== "" ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-bone">
                      {streamText}
                    </p>
                  ) : null}
                  {timeline.length > 0 ? <ToolTimeline entries={timeline} /> : null}
                </article>
              )}

              <div ref={transcriptEndRef} />
            </CardContent>

            <div className="border-t border-hairline p-4">
              {error ? (
                <p
                  role="alert"
                  className="mb-3 flex items-start gap-2 text-xs leading-relaxed text-danger"
                >
                  <XCircle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </p>
              ) : null}

              {pendingApproval ? (
                <div className="mb-3 flex flex-col gap-2 rounded-md border border-warn/40 bg-warn/5 p-3">
                  <p className="flex items-center gap-2 text-sm text-bone">
                    <AlertTriangle aria-hidden="true" className="h-4 w-4 text-warn" />
                    Approval required for{" "}
                    <code className="text-code">{pendingApproval.tool}</code>
                  </p>
                  <p className="text-xs leading-relaxed text-muted">
                    {pendingApproval.reason} The token only authorises these exact
                    arguments ({pendingApproval.argumentsHash.slice(0, 12)}…).
                  </p>
                  <div>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        void send(
                          `Approved. Run the ${pendingApproval.tool} call exactly as proposed.`,
                          pendingApproval.token,
                        );
                      }}
                    >
                      Approve and run
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <label htmlFor="agent-composer" className="sr-only">
                  Message the agent
                </label>
                <Textarea
                  id="agent-composer"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Ask the agent to research, explain, or prepare a change…"
                  disabled={busy}
                  rows={3}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                    Enter sends · Shift+Enter adds a line
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={<Trash2 aria-hidden="true" />}
                      onClick={startNewSession}
                      disabled={busy}
                    >
                      New session
                    </Button>
                    <Button
                      size="sm"
                      iconLeft={<Send aria-hidden="true" />}
                      disabled={busy || draft.trim() === ""}
                      onClick={() => {
                        const value = draft;
                        setDraft("");
                        void send(value);
                      }}
                    >
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <AgentVoice
            mode={voiceMode}
            onModeChange={setVoiceMode}
            onTranscript={handleTranscript}
            speakText={speakText}
            disabled={busy}
          />
        </div>

        {/* Sessions */}
        <aside className="flex flex-col gap-3">
          <Card className="flex flex-col">
            <CardHeader className="flex-row items-center justify-between gap-2 py-3">
              <CardTitle className="text-sm">Sessions</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={<MessageSquarePlus aria-hidden="true" />}
                onClick={startNewSession}
                disabled={busy}
              >
                New
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 py-3">
              {loadingSessions ? (
                <div className="flex justify-center py-6">
                  <Spinner size="sm" label="Loading sessions" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-xs leading-relaxed text-faint">
                  No sessions yet. Ask something to start one.
                </p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "flex items-start justify-between gap-2 rounded-md border p-2",
                      activeSessionId === session.id
                        ? "border-gold/50 bg-gold/5"
                        : "border-hairline",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => void openSession(session.id)}
                      className="flex min-w-0 flex-1 flex-col gap-1 text-left"
                    >
                      <span className="truncate text-sm text-bone">
                        {session.title}
                      </span>
                      <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
                        {timeAgo(session.updatedAt)}
                        {session.status === "archived" ? " · archived" : ""}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Archive ${session.title}`}
                      onClick={() => void archiveSession(session.id)}
                      className="mt-0.5 text-faint transition-colors hover:text-danger"
                    >
                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <BookOpen aria-hidden="true" className="h-4 w-4 text-gold" />
                Operating notes
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 py-3 text-xs leading-relaxed text-muted">
              <p>
                Read-only is the default. Write tools appear only when{" "}
                <code className="text-code">AGENT_ENABLE_WRITES=true</code> and a
                GitHub token plus{" "}
                <code className="text-code">AGENT_GITHUB_REPO</code> are set.
              </p>
              <p>
                Spoken replies are read from the finished message, so talking to
                the agent never blocks the transcript.
              </p>
              <p>
                The microphone only opens on an explicit press, and it is released
                when this tab is hidden.
              </p>
              <p className="flex items-center gap-2 text-faint">
                <Mic aria-hidden="true" className="h-3.5 w-3.5" />
                <ChevronRight aria-hidden="true" className="h-3 w-3" />
                speech in, <Mic aria-hidden="true" className="h-3.5 w-3.5" />
                speech out
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tool timeline
 * ──────────────────────────────────────────────────────────────────────────── */

/** Convert a persisted tool call into a timeline entry. */
function storedToEntry(call: StoredToolCall): TimelineEntry {
  return {
    id: call.id,
    name: call.name,
    args: call.arguments,
    status:
      call.status === "success"
        ? "success"
        : call.status === "error"
          ? "error"
          : "running",
    summary: call.error ?? undefined,
    data: call.result,
  };
}

/** A collapsible list of tool calls with their arguments and results. */
function ToolTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <ol className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={entry.id}>
          <details className="group rounded-md border border-hairline bg-abyss/40">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs text-bone">
              <span
                className={cn(
                  "shrink-0",
                  entry.status === "success"
                    ? "text-ok"
                    : entry.status === "error"
                      ? "text-danger"
                      : "text-info",
                )}
              >
                {entry.status === "running" ? (
                  <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                ) : entry.status === "success" ? (
                  <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                ) : (
                  <XCircle aria-hidden="true" className="h-3.5 w-3.5" />
                )}
              </span>
              <code className="font-mono text-[11px] text-code">{entry.name}</code>
              <span className="ml-auto flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-faint">
                {typeof entry.durationMs === "number"
                  ? `${entry.durationMs} ms`
                  : "running"}
                <ChevronRight
                  aria-hidden="true"
                  className="h-3 w-3 transition-transform group-open:rotate-90"
                />
              </span>
            </summary>
            <div className="flex flex-col gap-3 border-t border-hairline px-3 py-3">
              {entry.summary ? (
                <p className="text-xs leading-relaxed text-muted">{entry.summary}</p>
              ) : null}
              {entry.confirmation ? (
                <p className="text-xs leading-relaxed text-warn">
                  Awaiting approval. Token bound to arguments{" "}
                  <code className="text-code">
                    {entry.confirmation.argumentsHash.slice(0, 12)}…
                  </code>
                </p>
              ) : null}
              <div>
                <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-faint">
                  Arguments
                </p>
                <pre className="max-h-48 overflow-auto rounded-sm bg-void/70 p-2 text-[11px] leading-relaxed text-code">
                  {pretty(entry.args)}
                </pre>
              </div>
              {entry.data !== undefined ? (
                <div>
                  <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-faint">
                    Result
                  </p>
                  <pre className="max-h-64 overflow-auto rounded-sm bg-void/70 p-2 text-[11px] leading-relaxed text-code">
                    {pretty(entry.data)}
                  </pre>
                </div>
              ) : null}
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}
