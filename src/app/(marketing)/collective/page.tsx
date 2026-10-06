import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Lock,
  MessagesSquare,
  Radio,
  Sparkles,
  Users,
} from "lucide-react";
import { PageHeader, PageShell, Section } from "@/components/chrome";
import { Badge, Button } from "@/components/ui";

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
    icon: MessagesSquare,
    title: "Rooms and direct messages",
    public:
      "Rooms with a purpose, not a general feed: Starseed Origins, the Dasha Circle, Lines & Places, Design Experiments, the Sanctuary — and nothing is sold from the stage.",
    members:
      "Members get every room, the KP horary Prashna Room and Signal Studio from Initiate, and direct messages that stay private. Ask a question and get an answer from someone running the same period or circuitry.",
    badge: "Partly public",
  },
  {
    icon: CalendarClock,
    title: "The weekly call",
    public:
      "One hour, once a week, recorded and archived. We read charts live, take questions in the order they were asked, and work through whatever the room is stuck on.",
    members:
      "Members join live, can put a chart in the queue, and get every recording. The call moves through the same shape each week so you always know where you are in it.",
    badge: "Members",
  },
  {
    icon: Sparkles,
    title: "Cosmic matching",
    public:
      "Opt in and meet members through what you share: chosen interests, Human Design mechanics (the channels you complete together) and KP signatures like a shared Moon nakshatra or running the same mahadasha.",
    members:
      "Every match shows its reasons, and nobody is shown without consent. Birth dates, times and places are never revealed — only derived signatures.",
    badge: "Members",
  },
  {
    icon: Users,
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

/**
 * The public collective page.
 *
 * Everything a visitor can see without an account is public here; everything
 * behind membership is rendered as an explicit locked state rather than a
 * teaser that reveals nothing. The lock names what opens and links straight to
 * the application.
 */
export default function CollectivePage() {
  return (
    <>
      <main id="main" className="flex-1">
        <PageShell width="lg">
          <PageHeader
            eyebrow="The Starseed Collective"
            title="A global space for the ones who came from somewhere else."
            description="A reading tells you what your chart is. A room of people running the same periods and the same experiments tells you what it does. This is how the space is organised, how members find each other, and where the door is."
            actions={
              <>
                <Button asChild variant="primary">
                  <Link href="/membership/apply">
                    Apply for membership
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/membership">Compare tiers</Link>
                </Button>
              </>
            }
          />

          <Section
            eyebrow="The rooms"
            title="Four ways the Collective meets."
            description="Public where it can be, private where it has to be. Nothing here is a leaderboard."
          >
            <div className="grid gap-5 md:grid-cols-2">
              {ROOMS.map((room) => (
                <article
                  key={room.title}
                  className="surface flex flex-col gap-4 p-6"
                >
                  <div className="flex items-center justify-between gap-3">
                    <room.icon
                      aria-hidden="true"
                      strokeWidth={1.5}
                      className="h-5 w-5 text-teal"
                    />
                    <Badge tone={room.badge === "Members" ? "gold" : "neutral"} size="sm">
                      {room.badge}
                    </Badge>
                  </div>
                  <h3 className="font-display text-lg tracking-wide text-bone">
                    {room.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted">{room.public}</p>
                  <p className="border-t border-hairline pt-4 text-sm leading-relaxed text-code">
                    {room.members}
                  </p>
                </article>
              ))}
            </div>
          </Section>

          <Section
            eyebrow="Inside"
            title="Members-only: the cohort rooms."
            description="Every member is placed into a cohort by type, an archetype by circuitry, and a lane by their Aura Avatar. The rooms are named after those placements."
          >
            <div className="relative overflow-hidden rounded-xl border border-hairline">
              <div
                aria-hidden="true"
                className="pointer-events-none grid select-none gap-px bg-hairline opacity-40 blur-[2px] sm:grid-cols-2 lg:grid-cols-3"
              >
                {COHORTS.map((cohort) => (
                  <div key={cohort.name} className="bg-void p-6">
                    <p className="font-display text-lg tracking-wide text-bone">
                      {cohort.name}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {cohort.note}
                    </p>
                  </div>
                ))}
                <div className="bg-void p-6">
                  <p className="font-display text-lg tracking-wide text-bone">
                    Archetypes
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    The Mutant, The Builder, The Archivist, The Bridge.
                  </p>
                </div>
              </div>

              <div className="absolute inset-0 grid place-items-center bg-void/70 px-6 backdrop-blur-[1px]">
                <div className="flex max-w-sm flex-col items-center gap-4 text-center">
                  <span
                    aria-hidden="true"
                    className="grid h-11 w-11 place-items-center rounded-full border border-gold/40 bg-ink text-gold"
                  >
                    <Lock className="h-4 w-4" strokeWidth={1.5} />
                  </span>
                  <h3 className="font-display text-lg tracking-wide text-bone">
                    Members only
                  </h3>
                  <p className="text-sm leading-relaxed text-muted">
                    Cohort rooms, archetype channels, direct messages, the live
                    call and the reading circles open when your application is
                    accepted. Applications are read by a person, usually within
                    two days.
                  </p>
                  <Button asChild variant="primary" size="sm">
                    <Link href="/membership/apply">
                      Apply to join
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </Section>

          <Section
            eyebrow="The agreement"
            title="What we ask of each other."
            description="Five rules. They are the reason the rooms stay worth reading."
          >
            <ul className="surface list-none divide-y divide-hairline p-0">
              {AGREEMENTS.map((agreement, index) => (
                <li key={agreement} className="flex gap-4 p-5 sm:p-6">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 font-mono text-xs tabular-nums text-gold"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="text-sm leading-relaxed text-muted">
                    {agreement}
                  </p>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            eyebrow="The public part"
            title="You can start without joining anything."
            description="Compute a reading and sit with it first. The chart is free, permanent and needs no account."
          >
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="primary" size="lg">
                <Link href="/enter">
                  <Radio className="h-4 w-4" strokeWidth={1.5} />
                  Compute my chart
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/membership">Compare tiers</Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href="/membership/apply">Apply for membership</Link>
              </Button>
            </div>
          </Section>
        </PageShell>
      </main>
    </>
  );
}
