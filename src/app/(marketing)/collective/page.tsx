import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Actions, Facts, Further, Lede, More, PanelHeading, pillClass, quietClass, type Fact } from "@/components/cipher/panel";
import { Reveal } from "@/components/motion/reveal";

import { joinHref } from "../join";

export const metadata: Metadata = {
  title: "The Starseed Collective",
  description:
    "A global community space for starseeds, KP students and Human Design experimenters: themed rooms, cosmic matching, live events and reading circles.",
  openGraph: {
    type: "website",
    siteName: "The Cipher",
    title: "The Starseed Collective — how the space is organised",
    description:
      "Themed rooms, cosmic matching, live events and reading circles. What is public, what is open to members, and how to apply.",
  },
};

const ROOMS = [
  {
    title: "Rooms and direct messages",
    public:
      "Rooms with a purpose, not a general feed: Starseed Origins, the Dasha Circle, Lines & Places, Design Experiments, the Sanctuary — and nothing is sold from the stage.",
    members:
      "Members get every room, the KP horary Prashna Room and Signal Studio from Initiate, and direct messages that stay private. Ask a question and get an answer from someone running the same period or circuitry.",
    badge: "Partly public",
  },
  {
    title: "The weekly call",
    public:
      "One hour, once a week, recorded and archived. We read charts live, take questions in the order they were asked, and work through whatever the room is stuck on.",
    members:
      "Members join live, can put a chart in the queue, and get every recording. The call moves through the same shape each week so you always know where you are in it.",
    badge: "Members",
  },
  {
    title: "Cosmic matching",
    public:
      "Opt in and meet members through what you share: chosen interests, Human Design mechanics (the channels you complete together) and KP signatures like a shared Moon nakshatra or running the same mahadasha.",
    members:
      "Every match shows its reasons, and nobody is shown without consent. Birth dates, times and places are never revealed — only derived signatures.",
    badge: "Members",
  },
  {
    title: "Reading circles",
    public:
      "Small groups that meet monthly to read each other properly — the fastest way to learn a system is to use it on somebody else.",
    members:
      "Circles are grouped by type and by lane, so a Hermit reads with Hermits and a Fixer with Fixers. Each circle keeps its own thread and its own notes.",
    badge: "Members",
  },
] as const;

const COHORTS = [
  { name: "The Engines", note: "Generators. The work gets done here." },
  { name: "The Current", note: "Manifesting Generators. Skip the steps and report back." },
  { name: "The Ignition", note: "Manifestors. Nobody needs permission." },
  { name: "The Lens", note: "Projectors. The ones who see the other clearly." },
  { name: "The Mirror", note: "Reflectors. A twenty-eight day clock, and it means it." },
] as const;

const AGREEMENTS = [
  "Read the chart in front of you, not the person in front of you. A bodygraph is evidence about a design, never a verdict on a life.",
  "No selling in the rooms. If your work is relevant, someone will ask — answer in the thread, not the feed.",
  "Say when you do not know. An open centre is not an excuse for a stranger to explain your childhood.",
  "Nothing is recorded, quoted or screenshotted out of a reading circle without the person's agreement.",
  "Leave whenever it stops working. Cancelling takes two clicks and no conversation.",
] as const;

/** The four ways the Collective meets, a line each. */
const FACTS: readonly Fact[] = [
  {
    title: "Rooms with a purpose",
    tag: "partly open",
    body: "Starseed Origins, the Dasha Circle, Lines & Places, the Sanctuary — rooms, not a feed.",
  },
  {
    title: "The weekly call",
    tag: "members",
    body: "One hour, live and recorded. Charts read in the order the questions came.",
  },
  {
    title: "Cosmic matching",
    tag: "members, opt in",
    body: "Meet people through what you share: channels you complete, a Moon nakshatra.",
  },
  {
    title: "Reading circles",
    tag: "members",
    body: "Small groups, monthly. The fastest way to learn a system is to read someone else.",
  },
];

/**
 * The Collective, on Earth — the inhabited world.
 *
 * Everything a visitor can see without an account is said plainly here, and
 * what membership opens is named rather than teased. The detail of each room,
 * the agreements and the cohort rooms are one fold away.
 */
export default function CollectivePage() {
  return (
    <main id="main">
      <Reveal stagger={0.08} className="mt-6 flex flex-col">
        <PanelHeading as="h1" caption="Earth · the Collective">
          A room of people reading the same sky.
        </PanelHeading>
        <Lede>
          A reading tells you what your chart is. People running the same periods and the same experiments tell you
          what it does.
        </Lede>
        <Facts items={FACTS} />
        <Actions>
          <Link href={joinHref()} className={pillClass}>
            Join the community
            <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
          </Link>
          <Link href="/membership/apply" className={quietClass}>
            Become a member
          </Link>
        </Actions>
      </Reveal>

      <Further>
        <More summary="How each room works">
          <dl className="flex flex-col gap-5">
            {ROOMS.map((room) => (
              <div key={room.title}>
                <dt className="font-display text-lg text-bone">
                  {room.title} <span className="text-[15px] italic text-gold">{room.badge.toLowerCase()}</span>
                </dt>
                <dd className="mt-1">{room.public}</dd>
                <dd className="mt-2 text-code">{room.members}</dd>
              </div>
            ))}
          </dl>
        </More>
        <More summary="The five agreements">
          <ol className="flex list-decimal flex-col gap-3 pl-5 marker:font-display marker:text-gold">
            {AGREEMENTS.map((agreement) => (
              <li key={agreement}>{agreement}</li>
            ))}
          </ol>
        </More>
        <More summary="The cohort rooms">
          <p>
            Every member is placed in a cohort by type, an archetype by circuitry, and a lane by their Aura Avatar. The
            rooms open when your application is accepted — read by a person, usually within two days.
          </p>
          <dl className="mt-4 flex flex-col gap-3">
            {COHORTS.map((cohort) => (
              <div key={cohort.name}>
                <dt className="font-display text-lg text-bone">{cohort.name}</dt>
                <dd>{cohort.note}</dd>
              </div>
            ))}
            <div>
              <dt className="font-display text-lg text-bone">The archetypes</dt>
              <dd>The Mutant, The Builder, The Archivist, The Bridge.</dd>
            </div>
          </dl>
        </More>
      </Further>
    </main>
  );
}
