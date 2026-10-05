import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import { PageHeader, PageShell, Section } from "@/components/chrome";
import { SiteHeader } from "@/components/chrome/site-header";
import { SiteFooter } from "@/components/chrome/site-footer";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Membership",
  description:
    "Four tiers, the first free forever. Threshold, Initiate, Adept and Oracle — what each unlocks, how applications are reviewed, and what is charged when.",
  openGraph: {
    type: "website",
    siteName: "The Cipher",
    title: "Membership — four tiers, the first one free",
    description:
      "Threshold, Initiate, Adept and Oracle. Applications are reviewed by a person and nothing is charged until you are accepted.",
  },
};

/**
 * TIER DISCREPANCY, RECORDED HERE ON PURPOSE
 * ------------------------------------------
 * `TIER_SEED` in `@/lib/db/schema` is the billing source of truth and currently
 * reads: free tier named "Seeker" ($0), Initiate $15, **Adept $39**,
 * **Oracle $79**. The launched pricing — and the prices already published on the
 * landing page — are Threshold ($0), Initiate $15, Adept $29 and Oracle $59.
 * The two do not match, so the page renders the launched prices locally rather
 * than importing a billing seed that would contradict the rest of the site.
 * When the seed is reconciled, this table is the single place to update the
 * marketing surface.
 */
const TIERS = [
  {
    key: "threshold",
    name: "Threshold",
    price: "Free",
    cadence: "",
    tagline: "The door, open.",
    description:
      "The whole chart and the whole bodygraph, computed and kept. No account required to see it, and no time limit on it.",
    features: [
      "Your full natal chart and bodygraph",
      "Your Aura Avatar",
      "The nine centres, read in full",
      "One foundation course",
      "The public collective feed",
    ],
    cta: "Start free",
    href: "/enter",
    featured: false,
  },
  {
    key: "initiate",
    name: "Initiate",
    price: "$15",
    cadence: "/month",
    tagline: "The work, in practice.",
    description:
      "The base membership: the rooms, the course library, the weekly call, and unlimited flashcards.",
    features: [
      "Everything in Threshold",
      "Cohort rooms, archetype and lane channels",
      "Direct messages",
      "The weekly live call",
      "Every course track",
      "Full flashcard decks with spaced repetition",
    ],
    cta: "Apply for membership",
    href: "/membership/apply",
    featured: true,
  },
  {
    key: "adept",
    name: "Adept",
    price: "$29",
    cadence: "/month",
    tagline: "For the ones who teach it.",
    description:
      "For practitioners who read other people's charts as well as their own: comparison, timing, and the extended library.",
    features: [
      "Everything in Initiate",
      "Call recordings and archives",
      "The extended readings library",
      "Chart comparison and synastry",
      "Transit and progression tracking",
      "Priority in the live call queue",
    ],
    cta: "Apply for membership",
    href: "/membership/apply",
    featured: false,
  },
  {
    key: "oracle",
    name: "Oracle",
    price: "$59",
    cadence: "/month",
    tagline: "The room where it is built.",
    description:
      "The top tier, kept deliberately small: a monthly circle, a direct line, and the tools before they are public.",
    features: [
      "Everything in Adept",
      "Monthly small-group reading circle",
      "Direct line to the studio",
      "Early access to new engines and tools",
      "Your readings archive, exportable",
    ],
    cta: "Apply for membership",
    href: "/membership/apply",
    featured: false,
  },
] as const;

type Cell = boolean | string;

interface ComparisonRow {
  label: string;
  threshold: Cell;
  initiate: Cell;
  adept: Cell;
  oracle: Cell;
}

