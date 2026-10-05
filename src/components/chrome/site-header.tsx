"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Palette, Sun, Volume2, VolumeX } from "lucide-react";
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useSound } from "@/components/providers/sound-provider";
import { THEME_LABEL, useTheme } from "@/components/providers/theme-provider";
import { cue } from "@/lib/audio/sound-engine";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Threshold" },
  { href: "/method", label: "The Method" },
  { href: "/membership", label: "Membership" },
  { href: "/collective", label: "The Collective" },
] as const;

const ICON_BUTTON =
  "inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-muted transition-colors duration-200 hover:border-hairline hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void";

const NAV_LINK =
  "relative rounded-sm px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface SiteHeaderProps {
  /**
   * Render Clerk's auth controls. Leave `false` (the default) when Clerk has
   * no publishable key — the Clerk components would throw on render, so the
   * header falls back to plain `/sign-in` and `/sign-up` links instead.
   */
  clerkEnabled?: boolean;
  className?: string;
}

/**
 * The sticky, translucent site header: wordmark, primary nav, theme and sound
 * controls, auth-aware actions, and a mobile sheet.
 */
export function SiteHeader({
  clerkEnabled = false,
  className,
}: SiteHeaderProps) {
  const pathname = usePathname() ?? "/";
  const { theme, cycle } = useTheme();
  const { enabled, toggle } = useSound();
  // The menu remembers which route it was opened on, so a navigation closes it
  // without an effect.
  const [menu, setMenu] = useState<{ open: boolean; at: string }>({
    open: false,
    at: pathname,
  });
  const menuOpen = menu.open && menu.at === pathname;
  const setMenuOpen = (open: boolean) => setMenu({ open, at: pathname });

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Palette;

  return (
    <header
      className={cn(
        "surface sticky top-0 z-40 rounded-none border-x-0 border-t-0 backdrop-blur-xl",
        className,
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="The Cipher — home"
          onMouseEnter={() => cue("hover")}
          className="font-display text-sm tracking-[0.24em] text-gradient-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void"
        >
          THE CIPHER
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onMouseEnter={() => cue("hover")}
                className={cn(
                  NAV_LINK,
                  active ? "text-gold" : "text-muted hover:text-bone",
                )}
              >
                {item.label}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 -bottom-px h-px bg-gold"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              cycle();
              cue("tick");
            }}
            className={ICON_BUTTON}
            aria-label={`Change theme. Current theme: ${THEME_LABEL[theme]}`}
            title={`Theme: ${THEME_LABEL[theme]}`}
          >
            <ThemeIcon aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggle}
            aria-pressed={enabled}
            className={ICON_BUTTON}
            aria-label={
              enabled ? "Turn interface sound off" : "Turn interface sound on"
            }
            title={enabled ? "Sound on" : "Sound off"}
          >
            {enabled ? (
              <Volume2 aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />
            ) : (
              <VolumeX aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />
            )}
          </button>

          <div className="hidden items-center gap-2 md:flex">
            {clerkEnabled ? (
              <ClerkAuthControls />
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild variant="primary" size="sm">
                  <Link href="/sign-up">Join</Link>
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className={cn(ICON_BUTTON, "md:hidden")}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
          >
            <Menu aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Sheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        side="right"
        title="Menu"
        description="Navigate The Cipher."
      >
        <nav aria-label="Mobile" className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "rounded-md px-3 py-3 font-mono text-xs uppercase tracking-[0.18em] transition-colors duration-200",
                  active
                    ? "bg-raised text-gold"
                    : "text-muted hover:bg-raised hover:text-bone",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 flex flex-col gap-2 border-t border-hairline pt-6">
          {clerkEnabled ? (
            <ClerkAuthControls stacked />
          ) : (
            <>
              <Button asChild variant="secondary" size="md" className="w-full">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild variant="primary" size="md" className="w-full">
                <Link href="/sign-up">Join</Link>
              </Button>
            </>
          )}
        </div>
      </Sheet>
    </header>
  );
}

interface ClerkAuthControlsProps {
  /** Stack the controls for the mobile sheet instead of the desktop row. */
  stacked?: boolean;
}

/**
 * Isolated so `useUser()` only ever runs inside a mounted `<ClerkProvider>`,
 * which is exactly when the header is told `clerkEnabled`.
 */
function ClerkAuthControls({ stacked = false }: ClerkAuthControlsProps) {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return (
      <span
        aria-hidden="true"
        className="h-8 w-24 animate-pulse rounded-md bg-raised"
      />
    );
  }

  if (!isSignedIn) {
    return (
      <>
        <SignInButton mode="modal">
          <Button
            variant={stacked ? "secondary" : "ghost"}
            size="sm"
            className={stacked ? "w-full" : undefined}
          >
            Sign in
          </Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button
            variant="primary"
            size="sm"
            className={stacked ? "w-full" : undefined}
          >
            Join
          </Button>
        </SignUpButton>
      </>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", stacked && "justify-between")}>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        {user?.firstName ?? user?.username ?? "Member"}
      </span>
      <UserButton
        appearance={{ elements: { avatarBox: "h-8 w-8" } }}
      />
    </div>
  );
}
