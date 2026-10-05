/**
 * The admin agent's tool surface.
 *
 * Every tool is:
 *
 *  - **Described** by a JSON Schema handed to the model.
 *  - **Validated** at runtime with Zod before a single side effect happens.
 *  - **Bounded** — byte caps, result caps, and `AbortSignal.timeout` on every
 *    network call.
 *  - **Audited** — `executeAgentTool` writes exactly one `audit_log` row per
 *    attempt (including refusals), and side-effecting tools write a second,
 *    more specific row.
 *  - **Scoped** — file access is confined to an allowlist under
 *    `AGENT_REPO_ROOT` with traversal, secret, and build-output paths denied.
 *
 * Write capability is opt-in twice over: `AGENT_ENABLE_WRITES=true` **and** a
 * GitHub token plus `AGENT_GITHUB_REPO`. With no token the surface degrades to
 * read-only tools, which is the default and the honest state of a deploy with
 * no secrets.
 *
 * Tools never construct SQL. `query_database` matches a natural-language
 * description against a curated catalogue of read-only views and runs those
 * views through the repository layer, so there is no path from a model-authored
 * string to a query plan.
 */

import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { open, readdir, stat } from "node:fs/promises";
import * as net from "node:net";
import * as path from "node:path";
import { z } from "zod";

import type { Store } from "@/lib/db/store";

/* ────────────────────────────────────────────────────────────────────────────
 * Public types
 * ──────────────────────────────────────────────────────────────────────────── */

/** The nine tools the agent can call, as literal names. */
export type AgentToolName =
  | "search_web"
  | "fetch_url"
  | "read_repo_file"
  | "list_repo_files"
  | "propose_file_change"
  | "open_pull_request"
  | "query_database"
  | "create_issue"
  | "record_note";

/** Capability tier. `read` is always available; the others are opt-in. */
export type AgentToolCapability = "read" | "write" | "github";

/** A single JSON Schema property, limited to the subset the model needs. */
export interface JsonSchemaProperty {
  /** JSON type of the value. */
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  /** Human description shown to the model. */
  description: string;
  /** Allowed literal values, when the value is an enumeration. */
  enum?: readonly string[];
  /** Element schema for arrays. */
  items?: JsonSchemaProperty;
  /** Inclusive lower bound for numbers. */
  minimum?: number;
  /** Inclusive upper bound for numbers. */
  maximum?: number;
  /** Inclusive lower bound for string lengths. */
  minLength?: number;
  /** Inclusive upper bound for string lengths. */
  maxLength?: number;
  /** Nested properties, for an array of objects. */
  properties?: Record<string, JsonSchemaProperty>;
  /** Nested required names, for an array of objects. */
  required?: readonly string[];
}

/** An object-rooted JSON Schema describing a tool's arguments. */
export interface JsonSchema {
  /** Always `object`. */
  type: "object";
  /** Argument schemas keyed by argument name. */
  properties: Record<string, JsonSchemaProperty>;
  /** Names that must be present. */
  required: readonly string[];
  /** Tools reject unknown arguments. */
  additionalProperties: false;
}

/** What a tool returns to the loop. */
export interface AgentToolResult {
  /** Whether the tool completed the requested work. */
  ok: boolean;
  /** One-line summary rendered in the tool timeline. */
  summary: string;
  /** JSON-serialisable payload handed back to the model. */
  data: unknown;
}

/** An audit record a tool asks the runner to persist. */
export interface AgentToolAuditEntry {
  /** Dotted action name, e.g. `agent.tool.read_repo_file`. */
  action: string;
  /** Kind of thing acted on, e.g. `agent_session` or `repo_file`. */
  targetType?: string;
  /** Identifier of the thing acted on. */
  targetId?: string;
  /** State before the action, when meaningful. */
  before?: Record<string, unknown> | null;
  /** State after the action, when meaningful. */
  after?: Record<string, unknown> | null;
  /** Structured, non-secret detail. */
  metadata?: Record<string, unknown> | null;
}

/** Everything a tool needs from the surrounding request. */
export interface AgentToolContext {
  /** Local id of the admin driving the session. */
  adminUserId: string;
  /** The agent session the call belongs to. */
  sessionId: string;
  /** Operator confirmation echoed back by the client, when present. */
  confirmationToken?: string;
  /** Repository layer, used by the read-only `query_database` views. */
  store: Store;
  /** Persist an audit record. Implementations must never throw. */
  audit: (entry: AgentToolAuditEntry) => Promise<void>;
}

/** A tool definition: description, schema, policy, and implementation. */
export interface AgentToolDefinition {
  /** Stable tool name. */
  name: AgentToolName;
  /** Description handed to the model. */
  description: string;
  /** JSON Schema of the arguments. */
  parameters: JsonSchema;
  /** Capability tier used for allowlisting. */
  capability: AgentToolCapability;
  /** Whether the operator must confirm with a token before it runs. */
  destructive: boolean;
  /** Server-side implementation. */
  execute: (args: unknown, context: AgentToolContext) => Promise<AgentToolResult>;
}

