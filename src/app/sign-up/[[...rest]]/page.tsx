import type { Metadata } from "next";
import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { ArrowLeft } from "lucide-react";
import { Cosmogram } from "@/components/cipher/cosmogram";

export const metadata: Metadata = {
  title: "Join",
  description:
    "Create your account, compute your chart, and be placed in a cohort.",
};

/** Mirrors the guard in `/sign-in`: no provider, no Clerk component. */
const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/** The branded left panel, shared in spirit with `/sign-in`. */
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
          <Cosmogram className="h-full w-full" progress={0.8} />
        </div>
        <h1 className="mt-8 font-display text-3xl leading-tight text-bone">
          Twenty-six activations. Two words that are yours.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted text-pretty">
          Create an account and the first thing we do is compute your chart,
          your Aura Avatar, and the cohort you belong in.
        </p>
      </div>

      <p className="relative font-mono text-[10px] uppercase tracking-[0.24em] text-faint">
        Onboarding takes four minutes
      </p>
    </aside>
  );
}

/**
 * The sign-up route. Completing sign-up forces the visitor into `/onboarding`,
 * which is where the chart is computed and the categorisation questions live.
 */
export default function SignUpPage() {
  return (
    <main
      id="main"
      className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <AuthAside />

      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
            Create account
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            One account, one chart, one cohort. You can leave at any time.
          </p>

          <div className="mt-8">
            {clerkConfigured ? (
              <SignUp
                routing="path"
                path="/sign-up"
                forceRedirectUrl="/onboarding"
                fallbackRedirectUrl="/onboarding"
                signInForceRedirectUrl="/dashboard"
                signInFallbackRedirectUrl="/dashboard"
              />
            ) : (
              <div
                role="status"
                className="surface px-6 py-8 text-sm leading-relaxed text-muted"
              >
                <p className="font-display text-base text-bone">
                  Registration is not configured
                </p>
                <p className="mt-3">
                  This deployment has no Clerk keys, so accounts cannot be created
                  here. Follow the setup notes in the repository to enable
                  authentication.
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
