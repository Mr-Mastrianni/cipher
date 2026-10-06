import { cache, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Compass,
  Info,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { computeReading, type Reading } from "@/lib/cipher/compute-reading";
import { decodeBirthInput, describeBirth } from "@/lib/cipher/share-code";
import { AuraAvatarCard } from "@/components/cipher/aura-avatar-card";
import {
  Bodygraph,
  BodygraphTextSummary,
} from "@/components/cipher/bodygraph";
import { KpChartPanel } from "@/components/cipher/kp-chart";
import { AstroMap } from "@/components/cipher/astro-map";
import { astrocartography } from "@/lib/astrocartography/lines";
import { toKpView } from "@/lib/kp/view";
import { Badge, Button, EmptyState } from "@/components/ui";
import { SiteFooter } from "@/components/chrome/site-footer";
import { SiteHeader } from "@/components/chrome/site-header";
import { CENTER_MAP } from "@/lib/human-design/constants";
import {
  AUTHORITY_CONTENT_BY_AUTHORITY,
  CENTER_CONTENT_BY_KEY,
  PROFILE_CONTENT_BY_KEY,
  TYPE_CONTENT_BY_TYPE,
} from "@/content";
import { ShareReading } from "./share-control";

/**
 * The reveal at `/reading/[code]`.
 *
 * This is a server component on purpose. The birth data is already in the URL
 * (see `share-code.ts`), so the page needs no database and no session: it
 * decodes, computes through the same `computeReading` pipeline the chart API
 * uses, and streams the finished structure. Nothing about the reading depends
 * on a cookie, which is what makes an anonymous shared link work.
 *
 * The page is deliberately `noindex`: a reading is private-by-obscurity. It is
 * reachable by anyone holding the link, so it must never be crawled, and the
 * accuracy notices are always rendered rather than hidden behind a disclosure.
 */

type ReadingLookup =
  | { status: "ok"; reading: Reading }
  | { status: "invalid" }
  | { status: "error"; message: string };

/** Memoised per request so `generateMetadata` and the page compute once. */
const lookupReading = cache((code: string): ReadingLookup => {
  const decoded = decodeBirthInput(code);
  if (!decoded) return { status: "invalid" };
  try {
    return { status: "ok", reading: computeReading(decoded.input) };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The chart could not be computed from this code.",
    };
  }
});

function readingTitle(reading: Reading): string {
  const { bodygraph, avatar } = reading;
  const core = `${bodygraph.type} · ${bodygraph.profile} · ${bodygraph.authority}`;
  return avatar ? `${avatar.label} — ${core}` : core;
}

function readingDescription(reading: Reading): string {
  const { bodygraph, avatar } = reading;
  const seat = avatar ? `${avatar.label}: ` : "";
  return `${seat}a ${bodygraph.type} with a ${bodygraph.profile} profile, ${bodygraph.authority} authority, ${bodygraph.definition.label} definition, and the ${bodygraph.incarnationCross.label}. Computed from the birth moment by The Cipher.`;
}

/**
 * Build the page's title and Open Graph tags from the chart itself.
 *
 * An invalid code still returns metadata rather than throwing, so a bad link
 * renders the not-found state with a sensible title instead of a 500.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const result = lookupReading(code);

  if (result.status !== "ok") {
    return {
      title: "Reading unavailable",
      description:
        "This reading link could not be decoded. Enter your birth data to compute your own chart.",
      robots: { index: false, follow: false },
    };
  }

  const title = readingTitle(result.reading);
  const description = readingDescription(result.reading);

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      type: "article",
      siteName: "The Cipher",
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/* ---------------------------------------------------------------------------
   Small presentational pieces (server-rendered, no client cost)
   ------------------------------------------------------------------------- */

