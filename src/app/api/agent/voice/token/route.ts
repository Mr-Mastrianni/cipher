/**
 * `POST /api/agent/voice/token` — mint a short-lived realtime voice credential.
 *
 * Two providers are supported behind env flags:
 *
 *  - `openai` — the server calls OpenAI's realtime session endpoint with the
 *    server key and returns **only** the ephemeral client secret plus the model
 *    name. The API key never leaves the server.
 *  - `webspeech` — a zero-key fallback: the browser uses the Web Speech API
 *    directly. This is available on every deployment.
 *
 * `AGENT_VOICE_PROVIDER` selects `openai`, `webspeech`, or `auto` (the default,
 * which prefers OpenAI when a key exists and falls back to Web Speech).
 * `AGENT_VOICE_PROVIDER=openai` without a key is a 503 rather than a silent
 * downgrade, and `AGENT_VOICE_DISABLED=true` disables voice entirely.
 */

import type { NextRequest } from "next/server";

import { handleAuthError, requireAdmin } from "@/lib/auth";

/** Voice credentials are minted server-side; run on Node.js. */
export const runtime = "nodejs";
/** Credentials are per-admin and short-lived; never cache them. */
export const dynamic = "force-dynamic";

/** Default realtime model. */
const DEFAULT_REALTIME_MODEL = "gpt-4o-realtime-preview";
/** Default realtime voice. */
const DEFAULT_REALTIME_VOICE = "alloy";
/** Timeout for the upstream realtime session call. */
const REALTIME_TIMEOUT_MS = 10_000;

/** Voice provider selection. */
type VoiceProvider = "openai" | "webspeech" | "auto";

/** Read a trimmed, non-empty environment variable or return `null`. */
function envValue(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/** The configured provider, defaulting to `auto` for unknown values. */
function voiceProvider(): VoiceProvider {
  const configured = envValue("AGENT_VOICE_PROVIDER")?.toLowerCase();
  if (configured === "openai") return "openai";
  if (configured === "webspeech") return "webspeech";
  return "auto";
}

/** The upstream realtime session endpoint. */
function realtimeUrl(): string {
  return (
    envValue("AGENT_REALTIME_URL") ?? "https://api.openai.com/v1/realtime/sessions"
  );
}

/** Whether a value is a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Build the browser-native fallback payload. */
function webspeechResponse(): Response {
  return Response.json({
    ok: true,
    provider: "webspeech",
    model: null,
    clientSecret: null,
    expiresAt: null,
    note: "Using the browser's built-in speech recognition and synthesis. No key is required and nothing is sent to this server unless transcription falls back to the transcribe endpoint.",
  });
}

/** Request an ephemeral OpenAI realtime credential. */
async function openAiRealtimeResponse(apiKey: string): Promise<Response> {
  const model = envValue("AGENT_REALTIME_MODEL") ?? DEFAULT_REALTIME_MODEL;
  const voice = envValue("AGENT_REALTIME_VOICE") ?? DEFAULT_REALTIME_VOICE;

  let upstream: Response;
  try {
    upstream = await fetch(realtimeUrl(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "user-agent": "the-cipher-agent/0.1",
      },
      body: JSON.stringify({
        model,
        voice,
        modalities: ["audio", "text"],
        instructions:
          "You are the voice interface of The Cipher's admin agent. Keep replies short and speak plainly. Never read secrets or identifiers aloud.",
      }),
      signal: AbortSignal.timeout(REALTIME_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { ok: false, error: "The realtime voice provider could not be reached." },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    return Response.json(
      {
        ok: false,
        error: `The realtime voice provider returned HTTP ${upstream.status}.`,
      },
      { status: 502 },
    );
  }

  const payload: unknown = await upstream.json().catch(() => null);
  if (!isRecord(payload)) {
    return Response.json(
      { ok: false, error: "The realtime voice provider returned an unexpected body." },
      { status: 502 },
    );
  }

  const secret = payload.client_secret;
  const clientSecret =
    typeof secret === "string"
      ? secret
      : isRecord(secret) && typeof secret.value === "string"
        ? secret.value
        : null;
  const expiresAt =
    isRecord(secret) && typeof secret.expires_at === "number"
      ? secret.expires_at
      : null;
  const responseModel = typeof payload.model === "string" ? payload.model : model;

  if (!clientSecret) {
    return Response.json(
      {
        ok: false,
        error: "The realtime voice provider did not return an ephemeral credential.",
      },
      { status: 502 },
    );
  }

  // Only the ephemeral credential leaves the server — never the API key.
  return Response.json({
    ok: true,
    provider: "openai-realtime",
    model: responseModel,
    clientSecret,
    expiresAt,
    note: "The credential is short-lived and scoped to a single realtime session.",
  });
}

/** POST handler. See the file header for the contract. */
export async function POST(_request: NextRequest): Promise<Response> {
  try {
    await requireAdmin();

    if (envValue("AGENT_VOICE_DISABLED")?.toLowerCase() === "true") {
      return Response.json(
        {
          ok: false,
          error: "Voice is disabled on this deployment (AGENT_VOICE_DISABLED=true).",
        },
        { status: 503 },
      );
    }

    const provider = voiceProvider();
    const apiKey = envValue("OPENAI_API_KEY");

    if (provider === "webspeech") return webspeechResponse();

    if (provider === "openai") {
      if (!apiKey) {
        return Response.json(
          {
            ok: false,
            error:
              "Realtime voice is set to OpenAI but OPENAI_API_KEY is not set on this deployment.",
          },
          { status: 503 },
        );
      }
      const response = await openAiRealtimeResponse(apiKey);
      if (response.ok) return response;
      return response;
    }

    // auto: prefer realtime when a key exists, otherwise the zero-key fallback.
    if (!apiKey) return webspeechResponse();

    const realtime = await openAiRealtimeResponse(apiKey);
    if (realtime.ok) return realtime;
    return webspeechResponse();
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return Response.json(
      { ok: false, error: "A voice credential could not be minted." },
      { status: 500 },
    );
  }
}
