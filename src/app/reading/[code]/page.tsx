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
import { ChartWheel } from "@/components/cipher/chart-wheel";
import { Badge, Button, EmptyState } from "@/components/ui";
import { SiteFooter } from "@/components/chrome/site-footer";
import { SiteHeader } from "@/components/chrome/site-header";
import { POINT_GLYPH, POINT_NAME, POINT_ORDER } from "@/lib/astrology/glyphs";
import { formatLongitude } from "@/lib/astrology/zodiac";
import type { Position } from "@/lib/astrology/types";
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

const PRECISION_LABEL: Record<Position["precision"], string> = {
  high: "High",
  approximate: "Approx.",
  derived: "Derived",
};

function PositionsTable({ reading }: { reading: Reading }) {
  const byKey = new Map(reading.chart.positions.map((p) => [p.key, p]));
  const rows = POINT_ORDER.map((key) => byKey.get(key)).filter(
    (position): position is Position => position !== undefined,
  );

  return (
    <div className="surface overflow-x-auto rounded-lg">
      <table className="w-full min-w-[34rem] border-collapse text-left">
        <caption className="sr-only">
          Planetary positions, houses, motion and precision for this chart.
        </caption>
        <thead>
          <tr className="border-b border-hairline">
            {["Body", "Position", "House", "Motion", "Precision"].map((label) => (
              <th
                key={label}
                scope="col"
                className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-faint"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((position) => (
            <tr key={position.key} className="border-b border-hairline/70 last:border-b-0">
              <th
                scope="row"
                className="whitespace-nowrap px-4 py-3 text-left font-sans text-sm font-normal text-bone"
              >
                <span aria-hidden="true" className="mr-2 text-gold">
                  {POINT_GLYPH[position.key]}
                </span>
                {POINT_NAME[position.key]}
              </th>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums text-code">
                {formatLongitude(position.longitude)}
              </td>
              <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted">
                {position.house ?? "—"}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted">
                {position.retrograde ? "℞ retrograde" : "direct"}
              </td>
              <td className="px-4 py-3 text-xs text-faint">
                {PRECISION_LABEL[position.precision]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
 * @param props.searchParams - `?time=unknown` when the visitor skipped the hour
 *   in the intake, which the UI must state rather than infer from noon.
 */
export default async function ReadingPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  const query = await searchParams;
  const timeFlag = query.time;
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
  const { chart, bodygraph, avatar, category } = reading;
  const timeUnknown = Array.isArray(timeFlag)
    ? timeFlag.includes("unknown")
    : timeFlag === "unknown";

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

            {timeUnknown ? (
              <Notice tone="warn" title="Birth time unknown — read with care">
                <p>
                  You marked the birth time as unknown, so this chart was
                  computed for <strong className="text-bone">noon, local time</strong>{" "}
                  at the place of birth. The Sun, the outer planets and your Aura
                  Avatar seat are stable across the whole day. The Moon moves
                  roughly 13° a day, and the Ascendant crosses the zodiac in 24
                  hours, so the Moon&apos;s gate and line, the profile, the
                  Ascendant and Midheaven, and every house placement are
                  placeholders, not facts.
                </p>
              </Notice>
            ) : null}

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

            {reading.houseFallback ? (
              <Notice tone="warn" title="House system fell back">
                <p>
                  {chart.houses.fallbackReason ??
                    "The requested house system could not be computed."}{" "}
                  The cusps shown use{" "}
                  <span className="text-bone">{chart.houses.system}</span> instead
                  of the requested{" "}
                  <span className="text-bone">{chart.houses.requestedSystem}</span>.
                  Planet signs and the bodygraph are unaffected.
                </p>
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
                Positions come from the astronomy-engine ephemeris, good to
                roughly an arcminute against the Swiss Ephemeris. The angles are
                exact functions of the birth instant, so their real error is the
                error in the recorded time: about 15′ of Ascendant per minute of
                clock error. Chiron is omitted rather than approximated.
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

          {/* ── The natal chart ──────────────────────────────────────── */}
          <section aria-labelledby="chart-title" className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h2
                id="chart-title"
                className="font-display text-2xl leading-tight text-bone"
              >
                The natal chart
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted">
                A tropical chart with the Ascendant anchored at nine o&apos;clock
                and longitude increasing counter-clockwise. The table below
                carries the same data for screen readers, printing and copying.
              </p>
            </div>

            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
              <div className="surface rounded-lg p-4">
                <ChartWheel chart={chart} />
              </div>
              <PositionsTable reading={reading} />
            </div>
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