function Notice({
  tone,
  title,
  children,
}: {
  tone: "info" | "warn" | "danger";
  title: string;
  children: ReactNode;
}) {
  const toneClass =
    tone === "danger"
      ? "border-danger/35 bg-danger/5"
      : tone === "warn"
        ? "border-warn/35 bg-warn/5"
        : "border-info/35 bg-info/5";
  const iconClass =
    tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-info";
  const Icon =
    tone === "danger" ? TriangleAlert : tone === "warn" ? Clock : Info;
  return (
    <div className={`rounded-lg border p-5 ${toneClass}`}>
      <p className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] ${iconClass}`}>
        <Icon aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />
        {title}
      </p>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </div>
  );
}

function SummaryItem({
  term,
  children,
}: {
  term: string;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-hairline px-5 py-4 first:border-t-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
        {term}
      </dt>
      <dd className="mt-1.5 text-sm leading-relaxed text-bone">{children}</dd>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Page
   ------------------------------------------------------------------------- */

/**
 * Decode, compute and render a reading, or a proper not-found state.
 *
 * @param props.params - The share code from the URL.
 */
export default async function ReadingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const result = lookupReading(code);

  if (result.status !== "ok") {
    const invalid = result.status === "invalid";
    return (
      <>
        <SiteHeader />
        <main id="main" className="flex-1">
          <div className="mx-auto w-full max-w-2xl px-4 py-24 sm:px-6">
            <EmptyState
              icon={<Compass className="h-5 w-5" strokeWidth={1.5} />}
              title={invalid ? "This link does not decode" : "This reading is unavailable"}
              description={
                invalid
                  ? "The code in the address is incomplete or was changed in transit. Share codes carry a checksum, so a mistyped link fails here rather than quietly computing the wrong chart."
                  : (result.status === "error" ? result.message : undefined)
              }
              action={
                <Button asChild variant="primary">
                  <Link href="/enter">
                    Compute your own
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </Link>
                </Button>
              }
            />
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const reading = result.reading;
  const { bodygraph, avatar, category } = reading;
  const kpView = toKpView(reading.kp);
  const cartoLines = astrocartography(new Date(reading.kp.birth.utc), reading.kp.system.nodeType);

  const typeContent = TYPE_CONTENT_BY_TYPE[bodygraph.type];
  const profileContent = PROFILE_CONTENT_BY_KEY[bodygraph.profile] ?? null;
  const authorityContent = AUTHORITY_CONTENT_BY_AUTHORITY[bodygraph.authority];

  const signals = bodygraph.signals;
  const nearestSignals = signals.slice(0, 6);

  const heroTitle = avatar ? avatar.label : `${bodygraph.type}, ${bodygraph.profile}`;

  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-20 px-4 py-12 sm:px-6 sm:py-16">
          {/* ── Hero ─────────────────────────────────────────────────── */}
          <section aria-labelledby="reading-title" className="flex flex-col gap-8">
            <header className="flex flex-col gap-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-gold">
                Your reading
              </p>
              <h1
                id="reading-title"
                className="font-display text-3xl leading-tight text-bone text-balance sm:text-5xl"
              >
                {heroTitle}
              </h1>
              <p className="max-w-2xl text-pretty leading-relaxed text-muted">
                {reading.summary}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                {describeBirth(reading.input)}
              </p>
              <div className="mt-2">
                <ShareReading
                  path={`/reading/${reading.code}`}
                  title={readingTitle(reading)}
                  text={`${heroTitle} — computed by The Cipher.`}
                />
              </div>
            </header>

            {avatar ? (
              <AuraAvatarCard avatar={avatar} size="lg" />
            ) : (
              <Notice tone="warn" title="No aura avatar">
                <p>
                  The ephemeris did not return a usable Personality Sun, so the
                  two-word avatar could not be drawn. The structural reading
                  below is unaffected.
                </p>
              </Notice>
            )}

            <ul className="flex list-none flex-wrap gap-2 p-0">
              {reading.chips.map((chip) => (
                <li key={chip}>
                  <Badge tone="gold" size="md">
                    {chip}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>

          {/* ── Accuracy notices ─────────────────────────────────────── */}
          <section aria-labelledby="accuracy-title" className="flex flex-col gap-4">
            <h2
              id="accuracy-title"
              className="font-display text-2xl leading-tight text-bone"
            >
              What this reading can and cannot claim
            </h2>

            {signals.length > 0 ? (
              <Notice
                tone="warn"
                title={`Sensitive to birth-time accuracy (${signals.length} activation${signals.length === 1 ? "" : "s"})`}
              >
                <p>
                  {signals.length === 1 ? "One activation sits" : `${signals.length} activations sit`}{" "}
                  within the engine&apos;s tolerance of a line or gate edge. A
                  birth time wrong by a minute or two — or a different ephemeris —
                  can move them, and with them the profile or the incarnation
                  cross.
                </p>
                <ul className="mt-2 list-none space-y-1 p-0 font-mono text-xs text-code">
                  {nearestSignals.map((signal) => (
                    <li key={`${signal.kind}-${signal.source}-${signal.body}-${signal.gate}-${signal.line}`}>
                      {signal.label} · gate {signal.gate}.{signal.line} ·{" "}
                      {signal.distance.toFixed(4)}° from the {signal.kind} boundary
                    </li>
                  ))}
                </ul>
              </Notice>
            ) : null}

            {reading.warnings.length > 0 ? (
              <Notice tone="info" title="Computation notes">
                <ul className="list-disc space-y-1.5 pl-5">
                  {reading.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </Notice>
            ) : null}

            <Notice tone="info" title="Sources and limits">
              <p>
                The KP chart uses full VSOP87 and ELP/MPP02 series, verified to
                within half an arcsecond of the Swiss Ephemeris for the grahas
                and 0.1″ for the cusps. Its real error is the error in the
                recorded birth time: a cusp moves about 15″ per second of clock
                time, which is why KP asks for the time to the second. The
                Human Design bodygraph is computed from the same instant.
              </p>
            </Notice>
          </section>

          {/* ── The definitive summary ───────────────────────────────── */}
          <section aria-labelledby="summary-title" className="flex flex-col gap-6">
            <h2
              id="summary-title"
              className="font-display text-2xl leading-tight text-bone"
            >
              The definitive structure
            </h2>

            <dl className="surface m-0 overflow-hidden rounded-lg">
              <SummaryItem term="Type">
                <span className="font-display text-base tracking-wide">
                  {bodygraph.type}
                </span>
                <span className="mt-1 block text-muted">{typeContent.theme}</span>
                <span className="mt-2 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                  {`Strategy · ${typeContent.strategy} — Signature · ${typeContent.signature} — Not-self · ${typeContent.notSelf} — Aura · ${typeContent.aura}`}
                </span>
              </SummaryItem>

              <SummaryItem term="Profile">
                <span className="font-display text-base tracking-wide">
                  {`${bodygraph.profile}${profileContent ? ` — ${profileContent.name}` : ""}`}
                </span>
                {profileContent ? (
                  <span className="mt-1 block text-muted">{profileContent.theme}</span>
                ) : (
                  <span className="mt-1 block text-muted">
                    This line pairing is not one of the twelve canonical profiles,
                    so no profile read is offered. The mechanical bodygraph is
                    still valid.
                  </span>
                )}
              </SummaryItem>

              <SummaryItem term="Inner authority">
                <span className="font-display text-base tracking-wide">
                  {`${bodygraph.authority}${bodygraph.authority === "Mental" || bodygraph.authority === "Lunar" ? " — no inner authority" : ""}`}
                </span>
                <span className="mt-1 block text-muted">{authorityContent.how}</span>
                <span className="mt-2 block text-muted">{authorityContent.inPractice}</span>
              </SummaryItem>

              <SummaryItem term="Definition">
                <span className="font-display text-base tracking-wide">
                  {`${bodygraph.definition.label} · ${bodygraph.definition.componentCount} component${bodygraph.definition.componentCount === 1 ? "" : "s"}`}
                </span>
                <span className="mt-1 block text-muted">
                  {bodygraph.definitionDescription}
                </span>
              </SummaryItem>

              <SummaryItem term="Incarnation cross">
                <span className="font-display text-base tracking-wide">
                  {bodygraph.incarnationCross.label}
                </span>
                <span className="mt-1 block text-muted">
                  {`Personality Sun ${bodygraph.incarnationCross.personalitySun.gate}.${bodygraph.incarnationCross.personalitySun.line} · Design Sun ${bodygraph.incarnationCross.designSun.gate}.${bodygraph.incarnationCross.designSun.line}`}
                </span>
              </SummaryItem>

              <SummaryItem term="Aura Avatar">
                {avatar ? (
                  <>
                    <span className="font-display text-base tracking-wide">
                      {avatar.label}
                    </span>
                    <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                      {avatar.coordinate}
                    </span>
                    <span className="mt-2 block text-muted">{avatar.formatNote}</span>
                  </>
                ) : (
                  <span className="text-muted">Not available for this chart.</span>
                )}
              </SummaryItem>
            </dl>
          </section>

          {/* ── Bodygraph ────────────────────────────────────────────── */}
          <section aria-labelledby="bodygraph-title" className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h2
                id="bodygraph-title"
                className="font-display text-2xl leading-tight text-bone"
              >
                The bodygraph
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted">
                {`${bodygraph.definedCenterCount} of 9 centres defined, across ${bodygraph.channels.length} complete channel${bodygraph.channels.length === 1 ? "" : "s"} and ${bodygraph.hangingGates.length} hanging gate${bodygraph.hangingGates.length === 1 ? "" : "s"}.`}
              </p>
            </div>

            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
              <div className="surface flex items-center justify-center rounded-lg p-6">
                <Bodygraph data={reading.visualization} />
              </div>
              <div className="flex flex-col gap-5">
                <BodygraphTextSummary data={reading.visualization} />

                <div>
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                    Complete channels
                  </h3>
                  {bodygraph.channels.length > 0 ? (
                    <ul className="mt-3 list-none space-y-2 p-0">
                      {bodygraph.channels.map((channel) => (
                        <li
                          key={channel.key}
                          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted"
                        >
                          <span className="font-mono text-xs text-code">
                            {channel.key}
                          </span>
                          <span className="text-bone">{channel.name}</span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                            {channel.from} → {channel.to} · {channel.sources}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm leading-relaxed text-muted">
                      No complete channels. Nothing is consistently defined, which
                      is the Reflector configuration — a true mirror for the
                      people around you.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ── The KP chart ───────────────────────────────────────── */}
          <section aria-labelledby="chart-title" className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h2
                id="chart-title"
                className="font-display text-2xl leading-tight text-bone"
              >
                The KP chart
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted">
                Krishnamurti Paddhati, sidereal, with Placidus cusps and the full
                sign, star, sub and sub-sub lordship of every graha and cusp.
                Birth moment {kpView.birth.local.replace("T", " ")} ({kpView.birth.utcOffset}
                {kpView.birth.isDst ? ", daylight saving" : ""}) = {kpView.birth.utc.replace("T", " ").replace(".000Z", " UTC")}.
              </p>
            </div>
            <KpChartPanel chart={kpView} />
          </section>

          {/* ── Astrocartography ─────────────────────────────────────── */}
          <section aria-labelledby="map-title" className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h2 id="map-title" className="font-display text-2xl leading-tight text-bone">
                Astrocartography
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted">
                Where on Earth each graha was rising (Lagna), setting (7th),
                culminating (10th) or at the nadir (4th) at your birth instant.
                Click any line or place to read your KP chart relocated there.
              </p>
            </div>
            <AstroMap
              lines={cartoLines}
              code={reading.code}
              birthPlace={{
                name: reading.input.placeName ?? "Birthplace",
                latitude: reading.input.latitude,
                longitude: reading.input.longitude,
              }}
            />
          </section>

          {/* ── The nine centres ─────────────────────────────────────── */}
          <section aria-labelledby="centres-title" className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h2
                id="centres-title"
                className="font-display text-2xl leading-tight text-bone"
              >
                The nine centres
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted">
                A defined centre runs consistently and is yours to rely on. An
                open centre takes in and amplifies what is around you — that is
                not a weakness, and the question beneath each one is the practice.
              </p>
            </div>

            <div className="grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
              {category.centerReads.map((read) => {
                const content = CENTER_CONTENT_BY_KEY[read.key];
                return (
                  <article key={read.key} className="flex flex-col gap-3 bg-void p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-display text-lg tracking-wide text-bone">
                        {CENTER_MAP[read.key].name}
                      </h3>
                      <Badge tone={read.defined ? "purple" : "neutral"} size="sm">
                        {read.defined ? "Defined" : "Open"}
                      </Badge>
                    </div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                      {`${CENTER_MAP[read.key].kind} · ${content.biology}`}
                    </p>
                    <p className="text-sm leading-relaxed text-muted">
                      {read.defined ? content.defined : content.open}
                    </p>
                    {!read.defined && read.question ? (
                      <p className="mt-1 border-l border-gold/40 pl-3 text-sm italic leading-relaxed text-code">
                        {read.question}
                      </p>
                    ) : null}
                    <p className="mt-auto pt-2 text-xs leading-relaxed text-faint">
                      {read.defined ? read.strength : read.growthEdge}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          {/* ── Strengths and edges ──────────────────────────────────── */}
          <section
            aria-labelledby="capacities-title"
            className="flex flex-col gap-6"
          >
            <h2
              id="capacities-title"
              className="font-display text-2xl leading-tight text-bone"
            >
              What you can rely on, and where you grow
            </h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="surface rounded-lg p-6">
                <h3 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
                  <Sparkles aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />
                  Strengths, from the defined centres
                </h3>
                <ul className="mt-4 list-none space-y-3 p-0">
                  {category.strengths.map((strength) => (
                    <li
                      key={strength}
                      className="flex gap-2.5 text-sm leading-relaxed text-muted"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold"
                      />
                      {strength}
                    </li>
                  ))}
                  {category.strengths.length === 0 ? (
                    <li className="text-sm leading-relaxed text-muted">
                      No centres are defined, so nothing here runs on its own
                      clock. That is the Reflector design, not a deficit.
                    </li>
                  ) : null}
                </ul>
              </div>

              <div className="surface rounded-lg p-6">
                <h3 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-teal">
                  <Compass aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />
                  Growth edges, from the open centres
                </h3>
                <ul className="mt-4 list-none space-y-3 p-0">
                  {category.growthEdges.map((edge) => (
                    <li
                      key={edge}
                      className="flex gap-2.5 text-sm leading-relaxed text-muted"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-2 h-1 w-1 shrink-0 rounded-full bg-teal"
                      />
                      {edge}
                    </li>
                  ))}
                  {category.growthEdges.length === 0 ? (
                    <li className="text-sm leading-relaxed text-muted">
                      Every centre is defined. There is no open door here for
                      other people to walk through, which is its own kind of
                      isolation.
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>

            <div className="surface rounded-lg p-6">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                Your placement
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                {`${category.cohort.name} — ${category.cohort.description}`}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {`${category.archetype.name} — ${category.archetype.description}`}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {`${category.lane.name} — ${category.lane.description}`}
              </p>
            </div>
          </section>

          {/* ── Call to action ───────────────────────────────────────── */}
          <section
            aria-labelledby="claim-title"
            className="surface flex flex-col items-start gap-5 rounded-xl p-8 sm:p-10"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-gold">
              Keep it
            </p>
            <h2
              id="claim-title"
              className="font-display text-2xl leading-tight text-bone sm:text-3xl"
            >
              This reading is free and always will be. The work is what costs.
            </h2>
            <p className="max-w-2xl text-pretty leading-relaxed text-muted">
              Claim the reading to keep it against an account, or read how the
              collective runs before you decide. Nothing is charged until an
              application is reviewed by a person.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="primary" size="lg">
                <Link href="/onboarding">
                  Claim this reading
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/membership">See membership</Link>
              </Button>
              <Button asChild variant="ghost" size="lg">
                <Link href="/enter">Enter another chart</Link>
              </Button>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
