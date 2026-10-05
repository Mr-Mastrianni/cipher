/**
 * `/api/agent/sessions/[id]` — read or archive one agent session.
 *
 * `params` is a promise in Next.js 16, so the typed `RouteContext` helper is
 * awaited before the resource is resolved. Ownership is enforced on every verb:
 * a session that belongs to another admin is a 404, not a 403, so ids cannot be
 * probed.
 *
 * Archiving note: `Store` has no `archiveAgentSession` method. When a database
 * is configured the route updates `agent_sessions` through Drizzle directly;
 * the `MemoryStore` fallback returns live row references, so the demo store is
 * mutated in place. Both paths converge on a re-read from the store.
 */

import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { handleAuthError, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { agentSessions, type AgentSession } from "@/lib/db/schema";
import { getStore } from "@/lib/db/store";

/** Session access goes through the Node.js runtime. */
export const runtime = "nodejs";
/** Sessions are per-admin; never cache or prerender them. */
export const dynamic = "force-dynamic";

/** Archive a session through whichever persistence path is configured. */
async function archiveSession(sessionId: string): Promise<AgentSession | null> {
  const store = getStore();
  const database = db;

  if (database) {
    await database
      .update(agentSessions)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(agentSessions.id, sessionId));
  } else {
    const session = await store.getAgentSession(sessionId);
    if (session) session.status = "archived";
  }

  return store.getAgentSession(sessionId);
}

/** GET handler: the session plus its messages, oldest first. */
export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/agent/sessions/[id]">,
): Promise<Response> {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;

    const store = getStore();
    const session = await store.getAgentSession(id);
    if (!session || session.userId !== admin.id) {
      return Response.json(
        { ok: false, error: "That session does not exist." },
        { status: 404 },
      );
    }

    const messages = await store.listAgentMessages(id, 200);

    return Response.json({
      ok: true,
      session: {
        id: session.id,
        title: session.title,
        status: session.status,
        model: session.model,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      },
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        toolCalls: message.toolCalls ?? null,
        toolCallId: message.toolCallId,
        toolName: message.toolName,
        createdAt: message.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return Response.json(
      { ok: false, error: "The session could not be loaded." },
      { status: 500 },
    );
  }
}

/** DELETE handler: archive the session, keeping its transcript. */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/agent/sessions/[id]">,
): Promise<Response> {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;

    const store = getStore();
    const existing = await store.getAgentSession(id);
    if (!existing || existing.userId !== admin.id) {
      return Response.json(
        { ok: false, error: "That session does not exist." },
        { status: 404 },
      );
    }

    const archived = await archiveSession(id);
    return Response.json({
      ok: true,
      archived: archived?.status === "archived",
      sessionId: id,
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return Response.json(
      { ok: false, error: "The session could not be archived." },
      { status: 500 },
    );
  }
}
