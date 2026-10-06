import type { NextRequest } from "next/server";
import { handleAuthError, requireMember, requireTier } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import type { LiveCall } from "@/lib/db/schema";

/**
 * `/api/calls/[id]/ics`
 *
 * Hand-rolled iCalendar (RFC 5545) download — no dependency.
 *
 * The calendar file is generated server-side and requires an approved member,
 * for the same reason the join link does: the event carries the room URL, and
 * that must not be handed to an applicant or an anonymous visitor. The route
 * returns only the fields a calendar client needs.
 */

const CRLF = "\r\n";

/** Format an instant as a UTC iCalendar timestamp (`YYYYMMDDTHHMMSSZ`). */
function formatIcsDate(date: Date): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/**
 * Escape a value for an iCalendar property.
 *
 * Backslash first, then the property delimiters, then newlines — order matters
 * or the escape characters themselves get escaped.
 */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold a content line to 75 octets per RFC 5545 §3.1.
 *
 * Folding is done on character boundaries rather than bytes; for the ASCII
 * content this app emits the two are identical, and multi-byte content is
 * measured conservatively by character count.
 */
function foldLine(line: string): string {
  if (line.length <= 74) return line;
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    chunks.push(rest.slice(0, 74));
    rest = rest.slice(74);
  }
  chunks.push(rest);
  return chunks.join(`${CRLF} `);
}

/** Build a complete one-event calendar for a call. */
function buildIcs(call: LiveCall, now: Date): string {
  const start = new Date(call.startsAt);
  const end = new Date(start.getTime() + call.durationMinutes * 60_000);
  const descriptionParts = [call.description?.trim()].filter(
    (part): part is string => Boolean(part),
  );
  if (call.roomUrl) descriptionParts.push(`Join: ${call.roomUrl}`);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Cipher//Live Calls//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:The Cipher — Live Calls",
    "BEGIN:VEVENT",
    `UID:${call.id}@thecipher`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(call.title)}`,
    `DESCRIPTION:${escapeIcsText(descriptionParts.join("\n\n"))}`,
    "STATUS:CONFIRMED",
  ];

  if (call.roomUrl) lines.push(`URL:${escapeIcsText(call.roomUrl)}`);
  if (call.recurring && call.recurrenceRule) {
    lines.push(`RRULE:${call.recurrenceRule}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.map(foldLine).join(CRLF) + CRLF;
}

/**
 * Download a call as an `.ics` file.
 *
 * @param _request - Unused.
 * @param context - Route context carrying the call `id`.
 * @returns The calendar file, or a 404 when the call does not exist.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/calls/[id]/ics">,
) {
  try {
    const user = await requireMember();
    const { id } = await context.params;
    const store = getStore();

    const call = await store.getCallById(id);
    if (!call) {
      return Response.json({ ok: false, error: "Call not found." }, { status: 404 });
    }
    // The calendar file carries the room link, so it is gated like the call.
    requireTier(user, call.tierRequired ?? "initiate", "This call");

    const filename = `the-cipher-${call.slug.replace(/[^a-z0-9-]+/gi, "-")}.ics`;
    return new Response(buildIcs(call, new Date()), {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return (
      handleAuthError(error) ??
      Response.json({ ok: false, error: "Could not build the calendar file." }, { status: 500 })
    );
  }
}
