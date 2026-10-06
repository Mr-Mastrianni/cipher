/**
 * The admin agent's execution loop.
 *
 * Transport is the OpenAI-compatible Chat Completions API over plain `fetch`,
 * so the same code drives OpenAI, DeepSeek, or any compatible gateway by
 * setting `OPENAI_BASE_URL` and `AGENT_MODEL`. There is no SDK dependency.
 *
 * Shape of a turn:
 *
 *  1. Load the session history from the store and prepend a server-authored
 *     system prompt. The client never supplies a system message.
 *  2. Stream a completion. Content deltas become `token` events; tool-call
 *     deltas are reassembled by index.
 *  3. Run each tool through {@link executeAgentTool}, which validates,
 *     bounds, and audits it. Results are appended as `tool` messages.
 *  4. Repeat, bounded to {@link MAX_TOOL_ITERATIONS} rounds, then persist the
 *     assistant turn.
 *
 * Security posture: the runner is only reachable behind `requireAdmin`, every
 * tool call lands in `audit_log`, destructive tools block on an operator
 * confirmation token, persisted tool payloads are size-capped, and no
 * environment value is ever placed on the event stream.
 */

import type { AgentMessage, AgentToolCall } from "@/lib/db/schema";
import type { Store } from "@/lib/db/store";

import {
  agentMode,
  agentWritesEnabled,
  availableTools,
  executeAgentTool,
  githubConfig,
  hashToolArguments,
  verifyConfirmationToken,
  type AgentToolAuditEntry,
  type AgentToolDefinition,
} from "./tools";
import { randomUUID } from "node:crypto";

/* ────────────────────────────────────────────────────────────────────────────
 * Public types
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * A single structured event on the agent's newline-delimited JSON stream.
 *
 * The chat route serialises these one per line; the console renders them.
 */
export type AgentStreamEvent =
  | {
      /** Deployment status, always the first event of a turn. */
      type: "status";
      /** Session the turn is running in. */
      sessionId: string;
      /** Whether a model key is configured. */
      configured: boolean;
      /** Whether write tools are exposed. */
      mode: "read-only" | "write";
      /** Model id, or `null` when unconfigured. */
      model: string | null;
      /** Names of the tools available on this deployment. */
      tools: string[];
      /** Whether a GitHub token and repo are configured. */
      github: boolean;
      /** Whether `AGENT_ENABLE_WRITES` is set. */
      writes: boolean;
    }
  | { /** A streamed assistant token. */ type: "token"; value: string }
  | {
      /** A tool call is about to run. */
      type: "tool";
      id: string;
      name: string;
      args: Record<string, unknown>;
    }
  | {
      /** A tool call finished (or refused). */
      type: "tool_result";
      id: string;
      name: string;
      ok: boolean;
      summary: string;
      data: unknown;
      durationMs: number;
    }
  | {
      /** The operator must approve a destructive call with this token. */
      type: "confirmation";
      id: string;
      tool: string;
      token: string;
      argumentsHash: string;
      reason: string;
    }
  | { /** Something went wrong; the turn is over. */ type: "error"; message: string }
  | {
      /** The turn finished cleanly. */
      type: "done";
      messageId: string | null;
      iterations: number;
      usage?: { promptTokens: number | null; completionTokens: number | null };
    };

/** Everything the loop needs from the request that started it. */
export interface AgentRunContext {
  /** Repository layer. */
  store: Store;
  /** Local id of the admin driving the session. */
  adminUserId: string;
  /** Session being continued. */
  sessionId: string;
  /** Operator approval token, when the client echoed one back. */
  confirmationToken?: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Configuration
 * ──────────────────────────────────────────────────────────────────────────── */

/** Maximum tool-calling rounds inside a single turn. */
const MAX_TOOL_ITERATIONS = 8;
/** Whole-request timeout for one completion. */
const REQUEST_TIMEOUT_MS = 90_000;
/** Maximum bytes of a tool payload persisted into `agent_messages`. */
const MAX_STORED_TOOL_BYTES = 8 * 1024;
/** Messages of history replayed to the model. */
const MAX_HISTORY_MESSAGES = 200;

/** The default model when `AGENT_MODEL` is unset. */
export const DEFAULT_AGENT_MODEL = "gpt-4o-mini";

/** The default OpenAI-compatible base URL. */
export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

/** Whether `OPENAI_API_KEY` is present, i.e. whether the loop can run. */
export function isAgentConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return typeof key === "string" && key.trim() !== "";
}

