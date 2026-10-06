import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppProviders } from "@/components/providers/app-providers";
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
 * Applied before first paint so the correct theme is on <html> with no flash.
 * Kept tiny and dependency-free on purpose.
 */
const themeBootstrap = `(function(){try{var t=localStorage.getItem('cipher:theme');if(!t){t='dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${cinzel.variable} ${montserrat.variable} ${jetbrainsMono.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
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
