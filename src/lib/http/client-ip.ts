/**
 * Best-effort client IP for rate limiting.
 *
 * The leftmost `X-Forwarded-For` entry is whatever the client sent, so keying a
 * limit on it lets anyone dodge the limit by sending a fresh value per request.
 * `X-Real-IP` is set by the platform edge (Vercel and most reverse proxies
 * overwrite it), and the *rightmost* forwarded entry is the one appended by
 * the proxy closest to us, so those are the two values worth trusting.
 */
export function clientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const last = forwarded.split(",").at(-1)?.trim();
    if (last) return last;
  }
  return "unknown";
}
