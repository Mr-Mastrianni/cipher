/**
 * The one validation schema for KP birth data, shared by every entry point
 * (the chart API, birth-time verification and onboarding).
 *
 * KP demands the birth time to the second and an explicit answer whenever the
 * local time is ambiguous, so `second` is required and there is no "time
 * unknown" path anywhere.
 */

import { z } from "zod";

/** The span the KP engine is verified over against the Swiss Ephemeris (with margin). */
export const KP_MIN_YEAR = 1900;
export const KP_MAX_YEAR = 2100;

function isRealCalendarDate(value: { year: number; month: number; day: number }): boolean {
  const date = new Date(Date.UTC(2000, value.month - 1, value.day));
  date.setUTCFullYear(value.year);
  return (
    date.getUTCFullYear() === value.year &&
    date.getUTCMonth() === value.month - 1 &&
    date.getUTCDate() === value.day
  );
}

export const kpBirthSchema = z
  .object({
    year: z.number().int().min(KP_MIN_YEAR).max(KP_MAX_YEAR),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    second: z.number({ error: "The birth time is needed to the second." }).int().min(0).max(59),
    timeZone: z.string().min(1).max(64),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    placeName: z.string().max(160).optional(),
    fold: z.enum(["earlier", "later"]).optional(),
    nodeType: z.enum(["mean", "true"]).optional(),
  })
  .refine(isRealCalendarDate, { message: "That calendar date does not exist.", path: ["day"] });

export type KpBirthPayload = z.infer<typeof kpBirthSchema>;

/** First validation issue as `path: message`, for a 400 body. */
export function describeIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue?.path.join(".") ?? "";
  const detail = issue?.message ?? "Invalid birth data.";
  return path ? `${path}: ${detail}` : detail;
}
