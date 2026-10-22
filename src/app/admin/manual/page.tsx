import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminManualContent } from "@/components/admin/manual-content";
import { getAccessLevel } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Manual",
  description: "How to run The Cipher: applications, members, billing, moderation and the agent.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The admin manual.
 *
 * The access check is repeated here rather than inherited from the layout,
 * following the rule the rest of the console states: a layout is not an access
 * boundary, because Next does not re-run it on a client transition.
 */
export default async function AdminManualPage() {
  const { level } = await getAccessLevel();

  if (level === "anonymous") redirect("/sign-in?redirect_url=/admin/manual");
  if (level !== "admin") redirect("/dashboard");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
          Manual
        </p>
        <h1 className="mt-3 font-display text-3xl leading-tight text-bone">
          Running The Cipher
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted text-pretty">
          The console, the application workflow, billing, moderation, the agent
          and the audit trail — written for the person who runs the site, not the
          person who wrote it.
        </p>
      </header>

      <AdminManualContent />
    </div>
  );
}
