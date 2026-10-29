import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";

import { Actions, Further, Lede, More, PanelHeading, pillClass, quietClass } from "@/components/cipher/panel";
import { Reveal } from "@/components/motion/reveal";

import { joinHref } from "../join";

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
 * Marketing projection of the tiers. Prices must match `TIER_SEED` in
 * `@/lib/db/schema` and `TIERS` in `@/lib/payments/stripe` (Threshold free,
 * Initiate $15, Adept $29, Oracle $59); what Stripe actually charges is set by
 * the `STRIPE_PRICE_*` Price ids, which must be created at these amounts.
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
  { label: "Full KP chart and bodygraph", threshold: true, initiate: true, adept: true, oracle: true },
  { label: "Aura Avatar", threshold: true, initiate: true, adept: true, oracle: true },
  { label: "Nine-centre reading", threshold: true, initiate: true, adept: true, oracle: true },
  { label: "Foundation courses (KP and Human Design)", threshold: true, initiate: true, adept: true, oracle: true },
  { label: "Public collective feed", threshold: true, initiate: true, adept: true, oracle: true },
  { label: "Flashcards", threshold: "Limited", initiate: "Unlimited", adept: "Unlimited", oracle: "Unlimited" },
  { label: "Cohort, archetype and lane channels", threshold: false, initiate: true, adept: true, oracle: true },
  { label: "Direct messages", threshold: false, initiate: true, adept: true, oracle: true },
  { label: "Weekly live call", threshold: false, initiate: "Live", adept: "Live + priority", oracle: "Live + priority" },
  { label: "Call recordings and archives", threshold: false, initiate: false, adept: true, oracle: true },
  { label: "Every course track", threshold: false, initiate: true, adept: true, oracle: true },
  { label: "Extended readings library", threshold: false, initiate: false, adept: true, oracle: true },
  { label: "KP horary (Prashna) with ruling-planet timing", threshold: false, initiate: false, adept: true, oracle: true },
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
    q: "Do I need to know my exact birth time?",
    a: "Yes — to the second. KP judges every house by the sub lord of its cusp, and a cusp moves about fifteen arcseconds per second of clock time, so a sub lord can change within a minute. We ask for hours, minutes and seconds, show you the resolved time zone, UTC offset and daylight saving, and cast nothing until you confirm it. Every cusp is labelled with how many seconds of error it can absorb.",
  },
  {
    q: "Where does the calculation come from?",
    a: "The KP chart uses the full VSOP87 planetary theory and the ELP/MPP02 lunar theory, with the KP (Krishnamurti) ayanamsa and Placidus cusps, tested against the Swiss Ephemeris to within half an arcsecond for the grahas and a tenth of an arcsecond for the cusps. There is no Western or tropical chart and no fallback to one. The Human Design layer solves the Design side as exactly eighty-eight degrees of solar arc, not eighty-eight days.",
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
  return <span className="text-[13px] text-code">{value}</span>;
}

/**
 * Membership, beside Venus — what we value, and belonging.
 *
 * The four tiers read as four lines: a price, a name and what it is for. The
 * full comparison and the questions people ask first are one fold away. The
 * page is a server component that reads only the public Clerk key, so it
 * renders correctly with no environment variables at all.
 */
export default function MembershipPage() {
  return (
    <main id="main">
      <Reveal stagger={0.08} className="mt-6 flex flex-col">
        <PanelHeading as="h1" caption="Venus · membership">
          Come in. There&apos;s a seat for you.
        </PanelHeading>
        <Lede>
          Joining is free, and your chart is yours for good. Applications are read by a person, usually within two
          days, and nothing is charged until you&apos;re welcomed in.
        </Lede>
        <ul className="mt-8 flex flex-col">
          {TIERS.map((tier) => (
            <li key={tier.key} className="flex items-baseline gap-5 border-t border-hairline py-5">
              <span className="w-20 shrink-0 font-display text-4xl leading-none text-gold">
                {tier.price}
                {tier.cadence ? <span className="ml-0.5 text-[15px] italic text-faint">/mo</span> : null}
              </span>
              <span>
                <span className="block font-display text-2xl text-bone">
                  {tier.name}
                  {tier.featured ? <span className="ml-3 text-[15px] italic text-gold">most chosen</span> : null}
                </span>
                <span className="block font-display text-[16px] italic text-muted">{tier.tagline}</span>
                <span className="mt-1 block max-w-[38ch] text-[15px] leading-relaxed text-muted">{tier.description}</span>
              </span>
            </li>
          ))}
        </ul>
        <Actions>
          <Link href="/membership/apply" className={pillClass}>
            Become a member
            <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
          </Link>
          <Link href={joinHref()} className={quietClass}>
            Join free
          </Link>
        </Actions>
      </Reveal>

      <Further title="Compare and ask">
        <More summary="Everything, side by side">
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left">
              <caption className="sr-only">
                Feature comparison across the Threshold, Initiate, Adept and Oracle tiers.
              </caption>
              <thead>
                <tr className="border-b border-hairline">
                  <th scope="col" className="py-3 pr-3 font-display text-[15px] font-medium italic text-muted">
                    What you get
                  </th>
                  {TIERS.map((tier) => (
                    <th
                      key={tier.key}
                      scope="col"
                      className="px-2 py-3 text-center font-display text-[15px] font-medium text-bone"
                    >
                      {tier.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.label} className="border-b border-hairline/70 last:border-b-0">
                    <th scope="row" className="py-2.5 pr-3 text-left font-sans text-sm font-normal text-muted">
                      {row.label}
                    </th>
                    {(["threshold", "initiate", "adept", "oracle"] as const).map((key) => (
                      <td key={key} className="px-2 py-2.5 text-center">
                        <ComparisonCell value={row[key]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </More>
        {FAQ.map((item) => (
          <More key={item.q} summary={item.q}>
            <p className="max-w-[44ch]">{item.a}</p>
          </More>
        ))}
      </Further>
    </main>
  );
}
