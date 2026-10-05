import type { Metadata, Viewport } from "next";
import { Cinzel, Montserrat, JetBrains_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const description =
  "Enter your coordinates. Cross the threshold. The Cipher computes your natal chart and Human Design bodygraph, then turns the result into a signal you can actually run.";

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
    "natal chart",
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
      className={`${cinzel.variable} ${montserrat.variable} ${jetbrains.variable} h-full`}
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
