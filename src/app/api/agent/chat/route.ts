/**
 * `POST /api/agent/chat` — the admin agent's streaming endpoint.
 *
 * Body: `{ sessionId?: string, message: string, confirmationToken?: string }`.
 *
 * The response is newline-delimited JSON: one `AgentStreamEvent` per line, sent
 * as the turn runs. That keeps the transcript streaming token-by-token while
 * still carrying structured tool events the console can render.
 *
 * Guards, in order:
 *  - `requireAdmin()` — this endpoint is never reachable by a member.
 *  - A per-admin token bucket, plus one in-flight run per session.
 *  - The session must belong to the calling admin, so ids cannot be probed.
 *
 * No environment value is ever placed on the stream; the opening `status`
 * event carries only booleans, a model name, and tool names.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { handleAuthError, requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import {
  agentModel,
  isAgentConfigured,
  runAgentTurn,
  type AgentStreamEvent,
} from "@/lib/agent/runner";
import {
  agentMode,
  agentWritesEnabled,
  availableToolNames,
  githubConfig,
} from "@/lib/agent/tools";

/** The agent reads the filesystem and calls outbound APIs; run on Node.js. */
export const runtime = "nodejs";
/** Turns are per-request and streamed; never cache or prerender them. */
export const dynamic = "force-dynamic";
/** A long agent turn needs headroom beyond the default function timeout. */
export const maxDuration = 300;

/** Sliding window for the per-admin rate limit. */
const RATE_WINDOW_MS = 60_000;
/** Maximum agent turns one admin may start per window. */
const RATE_MAX_TURNS = 20;
/** Maximum characters in one operator message. */
const MAX_MESSAGE_LENGTH = 8000;

/** Recent turn timestamps per admin, keyed by user id. */
const rateBuckets = new Map<string, number[]>();

/** Sessions with a turn currently running, so two runs cannot interleave. */
const inFlight = new Set<string>();

/** Shape of the chat request body. */
const ChatRequestSchema = z.object({
  sessionId: z.string().min(1).max(64).optional(),
  message: z.string().min(1).max(MAX_MESSAGE_LENGTH),
  confirmationToken: z.string().max(256).optional(),
});

/**
 * Sliding-window rate limit.
 *
 * In-process only: it protects a single instance from a runaway client, and is
 * deliberately not presented as a distributed limiter.
 */
function isRateLimited(adminUserId: string): boolean {
  const now = Date.now();
  const recent = (rateBuckets.get(adminUserId) ?? []).filter(
    (at) => now - at < RATE_WINDOW_MS,
  );
  if (recent.length >= RATE_MAX_TURNS) {
    rateBuckets.set(adminUserId, recent);
    return true;
  }
  recent.push(now);
  rateBuckets.set(adminUserId, recent);
  return false;
}

/** Derive a short session title from the first message. */
function deriveTitle(message: string): string {
  const single = message.replace(/\s+/g, " ").trim();
  return single.length <= 60 ? single : `${single.slice(0, 57)}…`;
}

/** POST handler. See the file header for the contract. */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const admin = await requireAdmin();

    if (isRateLimited(admin.id)) {
      return Response.json(
        {
          ok: false,
          error: "Too many agent turns in the last minute. Wait a moment and try again.",
        },
        { status: 429, headers: { "retry-after": "60" } },
      );
    }

    const parsed = ChatRequestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return Response.json(
        {
          ok: false,
          error: `Send { message: string } (1-${MAX_MESSAGE_LENGTH} characters).`,
        },
        { status: 400 },
      );
    }

    const store = getStore();

    let sessionId: string;
    if (parsed.data.sessionId) {
      const session = await store.getAgentSession(parsed.data.sessionId);
      if (!session || session.userId !== admin.id) {
        return Response.json(
          { ok: false, error: "That session does not exist." },
          { status: 404 },
        );
      }
      if (session.status === "archived") {
        return Response.json(
          { ok: false, error: "That session is archived. Start a new one." },
          { status: 409 },
        );
      }
      sessionId = session.id;
    } else {
      const created = await store.createAgentSession({
        userId: admin.id,
        title: deriveTitle(parsed.data.message),
        model: isAgentConfigured() ? agentModel() : null,
      });
      sessionId = created.id;
    }

    if (inFlight.has(sessionId)) {
      return Response.json(
        {
          ok: false,
          error: "This session is already running a turn. Wait for it to finish.",
        },
        { status: 409 },
      );
    }
    inFlight.add(sessionId);

    await store.appendAgentMessage({
      sessionId,
      role: "user",
      content: parsed.data.message,
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const events = runAgentTurn({
            store,
            adminUserId: admin.id,
            sessionId,
            confirmationToken: parsed.data.confirmationToken,
          });
          for await (const event of events) {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          }
        } catch {
          const failure: AgentStreamEvent = {
            type: "error",
            message: "The agent turn failed unexpectedly. The session is intact.",
          };
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(failure)}\n`));
          } catch {
            // The client is already gone.
          }
        } finally {
          inFlight.delete(sessionId);
          try {
            controller.close();
          } catch {
            // Already closed by the consumer.
          }
        }
      },
      cancel() {
        inFlight.delete(sessionId);
      },
    });

    return new Response(body, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store, no-transform",
        "x-accel-buffering": "no",
      },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return Response.json(
      { ok: false, error: "The agent could not start a turn." },
      { status: 500 },
    );
  }
}

/** GET is not supported; the console uses the sessions endpoint instead. */
export async function GET(): Promise<Response> {
  return Response.json(
    {
      ok: false,
      error: "Use POST to send a message.",
      status: {
        configured: isAgentConfigured(),
        mode: agentMode(),
        model: isAgentConfigured() ? agentModel() : null,
        tools: availableToolNames(),
        github: githubConfig() !== null,
        writes: agentWritesEnabled(),
      },
    },
    { status: 405, headers: { allow: "POST" } },
  );
}
