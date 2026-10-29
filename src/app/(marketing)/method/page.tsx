import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Actions, Facts, Further, Lede, More, PanelHeading, pillClass, quietClass, type Fact } from "@/components/cipher/panel";
import { Reveal } from "@/components/motion/reveal";

import { joinHref } from "../join";

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
    title: "KP only, sidereal",
    body: "The astrology on this platform is Krishnamurti Paddhati and nothing else. Positions are sidereal, measured with the KP (Krishnamurti) ayanamsa — 22°21′50″ at 1900, carried forward by precession, about 23°45′ in 2000. There is no Western or tropical chart, and no code path that falls back to one.",
  },
  {
    title: "Placidus cusps and sub lords",
    body: "KP houses are Placidus, computed from apparent sidereal time and the true obliquity. Each of the 27 nakshatras is divided into nine subs in Vimshottari proportion, and each sub again into sub-subs — the 249-row KP table, generated here from first principles. Where Placidus does not exist (inside the polar circles) the chart is refused, not substituted.",
  },
  {
    title: "A precision ephemeris",
    body: "The grahas come from the full VSOP87 planetary theory and the Moon from ELP/MPP02, with light-time and aberration applied and ΔT from the IERS record. Across sixteen reference charts from 1900 to 2049 they agree with the Swiss Ephemeris to within 0.5″ for the grahas and 0.04″ for the cusps — two hundred times finer than the narrowest sub-sub.",
  },
  {
    title: "Birth time to the second, verified",
    body: "A KP cusp moves about fifteen arcseconds per second of clock time. So every chart asks for hours, minutes and seconds, then shows the resolved time zone, UTC offset, daylight saving and UTC instant for you to confirm. A local time that happened twice must be chosen explicitly; one that never existed is refused. Rahu and Ketu default to the mean node, the KP convention, with the true node as a labelled option.",
  },
] as const;

const PIPELINE = [
  {
    title: "Human Design is its own system",
    body: "The bodygraph is not astrology and is never shown as a chart. It is defined on the tropical ecliptic longitudes of the Sun, Moon, nodes and planets at two instants, so it is computed from those positions directly, for the same verified birth instant the KP chart uses.",
  },
  {
    title: "The 88° solar arc",
    body: "The Human Design Design chart is cast for the moment the Sun stood exactly 88° of solar arc before the birth instant — not 88 days earlier. Earth's orbit is elliptical, so 88° of arc takes between roughly 86 and 92 days depending on the season. We root-find that instant on the Sun's longitude. Subtracting a fixed 88 days is the single most common way a bodygraph comes out quietly wrong.",
  },
  {
    title: "The true node",
    body: "Human Design uses the true (osculating) lunar node, not the mean node. The two differ by up to about 1.5°, and a gate is only 5.625° wide, so the choice can move an activation across a gate boundary and change a channel. We use the true node and derive the South Node as its geometric opposition rather than observing it separately.",
  },
  {
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

/** The method in four numbers, each one checkable. */
const FACTS: readonly Fact[] = [
  {
    figure: "½″",
    title: "Checked against the Swiss Ephemeris",
    body: "Sixteen reference charts, 1900 to 2049: the grahas agree to half an arcsecond.",
  },
  {
    figure: "15″",
    title: "Why we ask for the second",
    body: "A KP cusp moves fifteen arcseconds for every second of clock time.",
  },
  {
    figure: "88°",
    title: "Of solar arc, not 88 days",
    body: "The Human Design Design chart is solved on the Sun's own path.",
  },
  {
    figure: "249",
    title: "Sub lords, generated",
    body: "The KP sub table is built from first principles, so no printed typo reaches you.",
  },
];

/**
 * The method, beside Jupiter — the teacher.
 *
 * It exists to be checkable: the page leads with four claims a reader can test
 * against their own reading, and keeps every piece of the arithmetic, and
 * every limit on it, one fold away.
 */
export default function MethodPage() {
  return (
    <main id="main">
      <Reveal stagger={0.08} className="mt-6 flex flex-col">
        <PanelHeading as="h1" caption="Jupiter · the method">
          How the chart is cast.
        </PanelHeading>
        <Lede>
          KP and only KP, sidereal and verified — with a Human Design bodygraph beside it. Every claim here can be
          checked against the reading you were given.
        </Lede>
        <Facts items={FACTS} />
        <Actions>
          <Link href="/enter" className={pillClass}>
            Cast your chart free
            <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
          </Link>
          <Link href={joinHref()} className={quietClass}>
            Join the community
          </Link>
        </Actions>
      </Reveal>

      <Further title="The full method">
        <More summary="KP, computed to the arcsecond">
          <dl className="flex flex-col gap-4">
            {KP_PIPELINE.map((item) => (
              <div key={item.title}>
                <dt className="font-display text-lg text-bone">{item.title}</dt>
                <dd className="mt-1">{item.body}</dd>
              </div>
            ))}
          </dl>
        </More>
        <More summary="The four decisions behind a bodygraph">
          <dl className="flex flex-col gap-4">
            {PIPELINE.map((item) => (
              <div key={item.title}>
                <dt className="font-display text-lg text-bone">{item.title}</dt>
                <dd className="mt-1">{item.body}</dd>
              </div>
            ))}
          </dl>
        </More>
        <More summary="What we will not pretend to know">
          <dl className="flex flex-col gap-4">
            {LIMITS.map((limit) => (
              <div key={limit.title}>
                <dt className="font-display text-lg text-bone">{limit.title}</dt>
                <dd className="mt-1">{limit.body}</dd>
              </div>
            ))}
          </dl>
        </More>
        <More summary="What we do differently">
          <ul className="flex list-disc flex-col gap-3 pl-5 marker:text-gold">
            {DIFFERENT.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </More>
        <More summary="Published charts the engine reproduces">
          <dl className="flex flex-col gap-4">
            {VERIFIED.map((row) => (
              <div key={row.who}>
                <dt className="font-display text-lg text-bone">{row.who}</dt>
                <dd className="mt-0.5 italic text-faint">{row.when}</dd>
                <dd className="mt-1 text-code">{row.expected}</dd>
              </div>
            ))}
          </dl>
        </More>
      </Further>
    </main>
  );
}
