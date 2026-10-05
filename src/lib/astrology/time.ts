/**
 * Wall-clock → UTC resolution for birth data.
 *
 * ACCURACY NOTES
 * --------------
 * - Luxon resolves IANA zones through the host's `Intl`/ICU tzdata. Two
 *   environments with different ICU versions can resolve the same historical
 *   wall-clock time to different offsets, so a chart should record the tzdata
 *   version it was computed with. The tz database is authoritative but
 *   best-effort before 1970; wartime DST, "War Time", British Double Summer
 *   Time and pre-standard-time local mean time are encoded for many but not all
 *   zones.
 * - A local time in a spring-forward gap does not exist, and one in a
 *   fall-back fold occurs twice. Both are detected explicitly here and reported
 *   through `warnings`; the instant is never chosen silently.
 */

import { DateTime, IANAZone } from "luxon";
import type { BirthInput } from "./types";

const DAY_MS = 86_400_000;

/** How to break a tie when the wall-clock time occurs twice. */
export interface ResolveBirthOptions {
  /**
   * Which occurrence of an ambiguous (fall-back) local time to use.
   * Defaults to `"earlier"`, the pre-transition offset.
   */
  fold?: "earlier" | "later";
}

/** A resolved UTC instant plus everything worth telling the user about it. */
export interface ResolvedInstant {
  date: Date;
  warnings: string[];
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatWallClock(input: BirthInput, second: number): string {
  return (
    `${String(input.year).padStart(4, "0")}-${pad2(input.month)}-${pad2(input.day)} ` +
    `${pad2(input.hour)}:${pad2(input.minute)}:${pad2(second)}`
  );
}

/** Format an offset in minutes as `UTC+05:30`. */
function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  return `UTC${sign}${pad2(Math.floor(absolute / 60))}:${pad2(absolute % 60)}`;
}

/** Wall-clock fields read as if they were UTC, i.e. the naive instant. */
function naiveUtcMillis(input: BirthInput, second: number): number {
  const date = new Date(
    Date.UTC(2000, input.month - 1, input.day, input.hour, input.minute, second),
  );
  // `Date.UTC` maps 0–99 to 1900–1999, so set the year explicitly afterwards.
  date.setUTCFullYear(input.year);
  return date.getTime();
}

function validate(input: BirthInput, second: number): void {
  const { year, month, day, hour, minute } = input;

  const integer = (value: number, name: string): void => {
    if (!Number.isInteger(value)) {
      throw new RangeError(`Birth ${name} must be an integer, received ${value}.`);
    }
  };

  integer(year, "year");
  integer(month, "month");
  integer(day, "day");
  integer(hour, "hour");
  integer(minute, "minute");
  integer(second, "second");

  if (year < 1 || year > 9999) throw new RangeError(`Birth year ${year} is outside 1–9999.`);
  if (month < 1 || month > 12) throw new RangeError(`Birth month ${month} is outside 1–12.`);
  if (day < 1 || day > 31) throw new RangeError(`Birth day ${day} is outside 1–31.`);
  if (hour < 0 || hour > 23) throw new RangeError(`Birth hour ${hour} is outside 0–23.`);
  if (minute < 0 || minute > 59) throw new RangeError(`Birth minute ${minute} is outside 0–59.`);
  if (second < 0 || second > 59) throw new RangeError(`Birth second ${second} is outside 0–59.`);

  if (!Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90) {
    throw new RangeError(`Birth latitude ${input.latitude} is outside -90–90.`);
  }
  if (!Number.isFinite(input.longitude) || Math.abs(input.longitude) > 360) {
    throw new RangeError(`Birth longitude ${input.longitude} is outside -360–360.`);
  }
}

/**
 * Resolve a wall-clock birth time in an IANA zone to the UTC instant, reporting
 * DST gaps and folds instead of hiding them.
 *
 * Returns the UTC `Date` plus zero or more warnings:
 * - **Gap** (a local time that never occurred, e.g. 02:30 on a US spring-forward
 *   date): there is no instant with that wall clock. The time is moved forward
 *   by the length of the gap — the behaviour of every mainstream library — and a
 *   warning says so and gives the resolved wall clock, so the caller can ask the
 *   user rather than trusting the value.
 * - **Fold** (a local time that occurred twice, e.g. 01:30 on a fall-back date):
 *   the requested occurrence is used (`options.fold`, default the earlier one)
 *   and a warning lists both offsets.
 *
 * Throws a `RangeError` for an unknown IANA zone or out-of-range fields: an
 * unresolvable input must fail loudly rather than produce a plausible chart.
 *
 * Accuracy caveat: historical offsets come from the host's ICU tzdata and are
 * best-effort before 1970; see the module header.
 */