const COMPARISON: readonly ComparisonRow[] = [
  { label: "Full natal chart and bodygraph", threshold: true, initiate: true, adept: true, oracle: true },
  { label: "Aura Avatar", threshold: true, initiate: true, adept: true, oracle: true },
  { label: "Nine-centre reading", threshold: true, initiate: true, adept: true, oracle: true },
  { label: "Foundation course", threshold: true, initiate: true, adept: true, oracle: true },
  { label: "Public collective feed", threshold: true, initiate: true, adept: true, oracle: true },
  { label: "Flashcards", threshold: "Limited", initiate: "Unlimited", adept: "Unlimited", oracle: "Unlimited" },
  { label: "Cohort, archetype and lane channels", threshold: false, initiate: true, adept: true, oracle: true },
  { label: "Direct messages", threshold: false, initiate: true, adept: true, oracle: true },
  { label: "Weekly live call", threshold: false, initiate: "Live", adept: "Live + priority", oracle: "Live + priority" },
  { label: "Call recordings and archives", threshold: false, initiate: false, adept: true, oracle: true },
  { label: "Every course track", threshold: false, initiate: true, adept: true, oracle: true },
  { label: "Extended readings library", threshold: false, initiate: false, adept: true, oracle: true },
  { label: "Chart comparison and synastry", threshold: false, initiate: false, adept: true, oracle: true },
  { label: "Transit and progression tracking", threshold: false, initiate: false, adept: true, oracle: true },
  { label: "Monthly reading circle", threshold: false, initiate: false, adept: false, oracle: true },
  { label: "Direct line to the studio", threshold: false, initiate: false, adept: false, oracle: true },
  { label: "Early access to new engines", threshold: false, initiate: false, adept: false, oracle: true },
  { label: "Exportable readings archive", threshold: false, initiate: false, adept: false, oracle: true },
];

const FAQ = [
  {
    q: "Why is membership an application?",
    a: "Because the collective is small on purpose. Every application is read by a person, usually within two days. You will hear back either way, and a denial is never permanent — you can apply again after a season.",
  },
  {
    q: "When am I charged?",
    a: "Not until you are accepted. The application itself is free and takes a couple of minutes. If you are accepted you choose a tier and subscribe then, and you can change tiers or cancel from your own dashboard at any time.",
  },
  {
    q: "Is the free tier a trial?",
    a: "No. Threshold does not expire and does not require a card. Your chart, your bodygraph, your Aura Avatar and the nine-centre reading stay available for as long as the site does.",
  },
  {
    q: "Can I cancel?",
    a: "Any time, from your own dashboard, in two clicks. No email required, no retention call. Your reading is not deleted when a subscription ends — it returns to the free tier.",
  },
  {
    q: "What happens on the weekly call?",
    a: "One hour, once a week, recorded and archived. We read charts live, take questions in the order they were asked, and work through whatever the room is stuck on. Nothing is sold from the stage.",
  },
  {
    q: "Do I need to know my birth time?",
    a: "It helps enormously, and the intake is honest about what changes if you do not. The Sun and the outer planets barely move in a day; the Moon and the Ascendant move a great deal. Without a time we compute at noon and label the parts that are placeholders.",
  },
] as const;

function ComparisonCell({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center">
        <Check
          aria-hidden="true"
          strokeWidth={2}
          className="h-4 w-4 text-ok"
        />
        <span className="sr-only">Included</span>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center justify-center">
        <Minus aria-hidden="true" strokeWidth={1.5} className="h-4 w-4 text-faint" />
        <span className="sr-only">Not included</span>
      </span>
    );
  }
  return <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-code">{value}</span>;
}

/**
 * The public pricing page.
 *
 * The page is a statically rendered server component: it reads only the public
 * Clerk key to decide where the join call to action points, so it renders
 * correctly with no environment variables at all.
 */
