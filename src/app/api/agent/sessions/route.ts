/**
 * `/api/agent/sessions` — list and create agent sessions for the admin.
 *
 * GET also returns the deployment's agent capability snapshot (whether a model
 * key is present, read-only vs write mode, and the tool names), which is what
 * the console renders before the first message. It contains no secrets: only
 * booleans, a model id, and tool names.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { handleAuthError, requireAdmin } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { agentModel, isAgentConfigured } from "@/lib/agent/runner";
import {
  agentMode,
  agentWritesEnabled,
  availableToolNames,
  githubConfig,
} from "@/lib/agent/tools";

/** Session access goes through the Node.js runtime. */
export const runtime = "nodejs";
/** Sessions are per-admin; never cache or prerender them. */
export const dynamic = "force-dynamic";

/** Shape of the create-session body. */
const CreateSessionSchema = z.object({
  title: z.string().min(1).max(120).optional(),
});

/** GET handler: this admin's sessions plus the agent capability snapshot. */
export async function GET(): Promise<Response> {
  try {
    const admin = await requireAdmin();
    const store = getStore();
    const sessions = await store.listAgentSessions(admin.id);

    return Response.json({
      ok: true,
      sessions: sessions.map((session) => ({
        id: session.id,
        title: session.title,
        status: session.status,
        model: session.model,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      })),
      agent: {
        configured: isAgentConfigured(),
        mode: agentMode(),
        model: isAgentConfigured() ? agentModel() : null,
        tools: availableToolNames(),
        github: githubConfig() !== null,
        writes: agentWritesEnabled(),
      },
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return Response.json(
      { ok: false, error: "Sessions could not be loaded." },
      { status: 500 },
    );
  }
}

/** POST handler: open a new, empty session. */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const admin = await requireAdmin();
    const parsed = CreateSessionSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return Response.json(
        { ok: false, error: "A session title must be 1-120 characters." },
        { status: 400 },
      );
    }

    const store = getStore();
    const session = await store.createAgentSession({
      userId: admin.id,
      title: parsed.data.title ?? "New session",
      model: isAgentConfigured() ? agentModel() : null,
    });

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
    });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return Response.json(
      { ok: false, error: "The session could not be created." },
      { status: 500 },
    );
  }
}
