import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CircleDot, Clock, Orbit, Ruler, Sigma } from "lucide-react";
import { PageHeader, PageShell, Section } from "@/components/chrome";
import { SiteHeader } from "@/components/chrome/site-header";
import { SiteFooter } from "@/components/chrome/site-footer";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "The Method",
  description:
    "How The Cipher casts a KP chart — KP ayanamsa, Placidus cusps, sub lords, birth time to the second — and a Human Design bodygraph, with the accuracy limits we will not hide.",
  openGraph: {
    type: "article",
    siteName: "The Cipher",
    title: "The Method — how The Cipher computes a chart",
    description:
      "KP only, sidereal, verified against the Swiss Ephemeris — and the Human Design arithmetic beside it, stated plainly.",
  },
};

const KP_PIPELINE = [
  {
    icon: Orbit,
    title: "KP only, sidereal",
    body: "The astrology on this platform is Krishnamurti Paddhati and nothing else. Positions are sidereal, measured with the KP (Krishnamurti) ayanamsa — 22°21′50″ at 1900, carried forward by precession, about 23°45′ in 2000. There is no Western or tropical chart, and no code path that falls back to one.",
  },
  {
    icon: Ruler,
    title: "Placidus cusps and sub lords",
    body: "KP houses are Placidus, computed from apparent sidereal time and the true obliquity. Each of the 27 nakshatras is divided into nine subs in Vimshottari proportion, and each sub again into sub-subs — the 249-row KP table, generated here from first principles. Where Placidus does not exist (inside the polar circles) the chart is refused, not substituted.",
  },
  {
    icon: Sigma,
    title: "A precision ephemeris",
    body: "The grahas come from the full VSOP87 planetary theory and the Moon from ELP/MPP02, with light-time and aberration applied and ΔT from the IERS record. Across sixteen reference charts from 1900 to 2049 they agree with the Swiss Ephemeris to within 0.5″ for the grahas and 0.04″ for the cusps — two hundred times finer than the narrowest sub-sub.",
  },
  {
    icon: Clock,
    title: "Birth time to the second, verified",
    body: "A KP cusp moves about fifteen arcseconds per second of clock time. So every chart asks for hours, minutes and seconds, then shows the resolved time zone, UTC offset, daylight saving and UTC instant for you to confirm. A local time that happened twice must be chosen explicitly; one that never existed is refused. Rahu and Ketu default to the mean node, the KP convention, with the true node as a labelled option.",
  },
] as const;

const PIPELINE = [
  {
    icon: Sigma,
    title: "Human Design is its own system",
    body: "The bodygraph is not astrology and is never shown as a chart. It is defined on the tropical ecliptic longitudes of the Sun, Moon, nodes and planets at two instants, so it is computed from those positions directly, for the same verified birth instant the KP chart uses.",
  },
  {
    icon: CircleDot,
    title: "The 88° solar arc",
    body: "The Human Design Design chart is cast for the moment the Sun stood exactly 88° of solar arc before the birth instant — not 88 days earlier. Earth's orbit is elliptical, so 88° of arc takes between roughly 86 and 92 days depending on the season. We root-find that instant on the Sun's longitude. Subtracting a fixed 88 days is the single most common way a bodygraph comes out quietly wrong.",
  },
  {
    icon: Ruler,
    title: "The true node",
    body: "Human Design uses the true (osculating) lunar node, not the mean node. The two differ by up to about 1.5°, and a gate is only 5.625° wide, so the choice can move an activation across a gate boundary and change a channel. We use the true node and derive the South Node as its geometric opposition rather than observing it separately.",
  },
  {
    icon: BadgeCheck,
    title: "The wheel offset",
    body: "Gate 41 line 1 begins at ecliptic longitude 302.000° — exactly 2°00′ of Aquarius in the tropical zodiac. Each gate spans 5.625°, each line 0.9375°, each colour 0.15625°, each tone about 0.02604°, and each base about 0.00521°. The gate order is the standard Rave Mandala, beginning 41, 19, 13, 49, 30, 55, 37, 63, … The zodiac is tropical; a sidereal conversion would be wrong by more than four gates.",
  },
] as const;

