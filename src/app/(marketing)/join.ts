/**
 * Where "join" goes. With Clerk unconfigured there is no hosted sign-up
 * route, so joining starts at sign-in and the membership application stays
 * the real door.
 */
export function joinHref(): string {
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "/sign-up" : "/sign-in";
}