export function resolveBirthInstantDetailed(
  input: BirthInput,
  options: ResolveBirthOptions = {},
): ResolvedInstant {
  const warnings: string[] = [];
  const second = input.second ?? 0;

  if (typeof input.timeZone !== "string" || !IANAZone.isValidZone(input.timeZone)) {
    throw new RangeError(`Unknown IANA time zone "${String(input.timeZone)}".`);
  }
  validate(input, second);

  const zone = input.timeZone;
  const wallClock = formatWallClock(input, second);

  const wall = DateTime.fromObject(
    {
      year: input.year,
      month: input.month,
      day: input.day,
      hour: input.hour,
      minute: input.minute,
      second,
      millisecond: 0,
    },
    { zone },
  );
  if (!wall.isValid) {
    throw new RangeError(
      `Invalid birth date ${wallClock} in ${zone}: ${wall.invalidReason ?? "unknown reason"}.`,
    );
  }

  const naive = naiveUtcMillis(input, second);
  const offsetBefore = DateTime.fromMillis(naive - DAY_MS, { zone }).offset;
  const offsetAfter = DateTime.fromMillis(naive + DAY_MS, { zone }).offset;

  const candidates: number[] = [];
  const push = (millis: number): void => {
    if (!candidates.includes(millis)) candidates.push(millis);
  };
  push(naive - offsetBefore * 60_000);
  if (offsetAfter !== offsetBefore) push(naive - offsetAfter * 60_000);

  const reproduces = (millis: number): boolean => {
    const probe = DateTime.fromMillis(millis, { zone });
    return (
      probe.year === input.year &&
      probe.month === input.month &&
      probe.day === input.day &&
      probe.hour === input.hour &&
      probe.minute === input.minute &&
      probe.second === second
    );
  };

  const valid = candidates
    .filter(reproduces)
    .sort((a, b) => a - b);

  if (valid.length >= 2) {
    const chosen = options.fold === "later" ? valid[valid.length - 1] : valid[0];
    const chosenDateTime = DateTime.fromMillis(chosen, { zone });
    const offsets = valid
      .map((millis) => formatOffset(DateTime.fromMillis(millis, { zone }).offset))
      .join(" and ");
    warnings.push(
      `Local time ${wallClock} is ambiguous in ${zone}: the clocks fell back and this ` +
        `time occurs twice (${offsets}). Used the ` +
        `${options.fold === "later" ? "later" : "earlier"} occurrence ` +
        `(${formatOffset(chosenDateTime.offset)}, ${chosenDateTime.toISO()}). ` +
        `Confirm which one the birth record means.`,
    );
    return { date: new Date(chosen), warnings };
  }

  if (valid.length === 1) {
    return { date: new Date(valid[0]), warnings };
  }

  // Neither candidate reproduces the wall clock: the time falls in a gap.
  const resolved = wall;
  warnings.push(
    `Local time ${wallClock} does not exist in ${zone}: the clocks sprang forward across ` +
      `this time. Moved forward to ${resolved.toISO()} (${formatOffset(resolved.offset)}). ` +
      `The recorded birth time is probably off by an hour; confirm it.`,
  );
  return { date: resolved.toJSDate(), warnings };
}

/**
 * Resolve a wall-clock birth time in an IANA zone to the UTC instant.
 *
 * Convenience wrapper over `resolveBirthInstantDetailed` for callers that do not
 * surface warnings. Use the detailed form whenever the user can be asked about
 * a DST gap or fold — this one silently takes the default resolution.
 *
 * Throws a `RangeError` for an unknown zone or out-of-range fields.
 */
export function resolveBirthInstant(input: BirthInput): Date {
  return resolveBirthInstantDetailed(input).date;
}