const LIMITS = [
  {
    title: "The clock is the dominant error",
    body: "A cusp moves about 15″ of arc per second of clock time, the Moon about 0.5″. Every KP cusp and graha is labelled with how many seconds of birth-time error it can absorb before its sub lord changes, and anything under a minute is flagged. In Human Design, tone and base are only 93.75″ and 18.75″ wide, and activations near a boundary are listed.",
  },
  {
    title: "The ephemeris is verified, not assumed",
    body: "KP positions are tested against the Swiss Ephemeris on every build: grahas within 1″, cusps within 0.1″, mean and true node within 0.5″. Beyond 2026, ΔT (Earth's rotation) is a forecast, so charts for future moments carry a few arcseconds of Moon uncertainty.",
  },
  {
    title: "Placidus has real edge cases",
    body: "Inside the polar circles part of the ecliptic never rises or sets, and Placidus cusps do not exist. KP has no substitute house system, so such charts are refused with an explanation instead of being computed with another system.",
  },
  {
    title: "Historical timezones are best-effort",
    body: "Wall-clock times resolve through the IANA timezone database. Before 1970 that record is good but not perfect: wartime DST, double summer time and local mean time are encoded for many places, not all. That is why you confirm the resolved UTC offset before anything is cast.",
  },
  {
    title: "Conventions are declared, not hidden",
    body: "The KP ayanamsa (Krishnamurti, as defined by the Swiss Ephemeris), the node type (mean by default), the dasha year (365.25 days) and the house system (Placidus) are printed on every chart.",
  },
  {
    title: "We do not rectify charts",
    body: "There is no 'time unknown' option and no noon placeholder. If the birth record gives only minutes, enter 00 seconds and read the flagged cusps with care. We will not move your birth time until the chart looks better.",
  },
] as const;

const DIFFERENT = [
  "KP is the only astrology on the platform: sidereal, KP ayanamsa, Placidus, nine grahas, sign/star/sub/sub-sub lords, four-level significators, ruling planets and Vimshottari dashas — with no Western fallback.",
  "The birth moment is verified before it is used: time to the second, the resolved zone, offset and daylight saving shown back to you, and repeated local times chosen explicitly.",
  "The KP engine is tested against the Swiss Ephemeris and the 249-row sub table is generated, not transcribed, so a typo in a printed table cannot reach your chart.",
  "The Human Design Design chart is solved as 88° of solar arc on the Sun's longitude, not as a fixed 88-day subtraction, from the same verified instant as the KP chart.",
  "Type is resolved by a breadth-first search over the defined-channel graph — motor to Throat — rather than by matching a hardcoded list of channel combinations.",
  "The reading is shareable without an account and permanent without a database. Birth data — including your daylight-saving choice and node type — is packed into a checksummed URL.",
] as const;

const VERIFIED = [
  {
    who: "Ra Uru Hu",
    when: "Montreal, 9 April 1948, 00:05 EST",
    expected:
      "Manifestor · 5/1 · Splenic · Single · Left Angle Cross of the Clarion 51/57 | 61/62",
  },
  {
    who: "Barack Obama",
    when: "Honolulu, 4 August 1961, 19:24 HST",
    expected:
      "Projector · 6/2 · Emotional · Single · Left Angle Cross of Refinement 33/19 | 2/1",
  },
  {
    who: "Oprah Winfrey",
    when: "Kosciusko, Mississippi, 29 January 1954, 04:30 CST",
    expected:
      "Generator · 2/4 · Emotional · Triple Split · Right Angle Cross of the Four Ways 24/44 | 19/33",
  },
  {
    who: "Albert Einstein",
    when: "Ulm, 14 March 1879, 11:30 local mean time",
    expected:
      "Generator · 1/4 · Emotional · Split · Right Angle Cross of Eden 36/6 | 11/12",
  },
] as const;

/**
 * The public method page.
 *
 * It exists to be checkable: every claim about the engine is stated in terms a
 * reader can verify against the reading they were just given, and the accuracy
 * limits are given the same weight as the mechanics.
 */