/** The configured model id. */
export function agentModel(): string {
  const configured = process.env.AGENT_MODEL?.trim();
  return configured && configured !== "" ? configured : DEFAULT_AGENT_MODEL;
}

/**
 * The OpenAI-compatible base URL, without a trailing slash.
 *
 * Set `OPENAI_BASE_URL` to `https://api.deepseek.com/v1` (or any compatible
 * gateway) to point the agent elsewhere. The path must include the version
 * segment if the provider needs one.
 */
export function agentBaseUrl(): string {
  const configured = process.env.OPENAI_BASE_URL?.trim();
  if (!configured || configured === "") return DEFAULT_OPENAI_BASE_URL;
  return configured.replace(/\/+$/, "");
}

/** The honest message shown when no model key is configured. */
export const NO_MODEL_MESSAGE =
  "I am not connected to a language model on this deployment yet, so I cannot answer questions or run tools. Set OPENAI_API_KEY (optionally OPENAI_BASE_URL and AGENT_MODEL) and I will come online. Everything else is already wired: the tool surface, the audit trail, and session storage. The status panel lists exactly which tools this deployment exposes.";

/* ────────────────────────────────────────────────────────────────────────────
 * Chat message shapes (the OpenAI-compatible wire format)
 * ──────────────────────────────────────────────────────────────────────────── */

/** A function call emitted by the model. */
interface ChatToolCall {
  /** Provider-assigned call id. */
  id: string;
  /** Always `function`. */
  type: "function";
  /** Called function and its JSON-encoded arguments. */
  function: { name: string; arguments: string };
}

/** One message on the wire. */
interface ChatMessage {
  /** Conversation role. */
  role: "system" | "user" | "assistant" | "tool";
  /** Text content; `null` is required by some providers for tool-call turns. */
  content: string | null;
  /** Assistant tool calls, when the turn requested tools. */
  tool_calls?: ChatToolCall[];
  /** Matching call id for a `tool` message. */
  tool_call_id?: string;
  /** Tool name for a `tool` message. */
  name?: string;
}

/** Accumulated result of one streamed completion. */
interface CompletionResult {
  /** Full assistant text. */
  content: string;
  /** Reassembled tool calls, in index order. */
  toolCalls: ChatToolCall[];
  /** Token usage when the provider reported it. */
  usage: { promptTokens: number | null; completionTokens: number | null } | null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Guards and small helpers
 * ──────────────────────────────────────────────────────────────────────────── */

/** Whether a value is a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Read a string field, or `null`. */
function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Read a number field, or `null`. */
function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Map a persisted session message onto the wire format. */
function toChatMessage(row: AgentMessage): ChatMessage | null {
  switch (row.role) {
    case "user":
      return { role: "user", content: row.content };
    case "assistant": {
      const toolCalls = row.toolCalls?.map<ChatToolCall>((call) => ({
        id: call.id,
        type: "function",
        function: {
          name: call.name,
          arguments: JSON.stringify(call.arguments ?? {}),
        },
      }));
      return {
        role: "assistant",
        content: row.content === "" ? null : row.content,
        ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      };
    }
    case "tool": {
      if (!row.toolCallId) return null;
      return {
        role: "tool",
        content: row.content,
        tool_call_id: row.toolCallId,
        name: row.toolName ?? undefined,
      };
    }
    case "system":
      // Stored system messages are ignored: the prompt is server-authored.
      return null;
    default:
      return null;
  }
}

/**
 * The most recent stored tool call that `token` approves, if any.
 *
 * The token is an HMAC over the session, tool name and argument hash, so only
 * the exact call the operator was shown can match.
 */
function findApprovedCall(
  history: readonly AgentMessage[],
  sessionId: string,
  token: string,
): { name: string; arguments: Record<string, unknown> } | null {
  // Approved replays already run, newest first, so a resent token is a no-op.
  const replayed = new Set<string>();
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const row = history[i];
    if (row.role !== "assistant" || !row.toolCalls) continue;
    for (const call of row.toolCalls) {
      const args = call.arguments ?? {};
      const key = `${call.name}:${hashToolArguments(args)}`;
      if (call.id.startsWith("call_approved_")) {
        replayed.add(key);
        continue;
      }
      if (verifyConfirmationToken(token, sessionId, call.name, args)) {
        return replayed.has(key) ? null : { name: call.name, arguments: args };
      }
    }
  }
  return null;
}