/** The outcome of one tool attempt, as consumed by the runner. */
export interface AgentToolExecution {
  /** Tool that ran (or was refused). */
  name: string;
  /** Whether the tool completed. */
  ok: boolean;
  /** One-line summary for the timeline. */
  summary: string;
  /** Payload handed back to the model. */
  data: unknown;
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
  /** Set when the tool refused to run pending operator confirmation. */
  confirmation: {
    /** Token the client must echo back on the next request. */
    token: string;
    /** Why confirmation is required. */
    reason: string;
    /** Hash of the exact arguments the token authorises. */
    argumentsHash: string;
  } | null;
  /** Action name recorded in the audit log. */
  auditAction: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Configuration
 * ──────────────────────────────────────────────────────────────────────────── */

/** Overall timeout for any single tool call. */
const TOOL_TIMEOUT_MS = 15_000;
/** Max bytes returned by `fetch_url`. */
const MAX_FETCH_BYTES = 256 * 1024;
/** Max bytes returned by `read_repo_file`. */
const MAX_READ_BYTES = 128 * 1024;
/** Max bytes accepted by `propose_file_change`. */
const MAX_PROPOSAL_BYTES = 200 * 1024;
/** Max files in one pull request. */
const MAX_PR_FILES = 10;
/** Max bytes per file in a pull request. */
const MAX_PR_FILE_BYTES = 128 * 1024;
/** Max total bytes in a pull request. */
const MAX_PR_TOTAL_BYTES = 512 * 1024;
/** Max directory entries returned by `list_repo_files`. */
const MAX_LIST_ENTRIES = 200;
/** Max search hits returned by `search_web`. */
const MAX_SEARCH_RESULTS = 10;
/** Redirect hops `fetch_url` will follow before giving up. */
const MAX_REDIRECTS = 3;
/** Max rows any `query_database` view will return. */
const MAX_DB_ROWS = 50;
/** Identifying user agent for outbound requests. */
const USER_AGENT = "the-cipher-agent/0.1";

/** Default repo paths the agent may read, relative to `AGENT_REPO_ROOT`. */
const DEFAULT_REPO_ALLOWLIST: readonly string[] = [
  "src",
  "public",
  "README.md",
  "AGENTS.md",
  "package.json",
];

/** Path segments that are never readable or writable. */
const DENIED_SEGMENTS: ReadonlySet<string> = new Set([
  ".git",
  ".next",
  ".vercel",
  ".turbo",
  "node_modules",
  "secrets",
]);

/** File-name suffixes that are never readable or writable. */
const DENIED_SUFFIXES: readonly string[] = [".pem", ".key", ".p12", ".pfx"];

/** Read a trimmed, non-empty environment variable or return `null`. */
function envString(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/** Whether a boolean-ish environment flag is on. */
function envFlag(name: string): boolean {
  const raw = envString(name)?.toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** A comma-separated environment variable as a trimmed list. */
function envList(name: string): string[] {
  const raw = envString(name);
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

/** GitHub connection details, when the deployment has a token and a repo. */
export interface GitHubConfig {
  /** Server-only token; never returned to the browser. */
  token: string;
  /** `owner/name`. */
  repo: string;
  /** The branch pull requests target — never written to directly. */
  defaultBranch: string;
  /** The branch new agent branches are cut from. */
  baseBranch: string;
}

/**
 * The GitHub configuration, or `null` when it is incomplete.
 *
 * `GITHUB_TOKEN` (or `GITHUB_AGENT_TOKEN`) plus `AGENT_GITHUB_REPO` are both
 * required. Without them the agent runs read-only.
 */
export function githubConfig(): GitHubConfig | null {
  const token = envString("GITHUB_TOKEN") ?? envString("GITHUB_AGENT_TOKEN");
  const repo = envString("AGENT_GITHUB_REPO");
  if (!token || !repo) return null;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) return null;
  const defaultBranch = envString("AGENT_GITHUB_DEFAULT_BRANCH") ?? "main";
  const baseBranch = envString("AGENT_GITHUB_BASE_BRANCH") ?? defaultBranch;
  return { token, repo, defaultBranch, baseBranch };
}

/** Whether writes are enabled at all (`AGENT_ENABLE_WRITES`). */
export function agentWritesEnabled(): boolean {
  return envFlag("AGENT_ENABLE_WRITES");
}

/**
 * The agent's effective mode.
 *
 * `"write"` requires both the env opt-in and a GitHub token, so a deployment
 * with no secrets is guaranteed to be read-only.
 */
export function agentMode(): "read-only" | "write" {
  return agentWritesEnabled() && githubConfig() !== null ? "write" : "read-only";
}

/** The repository root the file tools are confined to. */
export function agentRepoRoot(): string {
  return envString("AGENT_REPO_ROOT") ?? process.cwd();
}

/** The allowlisted repo path prefixes, relative to {@link agentRepoRoot}. */
export function agentRepoAllowlist(): readonly string[] {
  const configured = envList("AGENT_REPO_ALLOWLIST");
  return configured.length > 0 ? configured : DEFAULT_REPO_ALLOWLIST;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Repo path safety
 * ──────────────────────────────────────────────────────────────────────────── */

/** Result of resolving an untrusted repo path. */
export type RepoPathResolution =
  | { ok: true; relative: string; absolute: string }
  | { ok: false; error: string };

/** Whether a basename or segment is on the deny list. */
function isDeniedPath(relative: string): boolean {
  const segments = relative.split("/").filter(Boolean);
  for (const segment of segments) {
    if (DENIED_SEGMENTS.has(segment)) return true;
    if (segment.startsWith(".env")) return true;
  }
  const base = segments[segments.length - 1] ?? "";
  return DENIED_SUFFIXES.some((suffix) => base.toLowerCase().endsWith(suffix));
}

/** Whether a relative path sits inside one of the allowlisted prefixes. */
function isAllowedPath(relative: string): boolean {
  return agentRepoAllowlist().some(
    (entry) => relative === entry || relative.startsWith(`${entry}/`),
  );
}

/**
 * Resolve an untrusted repo path against the root allowlist.
 *
 * Rejects absolute paths, Windows separators and drive letters, `..`
 * traversal, null bytes, secret files, and anything outside
 * `AGENT_REPO_ALLOWLIST`. The returned absolute path is proved to be inside the
 * repo root before it is handed to the filesystem.
 */
export function resolveRepoPath(candidate: string): RepoPathResolution {
  if (typeof candidate !== "string" || candidate.trim() === "") {
    return { ok: false, error: "A repository path is required." };
  }
  const raw = candidate.trim();
  if (raw.includes("\0")) {
    return { ok: false, error: "Invalid path." };
  }
  if (raw.startsWith("/") || raw.startsWith("~") || raw.includes("\\")) {
    return { ok: false, error: "Only relative, forward-slash paths are allowed." };
  }
  if (/^[A-Za-z]:/.test(raw)) {
    return { ok: false, error: "Absolute paths are not allowed." };
  }

  const segments = raw.split("/").filter((segment) => segment !== "");
  if (segments.some((segment) => segment === "..")) {
    return { ok: false, error: "Path traversal is not allowed." };
  }

  const relative = segments.join("/");
  if (relative === "") {
    return { ok: false, error: "A repository path is required." };
  }
  if (!isAllowedPath(relative)) {
    return {
      ok: false,
      error: `Path is outside the allowlist. Allowed prefixes: ${agentRepoAllowlist().join(", ")}.`,
    };
  }
  if (isDeniedPath(relative)) {
    return { ok: false, error: "That path is denied by policy." };
  }

  const root = path.resolve(agentRepoRoot());
  const absolute = path.resolve(root, relative);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    return { ok: false, error: "Path traversal is not allowed." };
  }

  return { ok: true, relative, absolute };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Small shared helpers
 * ──────────────────────────────────────────────────────────────────────────── */

/** Whether a value is a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Read a string field from an unknown record. */
function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

/** Turn an unknown thrown value into a short message. */
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

/** Format a Zod failure into one readable line. */
function zodMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "arguments"}: ${issue.message}`)
    .join("; ");
}

/** A refusal produced by argument validation. */
function invalid(tool: string, error: z.ZodError): AgentToolResult {
  return {
    ok: false,
    summary: `Invalid arguments for ${tool}: ${zodMessage(error)}`,
    data: { error: "invalid_arguments", detail: zodMessage(error) },
  };
}

/** A plain refusal with a message and structured detail. */
function refused(summary: string, data: unknown): AgentToolResult {
  return { ok: false, summary, data };
}

/** Abort signal that always fires, so no outbound call can hang. */
function toolSignal(): AbortSignal {
  return AbortSignal.timeout(TOOL_TIMEOUT_MS);
}

/** Overall timeout for a multi-request GitHub operation. */
const GITHUB_TIMEOUT_MS = 45_000;

/** Abort signal covering one whole GitHub operation, not one request. */
function githubSignal(): AbortSignal {
  return AbortSignal.timeout(GITHUB_TIMEOUT_MS);
}

/** Truncate a UTF-8 string to a byte budget without splitting a code point. */
function truncateToBytes(value: string, maxBytes: number): string {
  const buffer = Buffer.from(value, "utf8");
  if (buffer.byteLength <= maxBytes) return value;
  return buffer.subarray(0, maxBytes).toString("utf8");
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tool: search_web
 * ──────────────────────────────────────────────────────────────────────────── */

/** A single web result. */
interface SearchHit {
  /** Page title. */
  title: string;
  /** Absolute page URL. */
  url: string;
  /** Snippet or extracted description. */
  snippet: string;
}

/** Arguments accepted by `search_web`. */
const SearchWebArgs = z.object({
  query: z.string().min(2).max(400),
  maxResults: z.number().int().min(1).max(MAX_SEARCH_RESULTS).optional(),
});

/** Pull hits out of either a Brave or a Tavily response body. */
function extractSearchHits(payload: unknown): SearchHit[] {
  const hits: SearchHit[] = [];
  if (!isRecord(payload)) return hits;

  const web = payload.web;
  if (isRecord(web)) {
    const braveResults: unknown[] = Array.isArray(web.results) ? web.results : [];
    for (const item of braveResults) {
      if (!isRecord(item)) continue;
      hits.push({
        title: stringField(item, "title"),
        url: stringField(item, "url"),
        snippet: stringField(item, "description"),
      });
    }
  }

  const tavilyResults: unknown[] = Array.isArray(payload.results) ? payload.results : [];
  for (const item of tavilyResults) {
    if (!isRecord(item)) continue;
    hits.push({
      title: stringField(item, "title"),
      url: stringField(item, "url"),
      snippet: stringField(item, "content") || stringField(item, "snippet"),
    });
  }

  return hits.filter((hit) => hit.url !== "");
}

/** Search the web through Brave or Tavily, whichever is configured. */
async function executeSearchWeb(args: unknown): Promise<AgentToolResult> {
  const parsed = SearchWebArgs.safeParse(args);
  if (!parsed.success) return invalid("search_web", parsed.error);
  const limit = parsed.data.maxResults ?? 5;

  const braveKey = envString("BRAVE_SEARCH_API_KEY");
  const tavilyKey = envString("TAVILY_API_KEY");

  if (!braveKey && !tavilyKey) {
    return refused(
      "Web search is not configured on this deployment.",
      {
        error: "search_not_configured",
        hint: "Set BRAVE_SEARCH_API_KEY or TAVILY_API_KEY to enable live search.",
        query: parsed.data.query,
      },
    );
  }

  try {
    let payload: unknown;
    let provider: string;

    if (braveKey) {
      provider = "brave";
      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.searchParams.set("q", parsed.data.query);
      url.searchParams.set("count", String(limit));
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          "x-subscription-token": braveKey,
          "user-agent": USER_AGENT,
        },
        signal: toolSignal(),
        cache: "no-store",
      });
      if (!response.ok) {
        return refused(`Web search failed (HTTP ${response.status}).`, {
          error: "search_failed",
          status: response.status,
        });
      }
      payload = await response.json();
    } else {
      provider = "tavily";
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${tavilyKey}`,
          "user-agent": USER_AGENT,
        },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: parsed.data.query,
          max_results: limit,
          search_depth: "basic",
        }),
        signal: toolSignal(),
        cache: "no-store",
      });
      if (!response.ok) {
        return refused(`Web search failed (HTTP ${response.status}).`, {
          error: "search_failed",
          status: response.status,
        });
      }
      payload = await response.json();
    }

    const hits = extractSearchHits(payload).slice(0, limit);
    return {
      ok: true,
      summary: `${hits.length} web result${hits.length === 1 ? "" : "s"} for "${parsed.data.query}" via ${provider}.`,
      data: { provider, query: parsed.data.query, results: hits },
    };
  } catch (error) {
    return refused("Web search failed.", {
      error: "search_failed",
      detail: errorMessage(error),
    });
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tool: fetch_url
 * ──────────────────────────────────────────────────────────────────────────── */

/** Arguments accepted by `fetch_url`. */
const FetchUrlArgs = z.object({ url: z.string().min(1).max(2048) });

/** Whether a hostname points at the local machine or a private network. */
function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (host === "") return true;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  if (host === "::1" || host === "0.0.0.0" || host === "::") return true;

  if (net.isIPv4(host)) {
    const parts = host.split(".").map((part) => Number.parseInt(part, 10));
    const a = parts[0];
    const b = parts[1];
    if (typeof a !== "number" || typeof b !== "number") return true;
    if (Number.isNaN(a) || Number.isNaN(b)) return true;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (net.isIPv6(host)) {
    const normalized = host.toLowerCase();
    if (
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80")
    ) {
      return true;
    }
  }

  return false;
}

/** Parse and vet an outbound URL. */
function parsePublicUrl(
  raw: string,
): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "That is not a valid absolute URL." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Only http and https URLs can be fetched." };
  }
  if (isBlockedHostname(url.hostname)) {
    return {
      ok: false,
      error:
        "That host resolves to a private or local address, which the agent will not fetch.",
    };
  }
  return { ok: true, url };
}

