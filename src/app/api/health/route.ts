import { isDatabaseConfigured } from "@/lib/db/client";

/**
 * Liveness and configuration probe.
 *
 * Deliberately reports only whether each integration is configured — never the
 * values, never a connection string, never a stack trace. It is safe to expose
 * publicly and useful for uptime checks and for the "demo mode" banner.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const integrations = {
    clerk: Boolean(
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
        process.env.CLERK_SECRET_KEY,
    ),
    database: isDatabaseConfigured(),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    agent: Boolean(process.env.OPENAI_API_KEY),
    github: Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO),
    realtime: Boolean(process.env.ABLY_API_KEY),
    calls: Boolean(process.env.DAILY_API_KEY),
    email: Boolean(process.env.RESEND_API_KEY),
  };

  const configured = Object.values(integrations).filter(Boolean).length;

  return Response.json(
    {
      ok: true,
      service: "the-cipher",
      time: new Date().toISOString(),
      mode: configured === 0 ? "standalone" : "integrated",
      integrations,
    },
    {
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
