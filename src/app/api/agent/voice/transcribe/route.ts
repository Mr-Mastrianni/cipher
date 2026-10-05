/**
 * `POST /api/agent/voice/transcribe` — server-side speech-to-text fallback.
 *
 * The voice layer prefers the browser's `SpeechRecognition` API. When that is
 * unavailable it records with `MediaRecorder` and posts the clip here as
 * `multipart/form-data` (`audio` field, optional `language`). This route proxies
 * the clip to the configured OpenAI-compatible transcription endpoint.
 *
 * When `OPENAI_API_KEY` is unset the route is an honest 503: the client shows
 * "server transcription is not configured" instead of failing silently. The key
 * is never echoed, logged, or returned.
 */

import type { NextRequest } from "next/server";

import { handleAuthError, requireAdmin } from "@/lib/auth";

/** FormData proxying needs the Node.js runtime. */
export const runtime = "nodejs";
/** Clips are per-request; never cache or prerender them. */
export const dynamic = "force-dynamic";
/** Transcription of a long clip can exceed the default function timeout. */
export const maxDuration = 60;

/** Maximum accepted clip size (12 MiB). */
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
/** Default transcription model. */
const DEFAULT_TRANSCRIBE_MODEL = "whisper-1";
/** Upstream timeout. */
const TRANSCRIBE_TIMEOUT_MS = 60_000;

/** Read a trimmed, non-empty environment variable or return `null`. */
function envValue(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/** The OpenAI-compatible base URL, without a trailing slash. */
function baseUrl(): string {
  return (envValue("OPENAI_BASE_URL") ?? "https://api.openai.com/v1").replace(
    /\/+$/,
    "",
  );
}

/** POST handler. See the file header for the contract. */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    await requireAdmin();

    const apiKey = envValue("OPENAI_API_KEY");
    if (!apiKey) {
      return Response.json(
        {
          ok: false,
          error:
            "Server transcription is not configured on this deployment. Set OPENAI_API_KEY, or use a browser that supports the Web Speech API.",
        },
        { status: 503 },
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json(
        { ok: false, error: "Send the clip as multipart/form-data." },
        { status: 400 },
      );
    }

    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size === 0) {
      return Response.json(
        { ok: false, error: "The `audio` field must be a non-empty audio clip." },
        { status: 400 },
      );
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return Response.json(
        {
          ok: false,
          error: `That clip is larger than the ${Math.round(MAX_AUDIO_BYTES / (1024 * 1024))} MiB limit.`,
        },
        { status: 413 },
      );
    }
    if (audio.type !== "" && !audio.type.startsWith("audio/")) {
      return Response.json(
        { ok: false, error: "That file is not an audio clip." },
        { status: 415 },
      );
    }

    const requestedLanguage = form.get("language");
    const language =
      typeof requestedLanguage === "string" && requestedLanguage.trim() !== ""
        ? requestedLanguage.trim().slice(0, 16)
        : null;

    const upstreamForm = new FormData();
    const filename = audio instanceof File && audio.name !== "" ? audio.name : "clip.webm";
    upstreamForm.append("file", audio, filename);
    upstreamForm.append(
      "model",
      envValue("AGENT_TRANSCRIBE_MODEL") ?? DEFAULT_TRANSCRIBE_MODEL,
    );
    if (language) upstreamForm.append("language", language);

    let upstream: Response;
    try {
      upstream = await fetch(`${baseUrl()}/audio/transcriptions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "user-agent": "the-cipher-agent/0.1",
        },
        body: upstreamForm,
        signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      return Response.json(
        { ok: false, error: "The transcription provider could not be reached." },
        { status: 502 },
      );
    }

    if (!upstream.ok) {
      return Response.json(
        {
          ok: false,
          error: `The transcription provider returned HTTP ${upstream.status}.`,
        },
        { status: 502 },
      );
    }

    const payload: unknown = await upstream.json().catch(() => null);
    const text =
      payload !== null &&
      typeof payload === "object" &&
      "text" in payload &&
      typeof (payload as { text?: unknown }).text === "string"
        ? (payload as { text: string }).text
        : "";

    return Response.json({ ok: true, text });
  } catch (error) {
    const authResponse = handleAuthError(error);
    if (authResponse) return authResponse;
    return Response.json(
      { ok: false, error: "The clip could not be transcribed." },
      { status: 500 },
    );
  }
}
