import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CircleDot, Ruler, Sigma } from "lucide-react";
import { PageHeader, PageShell, Section } from "@/components/chrome";
import { SiteHeader } from "@/components/chrome/site-header";
import { SiteFooter } from "@/components/chrome/site-footer";
import { Button } from "@/components/ui";

export const metadata: Metadata = {
  title: "The Method",
  description:
    "How The Cipher computes a chart: the ephemeris, the 88° solar arc, the true node, the wheel offset, and the accuracy limits we will not hide.",
  openGraph: {
    type: "article",
    siteName: "The Cipher",
    title: "The Method — how The Cipher computes a chart",
    description:
      "The ephemeris, the 88° solar arc, the true node, the wheel offset, and the accuracy limits — stated plainly.",
  },
};

const PIPELINE = [
  {
    icon: Sigma,
    title: "The ephemeris",
    body: "Positions are computed, not looked up. The engine evaluates the Sun, Moon, planets, the true lunar node and the obliquity of the ecliptic for the exact instant, using an astronomy-engine ephemeris validated against JPL data and checked against published equinox instants and solar eclipse maxima. Nothing here is reduced to a sun sign, and no value is interpolated from a printed table.",
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
    body: "The Ascendant moves about 15 arcminutes per minute of clock error, and the Moon about 33 arcseconds per minute. Gate, line and colour survive a birth time accurate to the minute; tone and base do not, because they are only 93.75″ and 18.75″ wide. We surface every activation sitting within a small tolerance of a slice boundary rather than implying a precision the recorded time cannot support.",
  },
  {
    title: "Chiron is omitted, never approximated",
    body: "The ephemeris does not supply Chiron, so it is left out and a warning says so. Inventing a plausible position would be worse than an honest gap.",
  },
  {
    title: "Houses have real edge cases",
    body: "The cusps are computed here from the mean obliquity of the ecliptic, omitting the ~9″ nutation-in-obliquity term. Placidus is undefined inside the polar circles, so it falls back — and the fallback is named on the reading, with both the requested and the used system.",
  },
  {
    title: "Historical timezones are best-effort",
    body: "Wall-clock times resolve through the host's IANA timezone database. Before 1970 that record is good but not perfect: wartime DST, double summer time and local mean time are encoded for many places, not all. A local time that never existed (a spring-forward gap) or that occurred twice (a fall-back fold) is detected and reported, never silently chosen.",
  },
  {
    title: "Conventions are declared, not hidden",
    body: "The element and modality balance counts the ten planets plus the Ascendant and Midheaven, once each, unweighted. The literature disagrees on both the body set and the weights, so we report raw counts and say which convention produced them.",
  },
  {
    title: "We do not rectify charts",
    body: "If you do not know your birth time, we compute for noon local time and label the Moon, the Ascendant, the houses and the profile as unreliable. We will not move your birth time until the chart looks better.",
  },
] as const;

const DIFFERENT = [
  "The Design chart is solved as 88° of solar arc on the Sun's longitude, not as a fixed 88-day subtraction.",
  "The true node is used, and its effect on gate boundaries is treated as a first-class accuracy question.",
  "The Western chart and the bodygraph are computed from the same resolved instant with the same ephemeris, so the two views can never disagree about when you were born.",
  "Type is resolved by a breadth-first search over the defined-channel graph — motor to Throat — rather than by matching against a hardcoded list of channel combinations. A Sacral→G→Throat path is correctly read as a Manifesting Generator.",
  "Every uncertainty is rendered: boundary signals, timezone folds and gaps, omitted bodies, and house-system fallbacks all reach the reader as notices.",
  "The reading is shareable without an account and permanent without a database. Birth data is packed into a checksummed URL, so a mistyped link fails loudly instead of quietly computing the wrong chart.",
  "There is no quiz and no rectification. The mechanical layer is separable from the interpretation, and we keep them visibly separate.",
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
            description="Most calculators describe a system. This page describes the arithmetic underneath it — the ephemeris, the arc, the node, the offset — and then states, without hedging, where the arithmetic is uncertain."
            actions={
              <Button asChild variant="primary">
                <Link href="/enter">
                  Compute a chart
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </Link>
              </Button>
            }
          />

          <Section
            eyebrow="The pipeline"
            title="Four decisions determine everything downstream."
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
