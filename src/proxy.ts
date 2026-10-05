import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * The Cipher — request proxy (Next.js 16's renamed middleware).
 *
 * Proxy runs on the Node.js runtime in Next 16 and is intentionally kept thin.
 * It performs *optimistic* redirects only — it never authorises a resource.
 * Every privileged page, Route Handler and Server Action repeats the real check
 * server-side via `@/lib/auth`, because a URL matcher is a convenience, not an
 * access boundary (Clerk's current guidance, and Next's own security docs).
 *
 * `createRouteMatcher()` is deliberately not used: it is deprecated, and the
 * handful of prefixes below are cheaper and more explicit.
 */

/**
 * Request header carrying the current pathname to server components.
 *
 * A server layout cannot read the URL, and the admin sidebar needs the path to
 * highlight the active item. The proxy is the one place that reliably sees it.
 */
const PATHNAME_HEADER = "x-cipher-pathname";

/** Paths that require a session. Kept as a list so a typo cannot over-match. */
const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/onboarding"] as const;

/** Paths a signed-in visitor should never see. */
const ANONYMOUS_ONLY = ["/sign-in", "/sign-up"] as const;

/** True when the publishable key is present, i.e. Clerk can boot at all. */
const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAnonymousOnly(pathname: string): boolean {
  return ANONYMOUS_ONLY.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Continue the request with the pathname exposed to server components.
 *
 * Only used on `/admin`, where the sidebar needs it; every other path is left
 * untouched so Clerk's own handshake and cookie handling run unmodified.
 */
function continueWithPathname(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

function signInUrl(request: NextRequest): URL {
  const url = new URL("/sign-in", request.url);
  // Send the visitor back where they were headed once they are through.
  url.searchParams.set(
    "redirect_url",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return url;
}

/**
 * The Clerk-aware proxy: refreshes the session, performs optimistic redirects,
 * and hands the admin pathname downstream.
 */
const clerkProxy = clerkConfigured
  ? clerkMiddleware(async (auth, request) => {
      const { userId } = await auth();
      const { pathname } = request.nextUrl;

      if (!userId && isProtected(pathname)) {
        return NextResponse.redirect(signInUrl(request));
      }

      if (userId && isAnonymousOnly(pathname)) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }

      if (pathname === "/admin" || pathname.startsWith("/admin/")) {
        return continueWithPathname(request);
      }

      // Fall through to Clerk's default response.
      return undefined;
    })
  : null;

/**
 * Pass-through used when Clerk is unconfigured.
 *
 * The app must boot, render and build with no secrets at all, so no Clerk code
 * is executed and no redirect is attempted. The pathname header is still set on
 * `/admin` so the shell renders deterministically if anything ever reaches it.
 */
function unconfiguredProxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return continueWithPathname(request);
  }
  return NextResponse.next();
}

export default clerkProxy ?? unconfiguredProxy;

/**
 * Never run on build output, static assets, or the public webhook endpoint —
 * the Clerk webhook route must stay reachable without a session and must not
 * pay for a proxy invocation.
 */
export const config = {
  matcher: [
    "/((?!api/webhooks|_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|woff2?|ttf|otf|txt|xml|webmanifest)$).*)",
  ],
};
