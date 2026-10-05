import type { MetadataRoute } from "next";

/**
 * The public sitemap.
 *
 * Only routes that are meant to be found are listed. Readings are deliberately
 * absent: `/reading/[code]` is private-by-obscurity, decodes to somebody's birth
 * data, and is marked `noindex` by its own metadata and disallowed in
 * `robots.ts`. Listing them here would be the one way to publish them.
 */

const BASE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://cipher.vercel.app"
).replace(/\/+$/, "");

interface PublicRoute {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}

const ROUTES: readonly PublicRoute[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/enter", changeFrequency: "monthly", priority: 0.9 },
  { path: "/membership", changeFrequency: "monthly", priority: 0.9 },
  { path: "/method", changeFrequency: "monthly", priority: 0.8 },
  { path: "/collective", changeFrequency: "weekly", priority: 0.8 },
  { path: "/membership/apply", changeFrequency: "monthly", priority: 0.6 },
];

/**
 * Build `sitemap.xml` for the public, indexable surface of the site.
 *
 * @returns One entry per public route, all stamped with the build time.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
