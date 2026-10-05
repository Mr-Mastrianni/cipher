"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "./theme-provider";
import { SoundProvider } from "./sound-provider";
import { ToastProvider } from "@/components/ui/toast";

/**
 * Conditional Clerk wrapper.
 *
 * The app is designed to boot and be fully explorable with no secrets present,
 * which matters for CI builds, local first-run, and the deployed demo. When
 * `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is absent we render the tree without
 * `<ClerkProvider>` and every auth surface degrades to an explanatory notice
 * rather than throwing during render.
 *
 * Provider order matters: theme and sound are independent, and `ToastProvider`
 * sits innermost so toasts can react to the resolved theme.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  const tree = (
    <ThemeProvider>
      <SoundProvider>
        <ToastProvider>{children}</ToastProvider>
      </SoundProvider>
    </ThemeProvider>
  );

  if (!publishableKey) return tree;

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={{
        variables: {
          colorPrimary: "#c8912f",
          colorPrimaryForeground: "#0b0b11",
          colorBackground: "#14141d",
          colorForeground: "#ede6d0",
          colorMutedForeground: "#8a8a9a",
          colorMuted: "#1c1c28",
          colorNeutral: "#ede6d0",
          colorInput: "#1c1c28",
          colorInputForeground: "#ede6d0",
          colorDanger: "#d6402a",
          colorSuccess: "#4e9e7a",
          colorWarning: "#d9b75e",
          borderRadius: "0.625rem",
          fontFamily: "var(--font-montserrat), ui-sans-serif, system-ui",
        },
        elements: {
          card: "shadow-lg border border-[var(--c-hairline)]",
          cardBox: "text-[var(--c-bone)]",
          headerTitle: "font-display tracking-[0.08em] text-[var(--c-bone)]",
          headerSubtitle: "text-[var(--c-muted)]",
          socialButtonsBlockButton:
            "border border-[var(--c-line)] text-[var(--c-bone)] hover:border-[var(--c-gold)]",
          formFieldLabel: "text-[var(--c-muted)]",
          formFieldInput:
            "bg-[var(--c-raised)] text-[var(--c-bone)] border-[var(--c-line)]",
          formButtonPrimary:
            "bg-[var(--c-gold)] text-[var(--c-on-accent)] hover:brightness-110 normal-case font-semibold",
          footerActionLink: "text-[var(--c-gold)] hover:text-[var(--c-gold-hi)]",
          footerActionText: "text-[var(--c-muted)]",
          identityPreviewText: "text-[var(--c-bone)]",
          dividerText: "text-[var(--c-faint)]",
          dividerLine: "bg-[var(--c-hairline)]",
        },
      }}
    >
      {tree}
    </ClerkProvider>
  );
}

/** True when Clerk is configured in this deployment. */
export const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);
