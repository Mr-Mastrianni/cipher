import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { AlertTriangle, Compass, Info, Sparkles } from "lucide-react";
import { clerkConfigured, getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/db/store";
import { getCompleteProfile } from "@/lib/cipher/profile-snapshot";
import type { BirthProfile, User } from "@/lib/db/schema";
import type { KpBirthInput } from "@/lib/kp/chart";
import { toKpView } from "@/lib/kp/view";
import { computeReading, type Reading } from "@/lib/cipher/compute-reading";
import { encodeBirthInput, type ShareableBirth } from "@/lib/cipher/share-code";
import { CENTER_MAP, VARIABLE_POSITIONS, type CenterKey } from "@/lib/human-design";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, PageShell } from "@/components/chrome/page-shell";
import { Section } from "@/components/chrome/section";
import { KpChartPanel } from "@/components/cipher/kp-chart";
import { Bodygraph, BodygraphTextSummary } from "@/components/cipher/bodygraph";
import { AuraAvatarCard } from "@/components/cipher/aura-avatar-card";
import { ReadingActions } from "../_components/dashboard-shell";

/**
 * The full reading.
 *
 * The stored profile keeps the birth input; the engine is deterministic, so the
 * page recomputes the whole reading from that input rather than trusting a
 * cached projection. That is what makes the accuracy panel honest: the
 * boundary signals, chart warnings and Design-instant caveats are regenerated
 * for exactly the birth data being shown.
 *
 * Everything is server-rendered and printable. The only client code is the
 * print/share control, which needs the clipboard.
 */

export const metadata: Metadata = {
  title: "My Chart",
  robots: { index: false, follow: false },
};

const DEMO_MEMBER_CLERK_ID = "user_demo_member";

/**
 * Resolve the member, falling back to the seeded demo member without Clerk.
 *
 * @returns The member, or `null`.
 */
async function currentMember(): Promise<User | null> {
  const signedIn = await getCurrentUser();
  if (signedIn) return signedIn;
  if (clerkConfigured) return null;
  return getStore().getUserByClerkId(DEMO_MEMBER_CLERK_ID);
}

/**
 * Rebuild the engine's birth input from the stored profile columns.
 *
 * @param profile - The member's birth profile.
 * @returns A birth input, or `null` when the date or time cannot be parsed.
 */
function birthInputFromProfile(profile: BirthProfile): ShareableBirth | null {
  // The verified DST choice and node type travel with the stored KP snapshot.
  const stored = (profile.kpChart as {
    birth?: { input?: Partial<KpBirthInput> };
    system?: { nodeType?: "mean" | "true" };
  } | null) ?? null;
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(profile.birthDate);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(profile.birthTime);
  if (!dateMatch || !timeMatch) return null;
  return {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: Number(timeMatch[3] ?? "0"),
    timeZone: profile.birthTimeZone,
    latitude: profile.birthLatitude,
    longitude: profile.birthLongitude,
    placeName: profile.birthPlaceName ?? undefined,
    fold: stored?.birth?.input?.fold,
    nodeType: stored?.system?.nodeType,
  };
}

/** Collect the distinct warnings from the stored chart and the fresh read. */
function collectWarnings(profile: BirthProfile, reading: Reading | null): string[] {
  const stored = ((profile.kpChart as { warnings?: string[] } | null)?.warnings ?? []).filter(
    (warning) => typeof warning === "string",
  );
  const fresh = reading ? reading.warnings : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const warning of [...stored, ...fresh]) {
    if (!warning || seen.has(warning)) continue;
    seen.add(warning);
    out.push(warning);
  }
  return out;
}

/** The centre keys in the canonical display order. */
const CENTER_ORDER: readonly CenterKey[] = [
  "head",
  "ajna",
  "throat",
  "g",
  "heart",
  "spleen",
  "solar",
  "sacral",
  "root",
];

/**
 * The chart page.
 *
 * @returns The full reading, or an empty state when no chart exists.
 */