/** Normalise model-authored arguments into a JSON object for storage. */
function asArgumentsRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : { value };
}

/** Parse a tool call's JSON argument string. */
function parseToolArguments(
  raw: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (raw.trim() === "") return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, error: "The model produced tool arguments that were not valid JSON." };
  }
}

/** Bound a tool payload before it is persisted into the session. */
function compactForStorage(data: unknown, maxBytes: number): unknown {
  let serialised: string;
  try {
    serialised = JSON.stringify(data) ?? "null";
  } catch {
    return { __unserialisable: true };
  }
  if (Buffer.byteLength(serialised, "utf8") <= maxBytes) return data;
  return {
    __truncated: true,
    bytes: Buffer.byteLength(serialised, "utf8"),
    preview: serialised.slice(0, maxBytes),
  };
}

/** Build the server-authored system prompt for a turn. */
function buildSystemPrompt(
  mode: "read-only" | "write",
  tools: readonly AgentToolDefinition[],
): string {
  const toolList = tools.map((tool) => `- ${tool.name}: ${tool.description}`).join("\n");
  const writeRules =
    mode === "write"
      ? [
          "You may propose file changes and open pull requests. propose_file_change only records a proposal — it never writes. open_pull_request and create_issue need the operator to approve the exact arguments first, so an 'awaiting_confirmation' result is expected and must never be retried on your own. When the operator approves, the server runs the approved call itself and its result appears in the conversation; report that result and do not issue the call again.",
          "To change an existing file, read it first with read_repo_file and send its complete new contents: open_pull_request replaces whole files. Keep each pull request small and focused, and give it a clear title and description.",
          "You can never push to the default branch and you cannot deploy. Branches you open are draft pull requests for a human to review.",
        ].join("\n")
      : "This deployment is read-only. Do not claim to have changed anything; you can only read, search, fetch, and describe.";

  return [
    "You are the internal operations agent for The Cipher, a membership platform.",
    "You are speaking with a signed-in administrator. Your answers may be read aloud, so prefer clear, compact prose over long bullet dumps.",
    "",
    "Hard rules:",
    "- Never reveal, quote, or guess environment variables, API keys, tokens, connection strings, or any other secret. If asked, refuse and explain that you cannot access them.",
    "- Never claim an action succeeded unless a tool result says it did. Report tool failures plainly.",
    "- Never invent data. Use query_database or a read tool, and say when you do not know.",
    "- Only the tools below exist. If a request needs something else, say so.",
    writeRules,
    "",
    `Current mode: ${mode}.`,
    `Available tools:\n${toolList}`,
    "",
    "The current date is " + new Date().toISOString().slice(0, 10) + ".",
  ].join("\n");
}

/* ────────────────────────────────────────────────────────────────────────────
 * Streaming completion
 * ──────────────────────────────────────────────────────────────────────────── */

/** A tool-call fragment as it arrives on the wire. */
interface RawToolCallDelta {
  /** Position in the model's tool-call list. */
  index: number;
  /** Call id, present on the first fragment. */
  id: string | null;
  /** Function name fragment. */
  name: string | null;
  /** Argument JSON fragment. */
  argumentsFragment: string | null;
}