export default function MembershipPage() {
  // With Clerk unconfigured there is no hosted sign-up route, so the join CTA
  // degrades to the sign-in path and the application form stays the real door.
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const joinHref = clerkConfigured ? "/sign-up" : "/sign-in";

  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <PageShell width="wide">
          <PageHeader
            eyebrow="Membership"
            title="Four tiers. The first one is free forever."
            description="Membership is reviewed by a person, usually within two days. You choose a tier when you apply, and nothing is charged until you are accepted."
            actions={
              <>
                <Button asChild variant="primary">
                  <Link href="/membership/apply">
                    Apply for membership
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={joinHref}>
                    {clerkConfigured ? "Create an account" : "Sign in"}
                  </Link>
                </Button>
              </>
            }
          />

          <Section
            eyebrow="The tiers"
            title="What opens at each step."
            description="Nothing essential is held back. The free tier is a complete reading — the paid tiers are the room, the practice and the tools."
          >
            <div className="grid gap-5 lg:grid-cols-4">
              {TIERS.map((tier) => (
                <article
                  key={tier.key}
                  className={cn(
                    "flex h-full flex-col rounded-xl border bg-ink/60 p-6 transition-all duration-300",
                    tier.featured
                      ? "border-gold/50 shadow-glow"
                      : "border-hairline hover:border-line",
                  )}
                >
                  {tier.featured ? (
                    <Badge tone="gold" size="sm" className="mb-4 w-fit">
                      Most chosen
                    </Badge>
                  ) : null}
                  <h3 className="font-display text-lg tracking-wide text-bone">
                    {tier.name}
                  </h3>
                  <p className="mt-1 text-xs text-faint">{tier.tagline}</p>
                  <p className="mt-5 font-display text-3xl text-bone">
                    {tier.price}
                    <span className="text-sm text-faint">{tier.cadence}</span>
                  </p>
                  <p className="mt-4 text-[13px] leading-relaxed text-muted">
                    {tier.description}
                  </p>
                  <ul className="mt-6 flex-1 list-none space-y-2.5 p-0">
                    {tier.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex gap-2.5 text-[13px] leading-relaxed text-muted"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold"
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    variant={tier.featured ? "primary" : "secondary"}
                    className="mt-7 w-full"
                  >
                    <Link href={tier.key === "threshold" ? joinHref : tier.href}>
                      {tier.cta}
                    </Link>
                  </Button>
                </article>
              ))}
            </div>
          </Section>

          <Section
            eyebrow="Comparison"
            title="Everything, side by side."
            description="The same information as the cards above, in a form you can read down a single column."
          >
            <div className="surface overflow-x-auto rounded-lg">
              <table className="w-full min-w-[44rem] border-collapse text-left">
                <caption className="sr-only">
                  Feature comparison across the Threshold, Initiate, Adept and
                  Oracle tiers.
                </caption>
                <thead>
                  <tr className="border-b border-hairline">
                    <th
                      scope="col"
                      className="px-4 py-4 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-faint"
                    >
                      What you get
                    </th>
                    {TIERS.map((tier) => (
                      <th
                        key={tier.key}
                        scope="col"
                        className="px-4 py-4 text-center font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-faint"
                      >
                        <span className="block text-bone">{tier.name}</span>
                        <span className="mt-1 block text-faint">
                          {tier.price}
                          {tier.cadence}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr
                      key={row.label}
                      className="border-b border-hairline/70 last:border-b-0"
                    >
                      <th
                        scope="row"
                        className="px-4 py-3 text-left font-sans text-sm font-normal text-muted"
                      >
                        {row.label}
                      </th>
                      <td className="px-4 py-3 text-center">
                        <ComparisonCell value={row.threshold} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ComparisonCell value={row.initiate} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ComparisonCell value={row.adept} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ComparisonCell value={row.oracle} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            eyebrow="Questions"
            title="The things people ask first."
          >
            <div className="divide-y divide-hairline border-y border-hairline">
              {FAQ.map((item) => (
                <details key={item.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left">
                    <span className="font-display text-base tracking-wide text-bone">
                      {item.q}
                    </span>
                    <span
                      aria-hidden="true"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line text-faint transition-all group-open:rotate-45 group-open:border-gold group-open:text-gold"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </Section>

          <Section
            eyebrow="Apply"
            title="The application is one page and read by a person."
            description="Tell us what you make and why you want in. If the room is right for you, you will hear back within about two days."
          >
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="primary" size="lg">
                <Link href="/membership/apply">
                  Start an application
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/collective">See the collective</Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href={joinHref}>
                  {clerkConfigured ? "Create an account" : "Sign in"}
                </Link>
              </Button>
            </div>
          </Section>
        </PageShell>
      </main>
      <SiteFooter />
    </>
  );
}