/** Fetch a public URL, validating every redirect hop. */
async function executeFetchUrl(args: unknown): Promise<AgentToolResult> {
  const parsed = FetchUrlArgs.safeParse(args);
  if (!parsed.success) return invalid("fetch_url", parsed.error);

  let current: URL;
  const initial = parsePublicUrl(parsed.data.url);
  if (!initial.ok) {
    return refused(initial.error, { error: "blocked_url", url: parsed.data.url });
  }
  current = initial.url;

  try {
    // One signal covers the whole redirect chain, so the tool cannot exceed its
    // time budget by following hops.
    const signal = toolSignal();

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const response = await fetch(current, {
        redirect: "manual",
        headers: {
          accept: "text/html,application/json,text/plain;q=0.9,*/*;q=0.5",
          "user-agent": USER_AGENT,
        },
        signal,
        cache: "no-store",
      });

      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.has("location")
      ) {
        const location = response.headers.get("location");
        if (!location) break;
        const next = parsePublicUrl(new URL(location, current).toString());
        if (!next.ok) {
          return refused(`Refused to follow a redirect: ${next.error}`, {
            error: "blocked_redirect",
          });
        }
        current = next.url;
        continue;
      }

      const rawBody = await response.text();
      const contentLength = Buffer.byteLength(rawBody, "utf8");
      const body = truncateToBytes(rawBody, MAX_FETCH_BYTES);
      return {
        ok: response.ok,
        summary: `Fetched ${current.hostname} (HTTP ${response.status}, ${contentLength} bytes${contentLength > MAX_FETCH_BYTES ? ", truncated" : ""}).`,
        data: {
          url: current.toString(),
          status: response.status,
          contentType: response.headers.get("content-type") ?? "",
          truncated: contentLength > MAX_FETCH_BYTES,
          bytes: Math.min(contentLength, MAX_FETCH_BYTES),
          text: body,
        },
      };
    }

    return refused("Too many redirects while fetching that URL.", {
      error: "too_many_redirects",
    });
  } catch (error) {
    return refused("The URL could not be fetched.", {
      error: "fetch_failed",
      detail: errorMessage(error),
    });
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tools: read_repo_file / list_repo_files
 * ──────────────────────────────────────────────────────────────────────────── */

/** Arguments accepted by `read_repo_file`. */
const ReadRepoFileArgs = z.object({ path: z.string().min(1).max(512) });

/** Arguments accepted by `list_repo_files`. */
const ListRepoFilesArgs = z.object({
  directory: z.string().max(512).optional(),
});

/** Read a single allowlisted repository file, capped and never recursive. */
async function executeReadRepoFile(args: unknown): Promise<AgentToolResult> {
  const parsed = ReadRepoFileArgs.safeParse(args);
  if (!parsed.success) return invalid("read_repo_file", parsed.error);

  const resolved = resolveRepoPath(parsed.data.path);
  if (!resolved.ok) {
    return refused(resolved.error, { error: "path_not_allowed", path: parsed.data.path });
  }

  try {
    const info = await stat(resolved.absolute);
    if (!info.isFile()) {
      return refused("That path is not a file.", {
        error: "not_a_file",
        path: resolved.relative,
      });
    }

    const handle = await open(resolved.absolute, "r");
    try {
      const buffer = Buffer.alloc(MAX_READ_BYTES);
      const { bytesRead } = await handle.read(buffer, 0, MAX_READ_BYTES, 0);
      const content = buffer.subarray(0, bytesRead).toString("utf8");
      return {
        ok: true,
        summary: `Read ${resolved.relative} (${bytesRead} bytes${info.size > MAX_READ_BYTES ? ", truncated" : ""}).`,
        data: {
          path: resolved.relative,
          bytes: bytesRead,
          truncated: info.size > MAX_READ_BYTES,
          content,
        },
      };
    } finally {
      await handle.close();
    }
  } catch (error) {
    return refused(`Could not read ${resolved.relative}.`, {
      error: "read_failed",
      detail: errorMessage(error),
    });
  }
}

/** List one directory level inside the allowlist, capped and filtered. */
async function executeListRepoFiles(args: unknown): Promise<AgentToolResult> {
  const parsed = ListRepoFilesArgs.safeParse(args);
  if (!parsed.success) return invalid("list_repo_files", parsed.error);

  const requested = parsed.data.directory?.trim() ?? "";
  const root = path.resolve(agentRepoRoot());
  let relativeDirectory = ".";
  let absoluteDirectory = root;

  if (requested !== "" && requested !== ".") {
    const resolved = resolveRepoPath(requested);
    if (!resolved.ok) {
      return refused(resolved.error, {
        error: "path_not_allowed",
        directory: requested,
      });
    }
    relativeDirectory = resolved.relative;
    absoluteDirectory = resolved.absolute;
  }

  try {
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    const visible = entries
      .filter((entry) => {
        const child = relativeDirectory === "." ? entry.name : `${relativeDirectory}/${entry.name}`;
        return !isDeniedPath(child) && isAllowedPath(child);
      })
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    const capped = visible.slice(0, MAX_LIST_ENTRIES);
    const files = capped.map((entry) => ({
      path: relativeDirectory === "." ? entry.name : `${relativeDirectory}/${entry.name}`,
      type: entry.isDirectory() ? "directory" : "file",
    }));

    return {
      ok: true,
      summary: `Listed ${files.length} entr${files.length === 1 ? "y" : "ies"} in ${relativeDirectory}${visible.length > capped.length ? " (truncated)" : ""}.`,
      data: {
        directory: relativeDirectory,
        truncated: visible.length > capped.length,
        entries: files,
      },
    };
  } catch (error) {
    return refused(`Could not list ${relativeDirectory}.`, {
      error: "list_failed",
      detail: errorMessage(error),
    });
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tool: propose_file_change
 * ──────────────────────────────────────────────────────────────────────────── */

/** Arguments accepted by `propose_file_change`. */
const ProposeFileChangeArgs = z.object({
  path: z.string().min(1).max(512),
  contents: z.string().max(MAX_PROPOSAL_BYTES),
  rationale: z.string().min(3).max(2000),
});

/**
 * Record a proposed edit. This tool never touches the filesystem.
 *
 * The proposal is returned to the loop (and persisted with the tool call) plus
 * written to the audit log, so an operator can review exactly what would have
 * changed before any pull request is opened.
 */
async function executeProposeFileChange(
  args: unknown,
  context: AgentToolContext,
): Promise<AgentToolResult> {
  const parsed = ProposeFileChangeArgs.safeParse(args);
  if (!parsed.success) return invalid("propose_file_change", parsed.error);

  const resolved = resolveRepoPath(parsed.data.path);
  if (!resolved.ok) {
    return refused(resolved.error, {
      error: "path_not_allowed",
      path: parsed.data.path,
    });
  }

  const bytes = Buffer.byteLength(parsed.data.contents, "utf8");
  if (bytes > MAX_PROPOSAL_BYTES) {
    return refused("That proposal is larger than the byte limit.", {
      error: "proposal_too_large",
      bytes,
      limit: MAX_PROPOSAL_BYTES,
    });
  }
  const proposalId = `proposal_${randomUUID()}`;
  const digest = createHash("sha256").update(parsed.data.contents, "utf8").digest("hex");

  await context.audit({
    action: "agent.file_change.proposed",
    targetType: "repo_file",
    targetId: resolved.relative,
    after: {
      proposalId,
      path: resolved.relative,
      bytes,
      sha256: digest,
      rationale: parsed.data.rationale,
    },
    metadata: { sessionId: context.sessionId, applied: false },
  });

  return {
    ok: true,
    summary: `Proposed a ${bytes}-byte change to ${resolved.relative} (nothing written).`,
    data: {
      status: "proposed",
      applied: false,
      proposalId,
      path: resolved.relative,
      bytes,
      sha256: digest,
      rationale: parsed.data.rationale,
      next: "Call open_pull_request with the same path and contents after the operator approves.",
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tool: record_note
 * ──────────────────────────────────────────────────────────────────────────── */

/** Arguments accepted by `record_note`. */
const RecordNoteArgs = z.object({
  note: z.string().min(3).max(4000),
});

/** Write a durable note into the audit trail. */
async function executeRecordNote(
  args: unknown,
  context: AgentToolContext,
): Promise<AgentToolResult> {
  const parsed = RecordNoteArgs.safeParse(args);
  if (!parsed.success) return invalid("record_note", parsed.error);

  const noteId = `note_${randomUUID()}`;
  await context.audit({
    action: "agent.note",
    targetType: "agent_session",
    targetId: context.sessionId,
    after: { noteId, note: parsed.data.note },
    metadata: { sessionId: context.sessionId },
  });

  return {
    ok: true,
    summary: `Recorded note ${noteId}.`,
    data: { status: "recorded", noteId, note: parsed.data.note },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * GitHub helpers
 * ──────────────────────────────────────────────────────────────────────────── */

/** A GitHub API result: either parsed JSON or a readable failure. */
type GitHubResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

/** Call the GitHub REST API with the server-only token. */
async function githubRequest<T>(
  config: GitHubConfig,
  apiPath: string,
  init: { method?: string; body?: unknown },
  signal: AbortSignal,
): Promise<GitHubResult<T>> {
  try {
    const response = await fetch(`https://api.github.com${apiPath}`, {
      method: init.method ?? "GET",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${config.token}`,
        "content-type": "application/json",
        "user-agent": USER_AGENT,
        "x-github-api-version": "2022-11-28",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = truncateToBytes(await response.text(), 500);
      return {
        ok: false,
        status: response.status,
        error: `GitHub returned HTTP ${response.status}: ${detail}`,
      };
    }

    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    return { ok: false, status: 0, error: errorMessage(error) };
  }
}

/** Build a legal, unique branch name for an agent change set. */
function agentBranchName(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Date.now().toString(36);
  return `cipher-agent/${slug === "" ? "change" : slug}-${suffix}`;
}

/** One file in a pull request payload. */
const PullRequestFileArgs = z.object({
  path: z.string().min(1).max(512),
  contents: z.string().max(MAX_PR_FILE_BYTES),
});

/** Arguments accepted by `open_pull_request`. */
const OpenPullRequestArgs = z.object({
  title: z.string().min(3).max(200),
  body: z.string().max(20_000),
  changes: z.array(PullRequestFileArgs).min(1).max(MAX_PR_FILES),
});

/**
 * Open a pull request against a throwaway branch.
 *
 * The default branch is only ever used as the pull request **base**; the token
 * is used to create a new `cipher-agent/*` branch and commit to that. There is
 * no code path that writes to the default branch.
 */
async function executeOpenPullRequest(
  args: unknown,
  context: AgentToolContext,
): Promise<AgentToolResult> {
  const parsed = OpenPullRequestArgs.safeParse(args);
  if (!parsed.success) return invalid("open_pull_request", parsed.error);

  const config = githubConfig();
  if (!config) {
    return refused(
      "GitHub is not configured, so a pull request cannot be opened.",
      {
        error: "github_not_configured",
        hint: "Set GITHUB_TOKEN and AGENT_GITHUB_REPO, and enable AGENT_ENABLE_WRITES.",
      },
    );
  }

  let totalBytes = 0;
  const changes: Array<{ path: string; contents: string }> = [];
  for (const change of parsed.data.changes) {
    const resolved = resolveRepoPath(change.path);
    if (!resolved.ok) {
      return refused(resolved.error, {
        error: "path_not_allowed",
        path: change.path,
      });
    }
    const bytes = Buffer.byteLength(change.contents, "utf8");
    if (bytes > MAX_PR_FILE_BYTES) {
      return refused(`${resolved.relative} exceeds the per-file byte limit.`, {
        error: "file_too_large",
        path: resolved.relative,
        bytes,
        limit: MAX_PR_FILE_BYTES,
      });
    }
    totalBytes += bytes;
    changes.push({ path: resolved.relative, contents: change.contents });
  }

  if (totalBytes > MAX_PR_TOTAL_BYTES) {
    return refused("The change set exceeds the total byte limit.", {
      error: "changeset_too_large",
      bytes: totalBytes,
      limit: MAX_PR_TOTAL_BYTES,
    });
  }

  const branch = agentBranchName(parsed.data.title);
  if (branch === config.defaultBranch) {
    return refused("The agent will not write to the default branch.", {
      error: "default_branch_protected",
    });
  }

  const signal = githubSignal();

  const baseRef = await githubRequest<{ object?: { sha?: unknown } }>(
    config,
    `/repos/${config.repo}/git/ref/heads/${encodeURIComponent(config.baseBranch)}`,
    {},
    signal,
  );
  if (!baseRef.ok) {
    return refused(`Could not read the base branch: ${baseRef.error}`, {
      error: "github_error",
      step: "read_base_branch",
    });
  }
  const baseSha = baseRef.data.object?.sha;
  if (typeof baseSha !== "string") {
    return refused("The base branch response had no commit sha.", {
      error: "github_error",
      step: "read_base_branch",
    });
  }

  const createdRef = await githubRequest<unknown>(
    config,
    `/repos/${config.repo}/git/refs`,
    {
      method: "POST",
      body: { ref: `refs/heads/${branch}`, sha: baseSha },
    },
    signal,
  );
  if (!createdRef.ok) {
    return refused(`Could not create the agent branch: ${createdRef.error}`, {
      error: "github_error",
      step: "create_branch",
    });
  }

  for (const change of changes) {
    const written = await githubRequest<unknown>(
      config,
      `/repos/${config.repo}/contents/${change.path
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")}`,
      {
        method: "PUT",
        body: {
          message: `${parsed.data.title}\n\nOpened by the Cipher admin agent.`,
          content: Buffer.from(change.contents, "utf8").toString("base64"),
          branch,
        },
      },
      signal,
    );
    if (!written.ok) {
      return refused(`Could not commit ${change.path}: ${written.error}`, {
        error: "github_error",
        step: "commit_file",
        branch,
        path: change.path,
      });
    }
  }

  const pull = await githubRequest<{ number?: unknown; html_url?: unknown }>(
    config,
    `/repos/${config.repo}/pulls`,
    {
      method: "POST",
      body: {
        title: parsed.data.title,
        body: parsed.data.body,
        head: branch,
        base: config.defaultBranch,
        draft: true,
      },
    },
    signal,
  );
  if (!pull.ok) {
    return refused(`Could not open the pull request: ${pull.error}`, {
      error: "github_error",
      step: "open_pull_request",
      branch,
    });
  }

  const number = typeof pull.data.number === "number" ? pull.data.number : null;
  const url = typeof pull.data.html_url === "string" ? pull.data.html_url : "";

  await context.audit({
    action: "agent.pull_request.opened",
    targetType: "pull_request",
    targetId: number === null ? branch : String(number),
    after: {
      repo: config.repo,
      branch,
      base: config.defaultBranch,
      files: changes.map((change) => change.path),
      bytes: totalBytes,
      url,
    },
    metadata: { sessionId: context.sessionId },
  });

  return {
    ok: true,
    summary: `Opened draft pull request${number === null ? "" : ` #${number}`} on ${branch} with ${changes.length} file(s).`,
    data: {
      status: "opened",
      repo: config.repo,
      branch,
      base: config.defaultBranch,
      number,
      url,
      files: changes.map((change) => change.path),
      totalBytes,
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tool: create_issue
 * ──────────────────────────────────────────────────────────────────────────── */

/** Arguments accepted by `create_issue`. */
const CreateIssueArgs = z.object({
  title: z.string().min(3).max(200),
  body: z.string().max(20_000),
});

/** File a GitHub issue. */
async function executeCreateIssue(
  args: unknown,
  context: AgentToolContext,
): Promise<AgentToolResult> {
  const parsed = CreateIssueArgs.safeParse(args);
  if (!parsed.success) return invalid("create_issue", parsed.error);

  const config = githubConfig();
  if (!config) {
    return refused("GitHub is not configured, so an issue cannot be filed.", {
      error: "github_not_configured",
      hint: "Set GITHUB_TOKEN and AGENT_GITHUB_REPO, and enable AGENT_ENABLE_WRITES.",
    });
  }

  const created = await githubRequest<{ number?: unknown; html_url?: unknown }>(
    config,
    `/repos/${config.repo}/issues`,
    {
      method: "POST",
      body: { title: parsed.data.title, body: parsed.data.body },
    },
    githubSignal(),
  );
  if (!created.ok) {
    return refused(`Could not file the issue: ${created.error}`, {
      error: "github_error",
      step: "create_issue",
    });
  }

  const number =
    typeof created.data.number === "number" ? created.data.number : null;
  const url =
    typeof created.data.html_url === "string" ? created.data.html_url : "";

  await context.audit({
    action: "agent.issue.created",
    targetType: "issue",
    targetId: number === null ? config.repo : String(number),
    after: { repo: config.repo, title: parsed.data.title, url },
    metadata: { sessionId: context.sessionId },
  });

  return {
    ok: true,
    summary: `Filed issue${number === null ? "" : ` #${number}`} on ${config.repo}.`,
    data: { status: "created", repo: config.repo, number, url },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tool: query_database
 * ──────────────────────────────────────────────────────────────────────────── */

/** Arguments accepted by `query_database`. */
const QueryDatabaseArgs = z.object({
  description: z.string().min(2).max(600),
});

/** Tables the read-only catalogue can describe. */
const SCHEMA_CATALOGUE: readonly {
  table: string;
  columns: readonly string[];
  note: string;
}[] = [
  {
    table: "users",
    columns: ["id", "email", "role", "membershipStatus", "tier", "subscriptionStatus", "createdAt"],
    note: "Members and admins. Secret identifiers are never returned.",
  },
  {
    table: "membership_applications",
    columns: ["id", "userId", "status", "answers", "reviewedAt", "createdAt"],
    note: "Applications with their decision state.",
  },
  {
    table: "tiers",
    columns: ["key", "name", "monthlyPriceCents", "features", "displayOrder"],
    note: "The billing tiers.",
  },
  {
    table: "agent_sessions",
    columns: ["id", "userId", "title", "status", "model", "createdAt"],
    note: "Admin agent conversations.",
  },
  {
    table: "audit_log",
    columns: ["id", "actorUserId", "action", "targetType", "targetId", "createdAt"],
    note: "Every privileged action, including agent tool calls.",
  },
];

/** A curated, read-only view over the repository layer. */
interface DatabaseView {
  /** View name reported to the model. */
  name: string;
  /** Human description of what the view answers. */
  description: string;
  /** Lower-case keywords used to match a natural-language description. */
  keywords: readonly string[];
  /** Run the view through the repository layer — never through raw SQL. */
  run: (
    store: Store,
    limit: number,
    adminUserId: string,
  ) => Promise<{ columns: string[]; rows: Record<string, unknown>[]; total: number }>;
}

/** The only queries the agent can run. Everything goes through the Store. */
const DATABASE_VIEWS: readonly DatabaseView[] = [
  {
    name: "members",
    description: "Members with role, membership status, tier, and billing status.",
    keywords: ["member", "user", "account", "people", "signup", "signed up", "tier", "subscription"],
    run: async (store, limit) => {
      const page = await store.listUsers({ page: 1, pageSize: limit });
      return {
        columns: ["id", "email", "role", "membershipStatus", "tier", "subscriptionStatus", "createdAt"],
        rows: page.items.map((user) => ({
          id: user.id,
          email: user.email,
          role: user.role,
          membershipStatus: user.membershipStatus,
          tier: user.tier,
          subscriptionStatus: user.subscriptionStatus,
          createdAt: user.createdAt.toISOString(),
        })),
        total: page.total,
      };
    },
  },
  {
    name: "applications",
    description: "Membership applications and their decision state.",
    keywords: ["application", "applicant", "applied", "apply", "review", "pending"],
    run: async (store, limit) => {
      const rows = await store.listApplications();
      return {
        columns: ["id", "userId", "status", "reviewedAt", "createdAt"],
        rows: rows.slice(0, limit).map((application) => ({
          id: application.id,
          userId: application.userId,
          status: application.status,
          reviewedAt: application.reviewedAt?.toISOString() ?? null,
          createdAt: application.createdAt.toISOString(),
        })),
        total: rows.length,
      };
    },
  },
  {
    name: "tiers",
    description: "The billing tiers with prices and features.",
    keywords: ["tier", "plan", "price", "pricing", "feature"],
    run: async (store) => {
      const rows = await store.listTiers();
      return {
        columns: ["key", "name", "monthlyPriceCents", "features", "displayOrder"],
        rows: rows.map((tier) => ({
          key: tier.key,
          name: tier.name,
          monthlyPriceCents: tier.monthlyPriceCents,
          features: tier.features,
          displayOrder: tier.displayOrder,
        })),
        total: rows.length,
      };
    },
  },
  {
    name: "agent_sessions",
    description: "This admin's agent sessions, newest first.",
    keywords: ["session", "conversation", "chat", "agent"],
    run: async (store, limit, adminUserId) => {
      const rows = await store.listAgentSessions(adminUserId);
      return {
        columns: ["id", "title", "status", "model", "createdAt", "updatedAt"],
        rows: rows.slice(0, limit).map((session) => ({
          id: session.id,
          title: session.title,
          status: session.status,
          model: session.model,
          createdAt: session.createdAt.toISOString(),
          updatedAt: session.updatedAt.toISOString(),
        })),
        total: rows.length,
      };
    },
  },
  {
    name: "audit_log",
    description: "The most recent audit entries, newest first.",
    keywords: ["audit", "log", "history", "action", "activity", "who did"],
    run: async (store, limit) => {
      const rows = await store.listAuditLog(limit);
      return {
        columns: ["id", "actorUserId", "action", "targetType", "targetId", "createdAt"],
        rows: rows.map((entry) => ({
          id: entry.id,
          actorUserId: entry.actorUserId,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          createdAt: entry.createdAt.toISOString(),
        })),
        total: rows.length,
      };
    },
  },
  {
    name: "overview",
    description: "Headline counts across members, applications, and sessions.",
    keywords: ["overview", "summary", "how many", "count", "stats", "statistics", "growth", "total"],
    run: async (store, _limit, adminUserId) => {
      const [members, applications, sessions] = await Promise.all([
        store.listUsers({ page: 1, pageSize: 1 }),
        store.listApplications(),
        store.listAgentSessions(adminUserId),
      ]);
      const approved = applications.filter((row) => row.status === "approved").length;
      const pending = applications.filter((row) => row.status === "pending").length;
      return {
        columns: ["metric", "value"],
        rows: [
          { metric: "members", value: members.total },
          { metric: "applications", value: applications.length },
          { metric: "applications_approved", value: approved },
          { metric: "applications_pending", value: pending },
          { metric: "agent_sessions", value: sessions.length },
        ],
        total: 5,
      };
    },
  },
];

/** How the read-only query helper behaves, described to the model. */
const QUERY_HELPER_NOTE =
  "Views are executed through the repository layer with a hard row cap. SQL is never constructed from your input, and secret identifier columns are not exposed.";

/** Whether a description looks like an attempt to smuggle in raw SQL. */
function looksLikeSql(description: string): boolean {
  if (description.includes(";")) return true;
  return /\b(select|insert|update|delete|drop|alter|truncate|grant|revoke)\b[\s\S]*\b(from|into|table|set|where)\b/i.test(
    description,
  );
}

/**
 * Answer a data question from a curated read-only view.
 *
 * The input is a *description*, never SQL. It is matched against
 * {@link DATABASE_VIEWS}; the matched view runs through the repository layer.
 * No arbitrary statement can be executed, and secret identifier columns are not
 * part of any view.
 */
async function executeQueryDatabase(
  args: unknown,
  context: AgentToolContext,
): Promise<AgentToolResult> {
  const parsed = QueryDatabaseArgs.safeParse(args);
  if (!parsed.success) return invalid("query_database", parsed.error);

  const description = parsed.data.description.trim();

  if (looksLikeSql(description)) {
    return refused(
      "This tool does not execute SQL. Describe what you want to know in words and it will run a curated read-only view.",
      {
        error: "raw_sql_rejected",
        views: DATABASE_VIEWS.map((view) => view.name),
      },
    );
  }

  const needle = description.toLowerCase();
  let best: DatabaseView | null = null;
  let bestScore = 0;
  for (const candidate of DATABASE_VIEWS) {
    let score = 0;
    for (const keyword of candidate.keywords) {
      if (needle.includes(keyword)) score += keyword.length;
    }
    if (needle.includes(candidate.name.replace(/_/g, " "))) score += 10;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  if (!best) {
    return {
      ok: true,
      summary: "No curated view matched that description; returning the catalogue.",
      data: {
        matched: false,
        request: description,
        views: DATABASE_VIEWS.map((view) => ({
          name: view.name,
          description: view.description,
        })),
        schema: SCHEMA_CATALOGUE,
      },
    };
  }

  const view = best;

  try {
    const result = await view.run(context.store, MAX_DB_ROWS, context.adminUserId);
    return {
      ok: true,
      summary: `View "${view.name}" returned ${result.rows.length} of ${result.total} row(s).`,
      data: {
        matched: true,
        view: view.name,
        description: view.description,
        columns: result.columns,
        total: result.total,
        returned: result.rows.length,
        rows: result.rows,
        queryHelper: QUERY_HELPER_NOTE,
        views: DATABASE_VIEWS.map((candidate) => ({
          name: candidate.name,
          description: candidate.description,
        })),
        schema: SCHEMA_CATALOGUE,
      },
    };
  } catch (error) {
    return refused(`The "${view.name}" view could not be read.`, {
      error: "query_failed",
      detail: errorMessage(error),
    });
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * The tool table
 * ──────────────────────────────────────────────────────────────────────────── */

/** Every tool, in the order they are shown to the model. */
export const AGENT_TOOLS: readonly AgentToolDefinition[] = [
  {
    name: "search_web",
    description:
      "Search the public web for current information. Returns titles, URLs, and snippets. Requires a configured search provider.",
    capability: "read",
    destructive: false,
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query.", minLength: 2, maxLength: 400 },
        maxResults: {
          type: "integer",
          description: "How many results to return (1-10). Defaults to 5.",
          minimum: 1,
          maximum: MAX_SEARCH_RESULTS,
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    execute: (args) => executeSearchWeb(args),
  },
  {
    name: "fetch_url",
    description:
      "Fetch a public http(s) URL and return its text. Local, private, and link-local addresses are refused, redirects are re-validated, and the body is truncated.",
    capability: "read",
    destructive: false,
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Absolute http(s) URL to fetch.", maxLength: 2048 },
      },
      required: ["url"],
      additionalProperties: false,
    },
    execute: (args) => executeFetchUrl(args),
  },
  {
    name: "read_repo_file",
    description:
      "Read one allowlisted file from the site repository. Paths are relative, traversal is rejected, and the result is capped at 128 KiB.",
    capability: "read",
    destructive: false,
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Repo-relative path, e.g. src/app/page.tsx.",
          maxLength: 512,
        },
      },
      required: ["path"],
      additionalProperties: false,
    },
    execute: (args) => executeReadRepoFile(args),
  },
  {
    name: "list_repo_files",
    description:
      "List one directory of the site repository. Omit the directory (or pass '.') for the repo root. Denied paths are filtered out.",
    capability: "read",
    destructive: false,
    parameters: {
      type: "object",
      properties: {
        directory: {
          type: "string",
          description: "Repo-relative directory. Defaults to the repo root.",
          maxLength: 512,
        },
      },
      required: [],
      additionalProperties: false,
    },
    execute: (args) => executeListRepoFiles(args),
  },
  {
    name: "query_database",
    description:
      "Answer a question about site data using a curated read-only view. Describe what you want in words; raw SQL is refused. Views: members, applications, tiers, agent_sessions, audit_log, overview.",
    capability: "read",
    destructive: false,
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Natural-language description of the data you want.",
          minLength: 2,
          maxLength: 600,
        },
      },
      required: ["description"],
      additionalProperties: false,
    },
    execute: (args, context) => executeQueryDatabase(args, context),
  },
  {
    name: "record_note",
    description:
      "Write a durable note into the audit trail. Use it to leave a decision or observation for the operator. Requires write mode.",
    capability: "write",
    destructive: false,
    parameters: {
      type: "object",
      properties: {
        note: { type: "string", description: "The note to record.", minLength: 3, maxLength: 4000 },
      },
      required: ["note"],
      additionalProperties: false,
    },
    execute: (args, context) => executeRecordNote(args, context),
  },
  {
    name: "propose_file_change",
    description:
      "Propose an edit to a repository file. This NEVER writes anything: it records a reviewable proposal and returns a hash. Requires write mode.",
    capability: "write",
    destructive: false,
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repo-relative path.", maxLength: 512 },
        contents: {
          type: "string",
          description: "The complete proposed file contents.",
          maxLength: MAX_PROPOSAL_BYTES,
        },
        rationale: {
          type: "string",
          description: "Why this change is being proposed.",
          minLength: 3,
          maxLength: 2000,
        },
      },
      required: ["path", "contents", "rationale"],
      additionalProperties: false,
    },
    execute: (args, context) => executeProposeFileChange(args, context),
  },
  {
    name: "open_pull_request",
    description:
      "Open a draft pull request from a new cipher-agent/* branch. Never pushes to the default branch. Requires write mode and explicit operator confirmation.",
    capability: "github",
    destructive: true,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Pull request title.", minLength: 3, maxLength: 200 },
        body: { type: "string", description: "Pull request description.", maxLength: 20_000 },
        changes: {
          type: "array",
          description: "Files to add or replace (1-10).",
          items: {
            type: "object",
            description: "A file path and its full contents.",
            properties: {
              path: { type: "string", description: "Repo-relative path.", maxLength: 512 },
              contents: {
                type: "string",
                description: "Complete file contents.",
                maxLength: MAX_PR_FILE_BYTES,
              },
            },
          },
        },
      },
      required: ["title", "body", "changes"],
      additionalProperties: false,
    },
    execute: (args, context) => executeOpenPullRequest(args, context),
  },
  {
    name: "create_issue",
    description:
      "File a GitHub issue on the configured repository. Requires write mode and explicit operator confirmation.",
    capability: "github",
    destructive: true,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Issue title.", minLength: 3, maxLength: 200 },
        body: { type: "string", description: "Issue body.", maxLength: 20_000 },
      },
      required: ["title", "body"],
      additionalProperties: false,
    },
    execute: (args, context) => executeCreateIssue(args, context),
  },
];

/**
 * The tools available on this deployment.
 *
 * Read-only is the floor: write and GitHub tools appear only when
 * `AGENT_ENABLE_WRITES=true` **and** a GitHub token plus repo are configured.
 * `AGENT_TOOL_ALLOWLIST` (comma separated) further narrows the set.
 */
export function availableTools(): AgentToolDefinition[] {
  const mode = agentMode();
  const allow = envList("AGENT_TOOL_ALLOWLIST").map((name) => name.toLowerCase());

  return AGENT_TOOLS.filter((tool) => {
    if (mode === "read-only" && tool.capability !== "read") return false;
    if (allow.length > 0 && !allow.includes(tool.name.toLowerCase())) return false;
    return true;
  });
}

/** The names of the tools available on this deployment. */
export function availableToolNames(): string[] {
  return availableTools().map((tool) => tool.name);
}

/**
 * The resolved tool allowlist.
 *
 * Read from `AGENT_TOOL_ALLOWLIST` (comma separated) and intersected with the
 * capability gate: read tools are always present, while write and GitHub tools
 * require `AGENT_ENABLE_WRITES=true` and a configured GitHub token and repo.
 * Evaluated per call so a deployment can change with its environment.
 */
export function agentToolAllowlist(): string[] {
  return availableToolNames();
}

/* ────────────────────────────────────────────────────────────────────────────
 * Confirmation tokens
 * ──────────────────────────────────────────────────────────────────────────── */

/** Per-process fallback secret when no long-lived secret is configured. */
const FALLBACK_CONFIRMATION_SECRET = randomBytes(32).toString("hex");

/** The HMAC secret backing confirmation tokens. */
function confirmationSecret(): string {
  return (
    envString("AGENT_CONFIRMATION_SECRET") ??
    envString("AUTH_SECRET") ??
    envString("OPENAI_API_KEY") ??
    FALLBACK_CONFIRMATION_SECRET
  );
}

/** Deterministic JSON with sorted keys, so a hash is stable across calls. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

/** A short, stable hash of a tool call's arguments. */
export function hashToolArguments(args: unknown): string {
  return createHash("sha256").update(stableStringify(args), "utf8").digest("hex").slice(0, 32);
}

/**
 * Mint a token authorising exactly one tool call.
 *
 * The token binds the session, the tool name, and the argument hash, so an
 * approval for one call can never authorise a different call. With no
 * `AGENT_CONFIRMATION_SECRET`/`AUTH_SECRET`/`OPENAI_API_KEY` present the secret
 * is per-process, which means approvals do not survive a cold start — an
 * intentional fail-closed default.
 */
export function createConfirmationToken(
  sessionId: string,
  toolName: string,
  args: unknown,
): string {
  const material = `${sessionId}\n${toolName}\n${hashToolArguments(args)}`;
  return createHmac("sha256", confirmationSecret()).update(material, "utf8").digest("hex");
}

/** Verify a confirmation token with a constant-time comparison. */
export function verifyConfirmationToken(
  token: string,
  sessionId: string,
  toolName: string,
  args: unknown,
): boolean {
  if (typeof token !== "string" || token.length === 0) return false;
  const expected = createConfirmationToken(sessionId, toolName, args);
  const given = Buffer.from(token, "utf8");
  const want = Buffer.from(expected, "utf8");
  if (given.length !== want.length) return false;
  return timingSafeEqual(given, want);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Execution
 * ──────────────────────────────────────────────────────────────────────────── */

/** Find a currently available tool by name. */
export function findAvailableTool(name: string): AgentToolDefinition | null {
  return availableTools().find((tool) => tool.name === name) ?? null;
}

/**
 * Run one tool call safely.
 *
 * Order of operations: resolve the tool against the live allowlist, enforce
 * confirmation for destructive tools, execute with validation inside the tool,
 * then write exactly one audit row. Refusals are audited too — an attempt is
 * itself security-relevant.
 */
export async function executeAgentTool(
  input: { name: string; args: unknown },
  context: AgentToolContext,
): Promise<AgentToolExecution> {
  const started = Date.now();
  const tool = findAvailableTool(input.name);
  const argumentsHash = hashToolArguments(input.args);

  if (!tool) {
    const execution: AgentToolExecution = {
      name: input.name,
      ok: false,
      summary: `Tool "${input.name}" is not available on this deployment.`,
      data: {
        error: "tool_unavailable",
        available: availableToolNames(),
      },
      durationMs: Date.now() - started,
      confirmation: null,
      auditAction: "agent.tool.unavailable",
    };
    await safeAudit(context, {
      action: execution.auditAction,
      targetType: "agent_session",
      targetId: context.sessionId,
      metadata: { requested: input.name, argumentsHash, mode: agentMode() },
    });
    return execution;
  }

  if (tool.destructive) {
    const token = context.confirmationToken;
    const approved =
      typeof token === "string" &&
      verifyConfirmationToken(token, context.sessionId, tool.name, input.args);

    if (!approved) {
      const proposed = createConfirmationToken(context.sessionId, tool.name, input.args);
      const execution: AgentToolExecution = {
        name: tool.name,
        ok: false,
        summary: `${tool.name} is waiting for explicit operator confirmation; it has not run.`,
        data: {
          status: "awaiting_confirmation",
          tool: tool.name,
          reason:
            "This tool changes something outside the app. The operator must approve the exact arguments before it runs.",
          instruction:
            "Do not retry. Tell the operator that approval is required and wait for them to approve it.",
        },
        durationMs: Date.now() - started,
        confirmation: {
          token: proposed,
          reason: `${tool.name} requires explicit operator confirmation.`,
          argumentsHash,
        },
        auditAction: `agent.tool.${tool.name}.awaiting_confirmation`,
      };
      await safeAudit(context, {
        action: execution.auditAction,
        targetType: "agent_session",
        targetId: context.sessionId,
        metadata: { tool: tool.name, argumentsHash, approved: false },
      });
      return execution;
    }
  }

  try {
    const result = await tool.execute(input.args, context);
    const execution: AgentToolExecution = {
      name: tool.name,
      ok: result.ok,
      summary: result.summary,
      data: result.data,
      durationMs: Date.now() - started,
      confirmation: null,
      auditAction: `agent.tool.${tool.name}`,
    };
    await safeAudit(context, {
      action: execution.auditAction,
      targetType: "agent_session",
      targetId: context.sessionId,
      metadata: {
        tool: tool.name,
        capability: tool.capability,
        argumentsHash,
        ok: result.ok,
        durationMs: execution.durationMs,
      },
    });
    return execution;
  } catch (error) {
    const execution: AgentToolExecution = {
      name: tool.name,
      ok: false,
      summary: `${tool.name} failed: ${errorMessage(error)}`,
      data: { error: "tool_threw", detail: errorMessage(error) },
      durationMs: Date.now() - started,
      confirmation: null,
      auditAction: `agent.tool.${tool.name}.failed`,
    };
    await safeAudit(context, {
      action: execution.auditAction,
      targetType: "agent_session",
      targetId: context.sessionId,
      metadata: { tool: tool.name, argumentsHash, error: errorMessage(error) },
    });
    return execution;
  }
}

/** Write an audit entry, swallowing (but not hiding) persistence failures. */
async function safeAudit(
  context: AgentToolContext,
  entry: AgentToolAuditEntry,
): Promise<void> {
  try {
    await context.audit(entry);
  } catch {
    // An audit write failure must never abort the tool loop; the caller's own
    // store implementation is responsible for durability.
  }
}
