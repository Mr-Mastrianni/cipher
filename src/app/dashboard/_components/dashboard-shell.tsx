"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";import {
  Bell,
  BookOpen,
  Check,
  Copy,
  CreditCard,
  Layers,
  LayoutDashboard,
  Menu,
  MessageCircle,
  MessagesSquare,
  Printer,
  Settings,
  Sparkles,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { THEME_LABEL, THEMES, useTheme, type Theme } from "@/components/providers/theme-provider";
import { useSound } from "@/components/providers/sound-provider";
import { useBrowserValue } from "@/lib/hooks/use-browser-value";
import { cn } from "@/lib/utils";
import type { AuraAvatar } from "@/lib/cipher/aura-avatar";
import { AuraAvatarChip } from "@/components/cipher/aura-avatar-card";

/**
 * Dashboard client chrome.
 *
 * A page cannot be both a Server Component (needed to read the session) and a
 * Client Component (needed for `usePathname`, drawers and the theme/sound
 * hooks), so the interactive chrome lives here and every server page passes it
 * serialisable data. Nothing in this file imports the store or the session.
 */

/** The serialisable slice of the member the chrome needs. */
export interface ChromeUser {
  id: string;
  name: string;
  imageUrl: string | null;
  tier: string;
  role: string;
  avatar: AuraAvatar | null;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

/** The persistent navigation, in reading order. */
const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/chart", label: "My Chart", icon: Sparkles },
  { href: "/dashboard/community", label: "Community", icon: MessagesSquare },
  { href: "/dashboard/messages", label: "Messages", icon: MessageCircle },
  { href: "/dashboard/calls", label: "Calls", icon: Layers },
  { href: "/dashboard/courses", label: "Courses", icon: BookOpen },
  { href: "/dashboard/flashcards", label: "Flashcards", icon: Layers },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

/** Whether `href` is the current route (or a parent of it). */
function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface NotificationWire {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

const NAV_LINK =
  "group flex items-center gap-3 rounded-md px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void";

/**
 * The dashboard frame: sidebar, mobile drawer, notification bell and demo
 * banner.
 *
 * @param props.user - The member's chrome summary.
 * @param props.clerkEnabled - Whether Clerk is configured in this deployment.
 * @param props.demoMode - Whether the store is the seeded in-memory fallback.
 * @param props.initialUnread - Unread notification count rendered on the server.
 * @param props.children - The page content.
 */
export function DashboardShell({
  user,
  clerkEnabled,
  demoMode,
  initialUnread,
  children,
}: {
  user: ChromeUser;
  clerkEnabled: boolean;
  demoMode: boolean;
  initialUnread: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/dashboard";
  const { play } = useSound();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [notifications, setNotifications] = useState<NotificationWire[] | null>(null);
  const [marking, setMarking] = useState(false);
  const reduced = useReducedMotion();

  // Navigating closes the drawer without an effect, by comparing the route the
  // drawer was opened on with the current one.
  const [drawerAt, setDrawerAt] = useState(pathname);
  const drawerVisible = drawerOpen && drawerAt === pathname;

  const openDrawer = (open: boolean) => {
    setDrawerOpen(open);
    setDrawerAt(pathname);
    if (open) play("select");
  };

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as {
        ok: boolean;
        notifications?: NotificationWire[];
        unreadCount?: number;
      };
      if (!data.ok) return;
      setNotifications(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch {
      setNotifications([]);
    }
  }, []);

  const openBell = (open: boolean) => {
    setBellOpen(open);
    if (open) {
      play("message");
      void loadNotifications();
    }
  };

  const markAllRead = async () => {
    setMarking(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (response.ok) {
        const data = (await response.json()) as { unreadCount?: number };
        setUnread(data.unreadCount ?? 0);
        setNotifications((current) =>
          (current ?? []).map((row) => ({
            ...row,
            readAt: row.readAt ?? new Date().toISOString(),
          })),
        );
        play("confirm");
      }
    } catch {
      play("error");
    } finally {
      setMarking(false);
    }
  };

  const nav = (
    <nav aria-label="Dashboard" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={() => openDrawer(false)}
            onMouseEnter={() => play("hover")}
            className={cn(
              NAV_LINK,
              active
                ? "bg-raised text-gold"
                : "text-muted hover:bg-raised hover:text-bone",
            )}
          >
            <Icon aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const identity = (
    <div className="flex items-center gap-3">
      {user.avatar ? <AuraAvatarChip avatar={user.avatar} /> : null}
      {clerkEnabled ? (
        <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
      ) : (
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          {user.name}
        </span>
      )}
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-void text-bone">
      {demoMode ? (
        <p
          role="status"
          className="border-b border-warn/30 bg-warn/10 px-4 py-2 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-warn"
        >
          Demo mode — no database is configured. Data lives in this process only
          and resets on restart.
        </p>
      ) : null}

      <header className="surface sticky top-0 z-40 rounded-none border-x-0 border-t-0 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openDrawer(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold lg:hidden"
              aria-label="Open dashboard navigation"
              aria-expanded={drawerVisible}
              aria-haspopup="dialog"
            >
              <Menu aria-hidden="true" strokeWidth={1.5} className="h-5 w-5" />
            </button>
            <Link
              href="/dashboard"
              className="font-display text-sm tracking-[0.24em] text-gradient-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              THE CIPHER
            </Link>
            <Badge tone="gold" size="sm" className="ml-1 hidden sm:inline-flex">
              {user.tier}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openBell(true)}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              aria-label={
                unread > 0
                  ? `Notifications, ${unread} unread`
                  : "Notifications, none unread"
              }
            >
              <Bell aria-hidden="true" strokeWidth={1.5} className="h-5 w-5" />
              {unread > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 font-mono text-[9px] text-on-accent"
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </button>
            {identity}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24 flex flex-col gap-6">
            <div className="surface rounded-lg p-3">{nav}</div>
            {user.avatar ? (
              <div className="surface rounded-lg p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-faint">
                  Aura Avatar
                </p>
                <p className="mt-2 font-display text-lg leading-tight text-bone">
                  {user.avatar.seat}
                </p>
                <p className="font-display text-lg leading-tight text-gold">
                  {user.avatar.format}
                </p>
                <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
                  {user.avatar.coordinate}
                </p>
              </div>
            ) : null}
          </div>
        </aside>

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      <Sheet
        open={drawerVisible}
        onOpenChange={openDrawer}
        side="left"
        title="Navigation"
        description="Every room in the dashboard."
      >
        {nav}
        <div className="mt-6 border-t border-hairline pt-6">{identity}</div>
      </Sheet>

      <Sheet
        open={bellOpen}
        onOpenChange={setBellOpen}
        side="right"
        title="Notifications"
        description="Membership, calls, courses and messages."
        footer={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void markAllRead()}
            loading={marking}
            disabled={notifications === null || notifications.length === 0}
          >
            <Check aria-hidden="true" className="h-4 w-4" />
            Mark all read
          </Button>
        }
      >
        {notifications === null ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner size="sm" label="Loading notifications" /> Loading…
          </div>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing yet. Approval updates, call reminders and replies land here.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notifications.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.url ?? "/dashboard"}
                  onClick={() => openBell(false)}
                  className={cn(
                    "block rounded-md border border-hairline p-3 transition-colors hover:border-gold/40",
                    row.readAt === null ? "bg-raised" : "bg-transparent",
                  )}
                >
                  <p className="font-display text-sm text-bone">{row.title}</p>
                  {row.body ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted">{row.body}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      <motion.span
        aria-hidden="true"
        className="pointer-events-none fixed bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-gold/40 to-transparent"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Live countdown
 * ------------------------------------------------------------------------- */

/**
 * Format a millisecond duration as `2d 04h 11m 09s`.
 *
 * @param ms - Remaining milliseconds; values below zero read as "starting now".
 * @returns A compact countdown string.
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "starting now";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return days > 0
    ? `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
    : `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

/**
 * A live countdown to an instant.
 *
 * Ticks once a second after mount. The server-rendered value is suppressed from
 * hydration comparisons because a second boundary can pass between the two
 * renders.
 *
 * @param props.to - ISO-8601 instant to count down to.
 * @param props.label - Screen-reader context, e.g. "Weekly Chart Circle".
 */
export function Countdown({ to, label }: { to: string; label: string }) {
  const target = useMemo(() => new Date(to).getTime(), [to]);
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const tick = () => setRemaining(target - Date.now());
    // Resync at once (the target may have changed), then once a second.
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [target]);

  return (
    <p className="font-mono text-xs uppercase tracking-[0.18em] text-gold">
      <span className="sr-only">{label} starts in </span>
      <time dateTime={to} suppressHydrationWarning>
        {formatCountdown(remaining)}
      </time>
    </p>
  );
}

/* ---------------------------------------------------------------------------
 * RSVP
 * ------------------------------------------------------------------------- */

/**
 * A members-only RSVP toggle.
 *
 * Optimistically flips the label, then reconciles with the server's count. A
 * failure rolls the optimistic state back and plays the error cue.
 *
 * @param props.callId - The live call uuid.
 * @param props.initialStatus - The member's current RSVP, or `null`.
 * @param props.initialGoingCount - The server-rendered `going` count.
 */
export function RsvpButton({
  callId,
  initialStatus,
  initialGoingCount,
}: {
  callId: string;
  initialStatus: string | null;
  initialGoingCount: number;
}) {
  const { play } = useSound();
  const [status, setStatus] = useState(initialStatus);
  const [going, setGoing] = useState(initialGoingCount);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const optimistic = status === "going" ? "declined" : "going";
    const delta = optimistic === "going" ? 1 : -1;
    setStatus(optimistic);
    setGoing((count) => Math.max(0, count + delta));
    play("select");
    try {
      const response = await fetch(`/api/calls/${callId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: optimistic }),
      });
      if (!response.ok) throw new Error("rsvp failed");
      const data = (await response.json()) as { status?: string; goingCount?: number };
      setStatus(data.status ?? optimistic);
      setGoing(data.goingCount ?? going);
      play(data.status === "going" ? "join" : "confirm");
    } catch {
      setStatus(status);
      setGoing((count) => Math.max(0, count - delta));
      play("error");
    } finally {
      setBusy(false);
    }
  };

  const active = status === "going";
  return (
    <div className="flex items-center gap-3">
      <Button
        variant={active ? "primary" : "secondary"}
        size="sm"
        onClick={() => void toggle()}
        loading={busy}
        aria-pressed={active}
      >
        {active ? "Going" : "RSVP"}
      </Button>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
        {going} going
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Reading actions (print + share)
 * ------------------------------------------------------------------------- */

/**
 * Print and copy-link actions for the chart page.
 *
 * @param props.shareUrl - The absolute reading URL to copy.
 */
export function ReadingActions({ shareUrl }: { shareUrl: string }) {
  const { play } = useSound();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setFailed(false);
      play("confirm");
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setFailed(true);
      play("error");
    }
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => window.print()}>
        <Printer aria-hidden="true" className="h-4 w-4" />
        Export / print
      </Button>
      <Button variant="outline" size="sm" onClick={() => void copy()}>
        <Copy aria-hidden="true" className="h-4 w-4" />
        {copied ? "Link copied" : "Share reading"}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Reading link copied to clipboard." : ""}
        {failed ? "Could not access the clipboard." : ""}
      </span>
      {failed ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-danger">
          Copy failed — select the URL manually: {shareUrl}
        </span>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Settings preferences
 * ------------------------------------------------------------------------- */

const PREFS_KEY = "cipher:notification-prefs";

/** The stored preference JSON, or "" when there is none or storage is unavailable. */
function readStoredPrefs(): string {
  try {
    return window.localStorage.getItem(PREFS_KEY) ?? "";
  } catch {
    return "";
  }
}

function parseStoredPrefs(raw: string | null): Partial<NotificationPrefs> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<NotificationPrefs>;
  } catch {
    return {};
  }
}

interface NotificationPrefs {
  calls: boolean;
  community: boolean;
  courses: boolean;
  billing: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  calls: true,
  community: true,
  courses: true,
  billing: true,
};

/**
 * Theme, sound, billing and in-app notification preferences.
 *
 * Notification delivery has no server-side channel yet, so the toggles are
 * stored locally and labelled as such rather than pretending to persist.
 *
 * @param props.tier - The member's current tier key.
 * @param props.membershipStatus - The member's membership status.
 */
export function MemberPreferences({
  tier,
  membershipStatus,
}: {
  tier: string;
  membershipStatus: string;
}) {
  const { theme, setTheme } = useTheme();
  const { enabled, setEnabled, play } = useSound();
  // `null` during SSR and hydration; the stored JSON (or "") on the client.
  const storedPrefs = useBrowserValue(readStoredPrefs, null);
  const loaded = storedPrefs !== null;
  const [edits, setEdits] = useState<Partial<NotificationPrefs>>({});
  const prefs = useMemo(
    () => ({ ...DEFAULT_PREFS, ...parseStoredPrefs(storedPrefs), ...edits }),
    [storedPrefs, edits],
  );
  const [portal, setPortal] = useState<"idle" | "loading" | "missing" | "error">("idle");


  const updatePref = (key: keyof NotificationPrefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setEdits((current) => ({ ...current, [key]: value }));
    play("tick");
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      /* session-only */
    }
  };

  const openPortal = async () => {
    setPortal("loading");
    play("select");
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      if (response.status === 404) {
        setPortal("missing");
        play("error");
        return;
      }
      if (!response.ok) {
        setPortal("error");
        play("error");
        return;
      }
      const data = (await response.json()) as { url?: string };
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      setPortal("error");
      play("error");
    } catch {
      setPortal("error");
      play("error");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="appearance-heading" className="surface rounded-lg p-5">
        <h3 id="appearance-heading" className="font-display text-lg text-bone">
          Appearance
        </h3>
        <p className="mt-1 text-sm text-muted">
          The palette is stored on this device and applied before first paint.
        </p>
        <div role="radiogroup" aria-labelledby="appearance-heading" className="mt-4 flex flex-wrap gap-2">
          {THEMES.map((option) => {
            const active = theme === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setTheme(option as Theme);
                  play("select");
                }}
                className={cn(
                  "rounded-md border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                  active
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-line text-muted hover:border-gold/50 hover:text-bone",
                )}
              >
                {THEME_LABEL[option as Theme]}
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="sound-heading" className="surface rounded-lg p-5">
        <h3 id="sound-heading" className="font-display text-lg text-bone">
          Interface sound
        </h3>
        <p className="mt-1 text-sm text-muted">
          Cues are synthesised locally and never autoplay — the first cue waits
          for a gesture from you.
        </p>
        <div className="mt-4">
          <Switch
            checked={enabled}
            onCheckedChange={(value) => {
              setEnabled(value);
              if (value) play("success");
            }}
            label={enabled ? "Sound on" : "Sound off"}
            description="Reveals, confirmations and message cues."
          />
        </div>
      </section>

      <section aria-labelledby="notify-heading" className="surface rounded-lg p-5">
        <h3 id="notify-heading" className="font-display text-lg text-bone">
          Notification preferences
        </h3>
        <p className="mt-1 text-sm text-muted">
          In-app only for now, and stored on this device.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          {(
            [
              ["calls", "Live call reminders"],
              ["community", "Community replies"],
              ["courses", "New lessons"],
              ["billing", "Billing and renewal"],
            ] as const
          ).map(([key, label]) => (
            <Switch
              key={key}
              checked={loaded ? prefs[key] : true}
              onCheckedChange={(value) => updatePref(key, value)}
              label={label}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="tier-heading" className="surface rounded-lg p-5">
        <h3 id="tier-heading" className="font-display text-lg text-bone">
          Membership
        </h3>
        <p className="mt-1 text-sm text-muted">
          Current tier <span className="text-gold">{tier}</span> · status{" "}
          <span className="text-bone">{membershipStatus}</span>.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void openPortal()}
            loading={portal === "loading"}
          >
            <CreditCard aria-hidden="true" className="h-4 w-4" />
            Manage billing
          </Button>
          <span aria-live="polite" className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {portal === "missing"
              ? "Billing portal is not configured in this deployment."
              : portal === "error"
                ? "Could not reach the billing portal."
                : ""}
          </span>
        </div>
      </section>
    </div>
  );
}