/** Read one SSE data payload into deltas. */
function readChunk(payload: unknown): {
  content: string;
  finishReason: string | null;
  usage: { promptTokens: number | null; completionTokens: number | null } | null;
  toolCalls: RawToolCallDelta[];
} {
  const empty = {
    content: "",
    finishReason: null as string | null,
    usage: null as { promptTokens: number | null; completionTokens: number | null } | null,
    toolCalls: [] as RawToolCallDelta[],
  };
  if (!isRecord(payload)) return empty;

  const usageRecord = isRecord(payload.usage) ? payload.usage : null;
  const usage = usageRecord
    ? {
        promptTokens: asNumber(usageRecord.prompt_tokens),
        completionTokens: asNumber(usageRecord.completion_tokens),
      }
    : null;

  const choices: unknown[] = Array.isArray(payload.choices) ? payload.choices : [];
  if (choices.length === 0) {
    return { ...empty, usage };
  }
  const choice: unknown = choices[0];
  if (!isRecord(choice)) return { ...empty, usage };

  const delta = isRecord(choice.delta) ? choice.delta : {};
  const content = asString(delta.content) ?? "";
  const finishReason = asString(choice.finish_reason);

  const toolCalls: RawToolCallDelta[] = [];
  const rawCalls: unknown[] = Array.isArray(delta.tool_calls) ? delta.tool_calls : [];
  for (const raw of rawCalls) {
    if (!isRecord(raw)) continue;
    const index = asNumber(raw.index);
    const fn = isRecord(raw.function) ? raw.function : {};
    toolCalls.push({
      index: index ?? toolCalls.length,
      id: asString(raw.id),
      name: asString(fn.name),
      argumentsFragment: asString(fn.arguments),
    });
  }

  return { content, finishReason, usage, toolCalls };
}

/**
 * Stream one completion, yielding `token` events.
 *
 * Returns the accumulated result, or `null` after yielding an `error` event.
 */
async function* streamCompletion(options: {
  chat: ChatMessage[];
  model: string;
  tools: readonly AgentToolDefinition[];
  apiKey: string;
  baseUrl: string;
}): AsyncGenerator<AgentStreamEvent, CompletionResult | null, void> {
  const body: Record<string, unknown> = {
    model: options.model,
    stream: true,
    temperature: 0.2,
    messages: options.chat,
  };
  if (options.tools.length > 0) {
    body.tools = options.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
    body.tool_choice = "auto";
  }

  let response: Response;
  try {
    response = await fetch(`${options.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${options.apiKey}`,
        "user-agent": "the-cipher-agent/0.1",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    yield {
      type: "error",
      message: `The model endpoint could not be reached: ${
        error instanceof Error ? error.message : "network failure"
      }`,
    };
    return null;
  }

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    yield {
      type: "error",
      message: `The model endpoint returned HTTP ${response.status}. ${detail.slice(0, 400)}`.trim(),
    };
    return null;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const fragments = new Map<number, { id: string; name: string; args: string }>();
  let content = "";
  let usage: CompletionResult["usage"] = null;
  let buffer = "";
  let finished = false;

  try {
    while (!finished) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, "").trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");

        if (line === "" || line.startsWith(":")) continue;
        if (!line.startsWith("data:")) continue;

        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          finished = true;
          break;
        }

        let payload: unknown;
        try {
          payload = JSON.parse(data) as unknown;
        } catch {
          continue;
        }

        const chunk = readChunk(payload);
        if (chunk.usage) usage = chunk.usage;

        if (chunk.content !== "") {
          content += chunk.content;
          yield { type: "token", value: chunk.content };
        }

        for (const fragment of chunk.toolCalls) {
          const existing = fragments.get(fragment.index) ?? { id: "", name: "", args: "" };
          fragments.set(fragment.index, {
            id: fragment.id ?? existing.id,
            name: fragment.name ?? existing.name,
            args: existing.args + (fragment.argumentsFragment ?? ""),
          });
        }
      }
    }
  } catch (error) {
    yield {
      type: "error",
      message: `The model stream ended unexpectedly: ${
        error instanceof Error ? error.message : "stream failure"
      }`,
    };
    return null;
  } finally {
    reader.releaseLock();
  }

  const toolCalls: ChatToolCall[] = [...fragments.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, fragment]) => ({
      id: fragment.id === "" ? `call_${index}` : fragment.id,
      type: "function",
      function: { name: fragment.name, arguments: fragment.args },
    }));

  return { content, toolCalls, usage };
}