export default async function ChartPage() {
  const user = await currentMember();
  if (!user) return null;

  const profile = await getCompleteProfile(user.id);

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";

  if (!profile) {
    return (
      <PageShell width="lg">
        <PageHeader
          eyebrow="My Chart"
          title="No chart yet"
          description="The reading is computed from your birth date, time and place. Add them once and this page fills in."
        />
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="Nothing to read"
          description="Onboarding asks for three things and computes your KP chart, Human Design bodygraph and aura avatar in one pass."
          action={
            <Button asChild variant="primary" size="md">
              <Link href="/onboarding">Enter your coordinates</Link>
            </Button>
          }
        />
      </PageShell>
    );
  }

  const input = birthInputFromProfile(profile);
  let reading: Reading | null = null;
  let computeError: string | null = null;
  if (input) {
    try {
      reading = computeReading(input);
    } catch (error) {
      computeError =
        error instanceof Error
          ? error.message
          : "The reading could not be recomputed from the stored birth data.";
    }
  }

  const warnings = collectWarnings(profile, reading);
  const signals = reading?.bodygraph.signals ?? [];
  const code = input ? encodeBirthInput(input) : null;
  const shareUrl = code ? `${proto}://${host}/reading/${code}` : null;

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="My Chart"
        title={reading?.avatar ? reading.avatar.label : "Your reading"}
        description={
          profile.birthPlaceName
            ? `${profile.birthDate} at ${profile.birthTime} · ${profile.birthPlaceName}`
            : `${profile.birthDate} at ${profile.birthTime} · ${profile.birthTimeZone}`
        }
        actions={
          shareUrl ? <ReadingActions shareUrl={shareUrl} /> : undefined
        }
      />

      <div className="flex flex-col gap-12">
        {/* Accuracy --------------------------------------------------------- */}
        <Section
          eyebrow="Accuracy"
          title="How much to trust this reading"
          description="KP cuspal sub lords can change within seconds of clock time, so each cusp shows how many seconds it can absorb. In Human Design, gate, line and profile survive a birth time accurate to the minute; tone and base do not."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {signals.length > 0 ? (
                    <AlertTriangle aria-hidden="true" className="h-4 w-4 text-warn" />
                  ) : (
                    <Info aria-hidden="true" className="h-4 w-4 text-ok" />
                  )}
                  Near-boundary activations
                  <Badge tone={signals.length > 0 ? "warn" : "ok"} size="sm">
                    {signals.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {signals.length === 0 ? (
                  <p className="text-sm text-muted">
                    No activation sits close enough to a slice edge for a few
                    minutes of clock error to change the reading.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2 text-sm">
                    {signals.map((signal, index) => (
                      <li
                        key={`${signal.body}-${signal.source}-${index}`}
                        className="flex flex-wrap items-baseline gap-2"
                      >
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                          {signal.source}
                        </span>
                        <span className="text-bone">{signal.label}</span>
                        <span className="text-muted">
                          gate {signal.gate}.{signal.line}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-warn">
                          {signal.distance.toFixed(4)}° from the {signal.kind} edge
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info aria-hidden="true" className="h-4 w-4 text-info" />
                  Engine notes
                  <Badge tone={warnings.length > 0 ? "warn" : "neutral"} size="sm">
                    {warnings.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {computeError ? (
                  <p className="text-sm text-danger">{computeError}</p>
                ) : warnings.length === 0 ? (
                  <p className="text-sm text-muted">
                    The birth moment, the KP cusps and sub lords, and the Design
                    instant all resolved without a caveat.
                  </p>
                ) : (
                  <ul className="flex list-disc flex-col gap-2 pl-4 text-sm text-muted">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
                {reading?.bodygraph && (
                  <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                    Design instant {reading.bodygraph.designIntervalDays.toFixed(2)} days
                    before birth (88° of solar arc)
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* Aura avatar ------------------------------------------------------ */}
        {reading?.avatar ? (
          <Section eyebrow="Signature" title="Aura Avatar">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
              <AuraAvatarCard avatar={reading.avatar} name={user.displayName ?? undefined} />
              <div className="flex flex-col gap-4 self-center">
                <p className="text-sm leading-relaxed text-muted">
                  {reading.summary}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {reading.chips.map((chip) => (
                    <li key={chip}>
                      <Badge tone="neutral" size="sm">
                        {chip}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>
        ) : null}

        {/* KP chart --------------------------------------------------------- */}
        {reading ? (
          <Section
            eyebrow="Astrology · KP"
            title="Krishnamurti Paddhati"
            description="Sidereal zodiac, KP ayanamsa, Placidus cusps. Select any graha or cusp for its full lordship chain."
          >
            <KpChartPanel chart={toKpView(reading.kp)} />
          </Section>
        ) : null}

        {/* Bodygraph + centres ---------------------------------------------- */}
        {reading ? (
          <Section
            eyebrow="Human Design"
            title="The bodygraph"
            description="Defined centres have a consistent way of operating. Open centres take in and amplify the room — that is the sensitivity, not the fault."
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
              <div className="surface rounded-lg p-4">
                <Bodygraph data={reading.visualization} />
              </div>
              <div className="flex flex-col gap-6">
                <ul className="grid gap-3 sm:grid-cols-2">
                  {CENTER_ORDER.map((key) => {
                    const state = reading.bodygraph.centers[key];
                    const meta = CENTER_MAP[key];
                    return (
                      <li
                        key={key}
                        className="surface flex flex-col gap-1 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-display text-base text-bone">{meta.name}</p>
                          <Badge tone={state.defined ? "purple" : "neutral"} size="sm">
                            {state.defined ? "Defined" : "Open"}
                          </Badge>
                        </div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                          {meta.kind} · {meta.biology}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted">
                          {state.defined
                            ? `Defining gates: ${state.gates.join(", ") || "—"}.`
                            : `Activated but hanging: ${state.activatedGates.join(", ") || "none"}.`}
                        </p>
                      </li>
                    );
                  })}
                </ul>
                <BodygraphTextSummary data={reading.visualization} />
              </div>
            </div>
          </Section>
        ) : null}

        {/* Channels --------------------------------------------------------- */}
        {reading ? (
          <Section
            eyebrow="Wiring"
            title="Channels and hanging gates"
            description="Only a complete channel defines. A hanging gate is potential waiting on the other half."
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Defined channels{" "}
                    <Badge tone="gold" size="sm">
                      {reading.bodygraph.channels.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {reading.bodygraph.channels.length === 0 ? (
                    <p className="text-sm text-muted">
                      No complete channels. This is a fully open chart.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2 text-sm">
                      {reading.bodygraph.channels.map((channel) => (
                        <li
                          key={channel.key}
                          className="flex flex-wrap items-baseline gap-2"
                        >
                          <span className="font-mono text-xs text-gold">
                            {channel.gates[0]}–{channel.gates[1]}
                          </span>
                          <span className="text-bone">{channel.name}</span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                            {channel.from} → {channel.to} · {channel.sources}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Hanging gates{" "}
                    <Badge tone="neutral" size="sm">
                      {reading.bodygraph.hangingGates.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {reading.bodygraph.hangingGates.length === 0 ? (
                    <p className="text-sm text-muted">
                      Every activated gate completes a channel.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2 text-sm">
                      {reading.bodygraph.hangingGates.map((gate) => (
                        <li key={gate.gate} className="flex flex-wrap items-baseline gap-2">
                          <span className="font-mono text-xs text-gold">{gate.gate}</span>
                          <span className="text-muted">
                            waiting on {gate.waitingOn.join(", ") || "—"}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                            {gate.center} · line {gate.strongestLine}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </Section>
        ) : null}

        {/* Cross + variables ------------------------------------------------- */}
        {reading ? (
          <Section
            eyebrow="Life theme"
            title="Incarnation cross and variables"
            description="The cross is the quartet of the two Sun/Earth axes. The four arrows are the variables — how you take in, orient, motivate and see."
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Incarnation cross</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="font-display text-lg text-bone">
                    {reading.bodygraph.incarnationCross.label}
                  </p>
                  <p className="font-mono text-xs text-muted">
                    {reading.bodygraph.incarnationCross.quartet}
                  </p>
                  <Badge tone="teal" size="sm">
                    {reading.bodygraph.incarnationCross.angle} angle
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Variables</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {VARIABLE_POSITIONS.map((position) => {
                      const variable = reading.bodygraph.variables[position];
                      return (
                        <div key={position} className="surface rounded-md p-3">
                          <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                            {position}
                          </dt>
                          <dd className="mt-1 text-sm text-bone">{variable.name}</dd>
                          <dd className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                            {variable.direction} · colour {variable.color} · tone{" "}
                            {variable.tone} · {variable.side}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </CardContent>
              </Card>
            </div>
          </Section>
        ) : null}

        {/* Activation detail ------------------------------------------------ */}
        {reading ? (
          <Section
            eyebrow="Detail"
            title="Every activation"
            description="Twenty-six activations: thirteen conscious from the birth moment, thirteen unconscious from the Design moment."
          >
            <div className="surface overflow-x-auto rounded-lg">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <caption className="sr-only">
                  Human Design activations by body, gate, line and colour.
                </caption>
                <thead>
                  <tr className="border-b border-hairline text-left">
                    {["Side", "Body", "Gate", "Line", "Colour / Tone / Base"].map(
                      (heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-faint"
                        >
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {reading.bodygraph.activations.map((activation, index) => (
                    <tr
                      key={`${activation.source}-${activation.body}-${index}`}
                      className="border-b border-hairline/60"
                    >
                      <td className="px-4 py-3">
                        <Badge
                          tone={activation.source === "personality" ? "purple" : "teal"}
                          size="sm"
                        >
                          {activation.source}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-bone">{activation.body}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gold">
                        {activation.gate}.{activation.line}
                      </td>
                      <td className="px-4 py-3 text-muted">{activation.line}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">
                        {activation.color} / {activation.tone} / {activation.base}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        ) : null}

        <p className="no-print flex items-center gap-2 text-xs text-faint">
          <Compass aria-hidden="true" className="h-4 w-4" />
          Human Design and astrology are maps of experience, not diagnoses and
          not forecasts.
        </p>
      </div>
    </PageShell>
  );
}
