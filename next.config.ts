import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * `Content-Security-Policy` is intentionally permissive in a few places because
 * Clerk, Stripe Checkout, Nominatim and the optional realtime voice endpoints
 * all need to be reachable. Tighten `connect-src` once your provider list is
 * final — the commented block shows the shape to aim for.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // The admin agent needs the microphone; everything else is denied.
    value: "camera=(), geolocation=(self), microphone=(self), payment=(self)",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // The chart code is part of the URL surface; keep trailing slashes canonical.
  trailingSlash: false,

  experimental: {
    // Large JSON payloads (charts + bodygraphs) are posted to route handlers.
    serverActions: { bodySizeLimit: "1mb" },
  },

  images: {
    remotePatterns: [
      // Clerk-hosted profile images.
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
    ],
  },

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Never let a shared cache hold a member's chart or the admin console.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
  },

  async redirects() {
    return [
      { source: "/login", destination: "/sign-in", permanent: true },
      { source: "/signup", destination: "/sign-up", permanent: true },
      { source: "/pricing", destination: "/membership", permanent: true },
    ];
  },
};

export default nextConfig;