export default function MethodPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <PageShell width="lg">
          <PageHeader
            eyebrow="The Method"
            title="How the calculation actually works."
            description="Most sites describe a system. This page describes the arithmetic underneath it — the ayanamsa, the cusps, the sub lords, the ephemeris — and then states, without hedging, where the arithmetic is uncertain."
            actions={
              <Button asChild variant="primary">
                <Link href="/enter">
                  Cast a KP chart
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </Link>
              </Button>
            }
          />

          <Section
            eyebrow="Krishnamurti Paddhati"
            title="KP, computed to the arcsecond."
            description="The astrology here is KP and only KP. These four decisions determine every sub lord in your chart."
          >
            <div className="grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-2">
              {KP_PIPELINE.map((item) => (
                <article key={item.title} className="flex flex-col gap-4 bg-void p-7">
                  <item.icon aria-hidden="true" strokeWidth={1.5} className="h-5 w-5 text-gold" />
                  <h3 className="font-display text-lg tracking-wide text-bone">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{item.body}</p>
                </article>
              ))}
            </div>
          </Section>

          <Section
            eyebrow="Human Design"
            title="Four decisions determine the bodygraph."
            description="Change any one of them and the bodygraph moves. These are the four that calculators most often get wrong."
          >
            <div className="grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-2">
              {PIPELINE.map((item) => (
                <article key={item.title} className="flex flex-col gap-4 bg-void p-7">
                  <item.icon
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className="h-5 w-5 text-gold"
                  />
                  <h3 className="font-display text-lg tracking-wide text-bone">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted">{item.body}</p>
                </article>
              ))}
            </div>
          </Section>

          <Section
            eyebrow="Accuracy"
            title="What we will not pretend to know."
            description="A reading is only useful if its uncertainty is legible. These are the limits the engine carries into every chart it produces."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              {LIMITS.map((limit) => (
                <div key={limit.title} className="surface flex flex-col gap-3 p-6">
                  <h3 className="font-display text-base tracking-wide text-bone">
                    {limit.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted">{limit.body}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section
            eyebrow="What we do differently"
            title="The differences are technical, and they are the point."
            description="None of this is proprietary. It is simply what the system requires, done carefully and then stated openly."
          >
            <ul className="surface list-none divide-y divide-hairline p-0">
              {DIFFERENT.map((item, index) => (
                <li key={item} className="flex gap-4 p-5 sm:p-6">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 font-mono text-xs tabular-nums text-gold"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="text-sm leading-relaxed text-muted">{item}</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            eyebrow="Verification"
            title="The engine reproduces published bodygraphs."
            description="The mechanical layer is checked against bodygraphs that were published before this engine existed. These are the reference charts, with the birth data, so the check can be repeated."
          >
            <div className="surface overflow-x-auto rounded-lg">
              <table className="w-full min-w-[38rem] border-collapse text-left">
                <caption className="sr-only">
                  Reference charts and the published structure the engine
                  reproduces for each.
                </caption>
                <thead>
                  <tr className="border-b border-hairline">
                    <th
                      scope="col"
                      className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-faint"
                    >
                      Chart
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-faint"
                    >
                      Birth data
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-faint"
                    >
                      Reproduced structure
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {VERIFIED.map((row) => (
                    <tr
                      key={row.who}
                      className="border-b border-hairline/70 last:border-b-0"
                    >
                      <th
                        scope="row"
                        className="whitespace-nowrap px-4 py-4 text-left font-sans text-sm font-normal text-bone"
                      >
                        {row.who}
                      </th>
                      <td className="px-4 py-4 font-mono text-xs leading-relaxed text-code">
                        {row.when}
                      </td>
                      <td className="px-4 py-4 text-sm leading-relaxed text-muted">
                        {row.expected}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted">
              <p>
                Agreement on headline structure is not the same as agreement on
                every tone and base. We verify at the level of type, profile,
                authority, definition, incarnation cross and defined centres —
                the fields that published sources actually print and agree on.
              </p>
              <p>
                Where published sources disagree with each other, or with the
                engine, we say so rather than matching the source. One example
                is worth naming: for one of the reference charts a secondary
                source lists channel 19–49 where the activations resolve to
                30–41. Both channels connect the Solar Plexus to the Root, and
                every headline field is identical; the engine reports the
                activations it computed and this page records the disagreement.
              </p>
              <p>
                Contested birth times are treated the same way. Where the
                recorded time is disputed, a reading built on it is labelled
                time-sensitive — see the boundary notices at the top of any
                reading.
              </p>
            </div>
          </Section>

          <Section
            eyebrow="Next"
            title="The fastest way to check the method is to run it."
            description="Enter your own coordinates and read the accuracy notices first. They will tell you exactly how much the rest of the page can be trusted."
          >
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="primary" size="lg">
                <Link href="/enter">
                  Compute my chart
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/membership">See membership</Link>
              </Button>
            </div>
          </Section>
        </PageShell>
      </main>
      <SiteFooter />
    </>
  );
}
