import { SiteFooter } from "@/components/chrome/site-footer";
import { SiteHeader } from "@/components/chrome/site-header";
import { SpaceShell } from "@/components/cipher/space-shell";

import { joinHref } from "./join";
import { todaysSky } from "./sky";

/**
 * Marketing shell.
 *
 * Everything inside the `(marketing)` route group floats in the same space:
 * one sky, cast for today, that the pages travel through. The immersive
 * surfaces — the threshold, the intake, a shared reading, the member
 * dashboard and the admin console — deliberately live outside this group so
 * they can own the full viewport.
 */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  return (
    <SpaceShell
      transits={todaysSky()}
      joinHref={joinHref()}
      header={<SiteHeader clerkEnabled={clerkEnabled} />}
      footer={<SiteFooter />}
    >
      {children}
    </SpaceShell>
  );
}
