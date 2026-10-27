/** Small, timezone-honest helpers for the teaching desk. */

export function formatSessionTime(value: number | null | undefined): string {
  if (!value || !Number.isFinite(value)) return "time to be set";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/** `YYYY-MM-DDTHH:mm` in the member's own timezone, for datetime-local. */
export function toDateTimeLocal(value: number): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function fromDateTimeLocal(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** The next quarter hour, an hour from now. */
export function suggestedStart(): number {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15);
  return date.getTime();
}


/** A short relative stamp for recent activity lists. */
export function formatAgo(value: string | number | null | undefined): string {
  if (!value) return "";
  const at = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(at)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.round(seconds / 86400)}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(at));
}
