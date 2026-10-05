import { SiteFooter } from "@/components/chrome/site-footer";
import { SiteHeader } from "@/components/chrome/site-header";

/**
 * Marketing shell.
 *
 * Everything inside the `(marketing)` route group gets the public header and
 * footer. The immersive surfaces — the threshold, the intake, a shared reading,
 * the member dashboard and the admin console — deliberately live outside this
 * group so they can own the full viewport.
 */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  const clerkEnabled = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader clerkEnabled={clerkEnabled} />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