/* ────────────────────────────────────────────────────────────────────────────
 * The loop
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Run one agent turn, emitting a structured event stream.
 *
 * The generator persists both sides of the conversation as it goes, so an
 * interrupted stream still leaves a coherent session. Callers must already have
 * verified `requireAdmin()` and appended the user's message.
 */
export async function* runAgentTurn(
  context: AgentRunContext,
): AsyncGenerator<AgentStreamEvent, void, void> {
  const { store, sessionId, adminUserId } = context;
  const tools = availableTools();
  const mode = agentMode();
  const configured = isAgentConfigured();
  const model = agentModel();

  yield {
    type: "status",
    sessionId,
    configured,
    mode,
    model: configured ? model : null,
    tools: tools.map((tool) => tool.name),
    github: githubConfig() !== null,
    writes: agentWritesEnabled(),
  };

  const audit = async (entry: AgentToolAuditEntry): Promise<void> => {
    try {
      await store.recordAuditLog({
        actorUserId: adminUserId,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        before: entry.before ?? null,
        after: entry.after ?? null,
        metadata: { ...(entry.metadata ?? {}), sessionId },
      });
    } catch {
      // Audit persistence must never break the turn.
    }
  };

  const history = await store.listAgentMessages(sessionId, MAX_HISTORY_MESSAGES);
  const chat: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(mode, tools) },
    ...history
      .map(toChatMessage)
      .filter((message): message is ChatMessage => message !== null),
  ];

  if (!configured) {
    await store.appendAgentMessage({
      sessionId,
      role: "assistant",
      content: NO_MODEL_MESSAGE,
    });
    await audit({
      action: "agent.turn.unconfigured",
      targetType: "agent_session",
      targetId: sessionId,
      metadata: { model: null, tools: tools.length },
    });
    yield { type: "token", value: NO_MODEL_MESSAGE };
    yield { type: "done", messageId: null, iterations: 0 };
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  const baseUrl = agentBaseUrl();

  // An approval replays the exact call the operator saw, server-side. Asking
  // the model to re-send identical arguments is unreliable for large payloads
  // (whole files in a pull request), and the token is then consumed so a
  // repeated call from the model cannot run the same action twice.
  if (context.confirmationToken) {
    const approved = findApprovedCall(history, sessionId, context.confirmationToken);
    if (approved) {
      const callId = `call_approved_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      yield { type: "tool", id: callId, name: approved.name, args: approved.arguments };
      const execution = await executeAgentTool(
        { name: approved.name, args: approved.arguments },
        { adminUserId, sessionId, confirmationToken: context.confirmationToken, store, audit },
      );
      const content = JSON.stringify(execution.data ?? { ok: execution.ok }).slice(
        0,
        MAX_STORED_TOOL_BYTES,
      );
      await store.appendAgentMessage({
        sessionId,
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: callId,
            name: approved.name,
            arguments: approved.arguments,
            result: compactForStorage(execution.data, MAX_STORED_TOOL_BYTES),
            status: execution.ok ? "success" : "error",
            error: execution.ok ? undefined : execution.summary,
          },
        ],
      });
      await store.appendAgentMessage({
        sessionId,
        role: "tool",
        content,
        toolCallId: callId,
        toolName: approved.name,
      });
      chat.push(
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: callId,
              type: "function",
              function: { name: approved.name, arguments: JSON.stringify(approved.arguments) },
            },
          ],
        },
        { role: "tool", tool_call_id: callId, name: approved.name, content },
      );
      yield {
        type: "tool_result",
        id: callId,
        name: approved.name,
        ok: execution.ok,
        summary: execution.summary,
        data: execution.data,
        durationMs: execution.durationMs,
      };
    }
  }

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const completion = yield* streamCompletion({
      chat,
      model,
      tools,
      apiKey,
      baseUrl,
    });
    if (!completion) return;

    if (completion.toolCalls.length === 0) {
      const saved = await store.appendAgentMessage({
        sessionId,
        role: "assistant",
        content: completion.content,
        tokensIn: completion.usage?.promptTokens ?? null,
        tokensOut: completion.usage?.completionTokens ?? null,
      });
      await audit({
        action: "agent.turn.completed",
        targetType: "agent_session",
        targetId: sessionId,
        metadata: {
          model,
          iterations: iteration + 1,
          toolCalls: 0,
          characters: completion.content.length,
        },
      });
      yield {
        type: "done",
        messageId: saved.id,
        iterations: iteration + 1,
        usage: completion.usage ?? undefined,
      };
      return;
    }

    const storedCalls: AgentToolCall[] = [];
    const toolMessages: ChatMessage[] = [];

    for (const call of completion.toolCalls) {
      const parsed = parseToolArguments(call.function.arguments);
      const argsRecord = parsed.ok ? asArgumentsRecord(parsed.value) : {};

      yield {
        type: "tool",
        id: call.id,
        name: call.function.name,
        args: argsRecord,
      };

      const execution = parsed.ok
        ? await executeAgentTool(
            { name: call.function.name, args: parsed.value },
            // The approval token was spent on the replay above; never reuse it.
            { adminUserId, sessionId, store, audit },
          )
        : {
            name: call.function.name,
            ok: false,
            summary: parsed.error,
            data: { error: "invalid_json_arguments" },
            durationMs: 0,
            confirmation: null,
            auditAction: `agent.tool.${call.function.name}.invalid_arguments`,
          };

      if (!parsed.ok) {
        await audit({
          action: execution.auditAction,
          targetType: "agent_session",
          targetId: sessionId,
          metadata: { tool: call.function.name, error: parsed.error },
        });
      }

      storedCalls.push({
        id: call.id,
        name: call.function.name,
        arguments: argsRecord,
        result: compactForStorage(execution.data, MAX_STORED_TOOL_BYTES),
        status: execution.ok ? "success" : "error",
        error: execution.ok ? undefined : execution.summary,
      });

      toolMessages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(execution.data ?? { ok: execution.ok }).slice(
          0,
          MAX_STORED_TOOL_BYTES,
        ),
      });

      yield {
        type: "tool_result",
        id: call.id,
        name: call.function.name,
        ok: execution.ok,
        summary: execution.summary,
        data: execution.data,
        durationMs: execution.durationMs,
      };

      if (execution.confirmation) {
        yield {
          type: "confirmation",
          id: call.id,
          tool: call.function.name,
          token: execution.confirmation.token,
          argumentsHash: execution.confirmation.argumentsHash,
          reason: execution.confirmation.reason,
        };
      }
    }

    await store.appendAgentMessage({
      sessionId,
      role: "assistant",
      content: completion.content,
      toolCalls: storedCalls,
      tokensIn: completion.usage?.promptTokens ?? null,
      tokensOut: completion.usage?.completionTokens ?? null,
    });

    for (const message of toolMessages) {
      await store.appendAgentMessage({
        sessionId,
        role: "tool",
        content: message.content ?? "",
        toolCallId: message.tool_call_id ?? null,
        toolName: message.name ?? null,
      });
    }

    chat.push({
      role: "assistant",
      content: completion.content === "" ? null : completion.content,
      tool_calls: completion.toolCalls,
    });
    chat.push(...toolMessages);
  }

  const notice =
    "I stopped after the maximum number of tool steps for a single turn. Ask me to continue if there is more to do.";
  await store.appendAgentMessage({ sessionId, role: "assistant", content: notice });
  await audit({
    action: "agent.turn.iteration_limit",
    targetType: "agent_session",
    targetId: sessionId,
    metadata: { model, iterations: MAX_TOOL_ITERATIONS },
  });
  yield { type: "token", value: notice };
  yield { type: "done", messageId: null, iterations: MAX_TOOL_ITERATIONS };
}
