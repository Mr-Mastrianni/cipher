import type { MetadataRoute } from "next";

/**
 * `robots.txt`.
 *
 * The crawler rules and the route `noindex` metadata are two halves of the same
 * decision: the app surfaces (`/admin`, `/dashboard`, `/api`, `/onboarding`)
 * and the personal readings under `/reading` must never appear in an index.
 * `/reading` is disallowed here as a prefix, which also covers a future
 * `/reading/[code]/...` child route.
 */

const BASE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://cipher.vercel.app"
).replace(/\/+$/, "");

/**
 * Build the crawler policy for the site.
 *
 * @returns A single `*` rule allowing the public pages, disallowing the private
 *   surfaces, plus the sitemap location.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/dashboard", "/api", "/onboarding", "/reading"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
