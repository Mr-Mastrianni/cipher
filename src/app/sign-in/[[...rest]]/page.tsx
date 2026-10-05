import type { Metadata } from "next";
import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import { Cosmogram } from "@/components/cipher/cosmogram";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to The Cipher and return to your chart, cohort and calls.",
};

/**
 * Clerk is considered configured when the publishable key is present — the same
 * condition `AppProviders` uses before it mounts `<ClerkProvider>`. Keeping the
 * two in step is what stops `<SignIn/>` from rendering outside a provider.
 */
const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/** The branded left panel, shared in spirit with `/sign-up`. */
function AuthAside() {
  return (
    <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-hairline px-12 py-14 lg:flex">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hairline-grid opacity-[0.35]"
      />
      <div className="relative">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-muted transition-colors hover:text-gold"
        >
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
          The Cipher
        </Link>
      </div>

      <div className="relative max-w-md">
        <div className="h-40 w-40">
          <Cosmogram className="h-full w-full" progress={0.55} />
        </div>
        <h1 className="mt-8 font-display text-3xl leading-tight text-bone">
          The chart is the door. The collective is the room.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted text-pretty">
          Your bodygraph, your cohort, and the people working the same edge you
          are. Sign in to pick up exactly where you stopped.
        </p>
      </div>

      <p className="relative font-mono text-[10px] uppercase tracking-[0.24em] text-faint">
        Enter your coordinates
      </p>
    </aside>
  );
}

/**
 * The sign-in route. Rendered as a server component so the unconfigured state
 * is a first-class branch rather than a render-time crash: with no secrets the
 * page explains itself and sends the visitor home.
 */
export default function SignInPage() {
  return (
    <main
      id="main"
      className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <AuthAside />

      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
            Sign in
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Welcome back. Your reading is where you left it.
          </p>

          <div className="mt-8">
            {clerkConfigured ? (
              <SignIn
                routing="path"
                path="/sign-in"
                forceRedirectUrl="/dashboard"
                fallbackRedirectUrl="/dashboard"
                signUpForceRedirectUrl="/onboarding"
                signUpFallbackRedirectUrl="/onboarding"
              />
            ) : (
              <div
                role="status"
                className="surface px-6 py-8 text-sm leading-relaxed text-muted"
              >
                <p className="font-display text-base text-bone">
                  Authentication is not configured
                </p>
                <p className="mt-3">
                  This deployment has no Clerk keys, so sign-in is switched off.
                  The reading engine, the design system and the admin console all
                  remain explorable in this state.
                </p>
                <Link
                  href="/"
                  className="mt-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-gold transition-colors hover:text-gold-hi"
                >
                  <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Back to the threshold
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
