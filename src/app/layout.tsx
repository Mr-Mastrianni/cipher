import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { AppProviders } from "@/components/providers/app-providers";
import {
  DEFAULT_THEME,
  isTheme,
  THEME_COOKIE,
} from "@/lib/theme";
import "./globals.css";

/**
 * Self-hosted variable fonts.
 *
 * These were previously loaded with `next/font/google`, which fetches the font
 * files from Google during `next build`. That makes every deploy depend on a
 * third-party network call, and when the fetch hiccups the build dies with the
 * famously unhelpful `TypeError: Cannot read properties of null (reading '1')`
 * inside `@next/font/dist/google/loader.js`. Serving the files from the repo
 * removes the failure mode entirely and cuts two round-trips at runtime.
 *
 * Each file is the variable cut, so one file covers the whole weight axis and
 * only the basic-latin subset is shipped.
 */
const cinzel = localFont({
  src: "./fonts/Cinzel-Variable.woff2",
  variable: "--font-cinzel",
  weight: "400 900",
  display: "swap",
  fallback: ["ui-serif", "Georgia", "serif"],
});

const montserrat = localFont({
  src: "./fonts/Montserrat-Variable.woff2",
  variable: "--font-montserrat",
  weight: "100 900",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const jetbrainsMono = localFont({
  src: "./fonts/JetBrainsMono-Variable.woff2",
  variable: "--font-jetbrains",
  weight: "100 800",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "monospace"],
});

const description =
  "Enter your coordinates. Cross the threshold. The Cipher casts your KP (Krishnamurti Paddhati) chart and Human Design bodygraph, then turns the result into a signal you can actually run.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://cipher.vercel.app",
  ),
  title: {
    default: "The Cipher — enter your coordinates",
    template: "%s · The Cipher",
  },
  description,
  applicationName: "The Cipher",
  manifest: "/site.webmanifest",
  keywords: [
    "Human Design",
    "bodygraph",
    "KP astrology",
    "Krishnamurti Paddhati",
    "sub lord",
    "astrology",
    "incarnation cross",
    "aura avatar",
    "the cipher",
  ],
  openGraph: {
    type: "website",
    title: "The Cipher",
    description,
    siteName: "The Cipher",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Cipher",
    description,
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.svg" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b11" },
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * The theme is rendered here, on the server, from a cookie.
 *
 * This used to be a pre-paint `<script>` in `<head>` reading localStorage. That
 * works, but React refuses to treat a script element rendered from a component
 * as executable ("Scripts inside React components are never executed when
 * rendering on the client"), so every page logged a console error in
 * development. `next/script` does not replace it: with `beforeInteractive` Next
 * queues the body for the client loader (`__next_s.push`), which runs after
 * hydration and would flash the wrong theme first.
 *
 * Reading the cookie instead puts the right `data-theme` in the HTML itself —
 * no script, no warning, and nothing to flash. The provider writes the cookie
 * whenever a member changes the theme.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const storedTheme = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(storedTheme) ? storedTheme : DEFAULT_THEME;

  return (
    <html
      lang="en"
      data-theme={theme}
      suppressHydrationWarning
      className={`${cinzel.variable} ${montserrat.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-void text-bone font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-gold focus:px-4 focus:py-2 focus:text-on-accent"
        >
          Skip to content
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
