"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { CheckCircle2, CircleSlash, Crosshair, HelpCircle, LocateFixed, Send, TriangleAlert } from "lucide-react";
import { GRAHA_LABEL, type Graha } from "@/lib/kp/constants";
import { HORARY_CATEGORIES, negatingHouses, type HoraryJudgement } from "@/lib/kp/horary-categories";
import type { KpChartView } from "@/lib/kp/view";
import { KpChartPanel } from "@/components/cipher/kp-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/input";
import { PageHeader, PageShell } from "@/components/chrome/page-shell";
import { Section } from "@/components/chrome/section";
import { cn } from "@/lib/utils";

interface Result {
  judgement: HoraryJudgement;
  view: KpChartView;
  question: string;
}

interface HistoryItem {
  id: string;
  number: number | null;
  category: string;
  question: string;
  askedAt: string;
  verdict: string;
  snapshot: { judgement?: HoraryJudgement; view?: KpChartView } | null;
}

const VERDICT = {
  promised: { label: "Promised", tone: "text-ok border-ok/40 bg-ok/5", icon: CheckCircle2 },
  mixed: { label: "Qualified", tone: "text-warn border-warn/40 bg-warn/5", icon: TriangleAlert },
  denied: { label: "Not promised", tone: "text-danger border-danger/40 bg-danger/5", icon: CircleSlash },
} as const;

const name = (g: Graha) => GRAHA_LABEL[g].english;
const fmt = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

async function fetchHistory(): Promise<HistoryItem[] | string> {
  try {
    const response = await fetch("/api/kp/horary", { cache: "no-store" });
    const data = (await response.json()) as { ok: boolean; questions?: HistoryItem[]; error?: string };
    return data.ok ? (data.questions ?? []) : (data.error ?? "Sign in to use KP horary.");
  } catch {
    return "We could not reach the server.";
  }
}

/** KP horary (Prashna): ask, give a number or let the moment choose, and read the judgement. */
export default function HoraryPage() {
  const reduced = useReducedMotion();
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<string>(HORARY_CATEGORIES[0].id);
  const [method, setMethod] = useState<"number" | "time">("number");
  const [number, setNumber] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [timeZone, setTimeZone] = useState("UTC");
  const [nodeType, setNodeType] = useState<"mean" | "true">("mean");
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<HistoryItem[] | string | null>(null);
  const [posted, setPosted] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchHistory().then((h) => {
      if (cancelled) return;
      setHistory(h);
      setTimeZone(browserTimeZone());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = HORARY_CATEGORIES.find((c) => c.id === category) ?? HORARY_CATEGORIES[0];

  function locate() {
    if (!navigator.geolocation) {
      setError("This browser cannot share a location. Enter latitude and longitude.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(4));
        setLon(pos.coords.longitude.toFixed(4));
        setTimeZone(browserTimeZone());
        setLocating(false);
      },
      () => {
        setError("Location was not shared. Enter latitude and longitude instead.");
        setLocating(false);
      },
      { timeout: 10000 },
    );
  }

  async function judge() {
    setError(null);
    setPosted(null);
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (question.trim().length < 3) return setError("Write the question as you would ask it.");
    if (method === "number" && !/^\d{1,3}$/.test(number)) return setError("Give a whole number from 1 to 249.");
    if (method === "number" && (Number(number) < 1 || Number(number) > 249)) return setError("The number runs from 1 to 249.");
    if (!lat || !lon || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return setError("Give the place of judgement — use your location or enter coordinates.");
    }
    setBusy(true);
    try {
      const response = await fetch("/api/kp/horary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: method === "number" ? Number(number) : null,
          category,
          question: question.trim(),
          latitude,
          longitude,
          timeZone,
          nodeType,
        }),
      });
      const data = (await response.json()) as { ok: boolean; judgement?: HoraryJudgement; view?: KpChartView; error?: string };
      if (!response.ok || !data.ok || !data.judgement || !data.view) {
        setError(data.error ?? "The question could not be judged.");
        return;
      }
      setResult({ judgement: data.judgement, view: data.view, question: question.trim() });
      setHistory(await fetchHistory());
    } catch {
      setError("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function postToRoom() {
    if (!result) return;
    const j = result.judgement;
    const body =
      `Prashna: “${result.question}”\n` +
      `${j.category.label} · ${result.view.birth.local.replace("T", " ")} ${result.view.birth.utcOffset}\n` +
      `Cusp ${j.cusp.house} sub lord ${name(j.cusp.subLord)} (star of ${name(j.cusp.starOfSubLord)}) → houses ${[...new Set([...j.viaStarLord, ...j.viaSelf])].join(", ") || "none"}.\n` +
      `Favourable ${j.favourable.join(", ")}; negating ${j.negating.join(", ")}. Verdict: ${VERDICT[j.verdict].label}.\n` +
      `Fruitful significators: ${j.fruitful.map(name).join(", ") || "none"}. What do you read?`;
    const response = await fetch("/api/community/prashna-room/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }).catch(() => null);
    setPosted(response?.ok ? "Posted to the Prashna Room." : "Could not post — the Prashna Room opens at Initiate.");
  }

  if (typeof history === "string") {
    return (
      <PageShell width="lg">
        <EmptyState icon={<HelpCircle className="h-5 w-5" />} title="KP horary is for members" description={history} />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="KP Horary · Prashna"
        title="Ask, and read the moment"
        description="Krishnamurti Paddhati horary: give a number from 1 to 249 (or let the moment choose), and the question is judged by the sub lord of its deciding cusp, the ruling planets at judgement, and the horary dasha."
      />

      <div className="flex flex-col gap-12">
        <Section eyebrow="The question" title="What do you want to know?">
          <form
            className="surface flex flex-col gap-6 rounded-lg p-6"
            onSubmit={(event) => {
              event.preventDefault();
              void judge();
            }}
          >
            <Field label="Your question" description="One clear question, asked sincerely, once. KP holds that the same question should not be asked again soon.">
              <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} rows={2} placeholder="Will I get the job I interviewed for this week?" />
            </Field>

            <Field label="Type of question" description={`Decided by cusp ${selected.decidingCusp}. Favourable houses ${selected.favourable.join(", ")}; negating ${negatingHouses(selected.favourable).join(", ")}.`}>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="field w-full bg-transparent px-0 py-2 text-sm text-bone"
              >
                {HORARY_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id} className="bg-ink">
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Method</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["number", "Give a number (1–249)", "Ask the question, then say the first number that comes to mind. It fixes the Lagna to that KP sub."],
                    ["time", "Let the moment choose", "The Lagna is the real Lagna at this moment and place."],
                  ] as const
                ).map(([value, label, note]) => (
                  <label
                    key={value}
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 rounded-md border p-4 transition-colors",
                      method === value ? "border-gold bg-gold/10" : "border-hairline hover:border-line",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm text-bone">
                      <input type="radio" name="method" checked={method === value} onChange={() => setMethod(value)} className="accent-[var(--c-gold)]" />
                      {label}
                    </span>
                    <span className="text-xs leading-relaxed text-faint">{note}</span>
                  </label>
                ))}
              </div>
              {method === "number" ? (
                <div className="max-w-[10rem]">
                  <Field label="Number" required>
                    <Input inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="1–249" />
                  </Field>
                </div>
              ) : null}
            </fieldset>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Place of judgement</legend>
              <div className="flex flex-wrap items-end gap-4">
                <Button type="button" variant="secondary" size="sm" loading={locating} onClick={locate} iconLeft={<LocateFixed className="h-3.5 w-3.5" strokeWidth={1.5} />}>
                  Use my location
                </Button>
                <div className="w-32"><Field label="Latitude"><Input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="28.6139" /></Field></div>
                <div className="w-32"><Field label="Longitude"><Input inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="77.2090" /></Field></div>
                <div className="w-48"><Field label="Time zone"><Input value={timeZone} onChange={(e) => setTimeZone(e.target.value)} /></Field></div>
                <div className="w-40">
                  <Field label="Rahu / Ketu">
                    <select value={nodeType} onChange={(e) => setNodeType(e.target.value as "mean" | "true")} className="field w-full bg-transparent px-0 py-2 text-sm text-bone">
                      <option value="mean" className="bg-ink">Mean node (KP default)</option>
                      <option value="true" className="bg-ink">True node</option>
                    </select>
                  </Field>
                </div>
              </div>
            </fieldset>

            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}

            <div>
              <Button type="submit" variant="primary" loading={busy} iconLeft={<Crosshair className="h-3.5 w-3.5" strokeWidth={1.5} />}>
                Judge the question
              </Button>
            </div>
          </form>
        </Section>

        {result ? (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.45 }}
            className="flex flex-col gap-12"
          >
            <Judgement result={result} onPost={() => void postToRoom()} posted={posted} />
            <Section eyebrow="The horary chart" title="Cast for the moment of judgement">
              <KpChartPanel chart={result.view} mode="horary" />
            </Section>
          </motion.div>
        ) : null}

        <Section eyebrow="History" title="Your questions">
          {!history || history.length === 0 ? (
            <p className="text-sm text-muted">Questions you judge are kept here with the verdict as it was shown.</p>
          ) : (
            <ul className="surface m-0 list-none divide-y divide-hairline/70 rounded-lg p-0">
              {history.map((item) => {
                const v = VERDICT[item.verdict as keyof typeof VERDICT] ?? VERDICT.mixed;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={!item.snapshot?.judgement || !item.snapshot?.view}
                      onClick={() =>
                        item.snapshot?.judgement && item.snapshot?.view
                          ? setResult({ judgement: item.snapshot.judgement, view: item.snapshot.view, question: item.question })
                          : undefined
                      }
                      className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-raised/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                    >
                      <span className="flex flex-col">
                        <span className="text-sm text-bone">{item.question}</span>
                        <span className="font-mono text-[11px] text-faint">
                          {HORARY_CATEGORIES.find((c) => c.id === item.category)?.label ?? item.category} ·{" "}
                          {item.number ? `number ${item.number}` : "time method"} · {fmt(item.askedAt)}
                        </span>
                      </span>
                      <Badge tone={item.verdict === "promised" ? "ok" : item.verdict === "denied" ? "danger" : "warn"} size="sm">
                        {v.label}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </PageShell>
  );
}

function Judgement({ result, onPost, posted }: { result: Result; onPost: () => void; posted: string | null }) {
  const j = result.judgement;
  const v = VERDICT[j.verdict];
  const Icon = v.icon;
  const signified = [...new Set([...j.viaStarLord, ...j.viaSelf])].sort((a, b) => a - b);
  return (
    <Section eyebrow="Judgement" title={`“${result.question}”`}>
      <div className={cn("flex flex-col gap-5 rounded-lg border p-6", v.tone)}>
        <p className="flex items-center gap-3 font-display text-2xl">
          <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.5} />
          {v.label}
        </p>
        <p className="text-sm leading-relaxed text-muted">{j.explanation}</p>

        <ol className="m-0 grid list-none gap-3 p-0 sm:grid-cols-3">
          <li className="rounded-md border border-hairline bg-ink/60 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">1 · Deciding cusp</p>
            <p className="mt-1 text-sm text-bone">
              Cusp {j.cusp.house} → sub lord <span className="text-gold">{name(j.cusp.subLord)}</span>
            </p>
          </li>
          <li className="rounded-md border border-hairline bg-ink/60 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">2 · Through its star lord</p>
            <p className="mt-1 text-sm text-bone">
              {name(j.cusp.starOfSubLord)} → houses {j.viaStarLord.join(", ") || "none"}
            </p>
          </li>
          <li className="rounded-md border border-hairline bg-ink/60 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">3 · Houses signified</p>
            <p className="mt-1 flex flex-wrap gap-1.5">
              {signified.length === 0 ? <span className="text-sm text-faint">none</span> : null}
              {signified.map((h) => (
                <span
                  key={h}
                  className={cn(
                    "rounded border px-1.5 py-0.5 font-mono text-xs",
                    j.favourable.includes(h) ? "border-ok/50 text-ok" : j.negating.includes(h) ? "border-danger/50 text-danger" : "border-hairline text-muted",
                  )}
                >
                  {h}
                </span>
              ))}
            </p>
          </li>
        </ol>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Fruitful significators</p>
            <p className="mt-1 text-sm text-bone">
              {j.fruitful.length ? j.fruitful.map(name).join(", ") : "None among the ruling planets"}
            </p>
            <p className="mt-1 text-xs text-faint">Significators of houses {j.favourable.join(", ")} that are also ruling planets at judgement.</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Candidate windows (horary dasha)</p>
            {j.windows.length === 0 ? (
              <p className="mt-1 text-sm text-muted">{j.verdict === "denied" ? "Not applicable." : "None within three years."}</p>
            ) : (
              <ul className="m-0 mt-1 list-none space-y-1 p-0 font-mono text-xs text-code">
                {j.windows.slice(0, 6).map((w) => (
                  <li key={`${w.level}-${w.start}`}>
                    {w.lords.map(name).join(" › ")} · {fmt(w.start)} – {fmt(w.end)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
          <Button type="button" variant="secondary" size="sm" onClick={onPost} iconLeft={<Send className="h-3.5 w-3.5" strokeWidth={1.5} />}>
            Post to the Prashna Room
          </Button>
          {posted ? <span className="text-xs text-muted">{posted}</span> : null}
          <Link href="/dashboard/courses/kp-foundations/ruling-planets" className="text-xs text-faint underline-offset-4 hover:text-gold hover:underline">
            How ruling planets work
          </Link>
        </div>
        <p className="text-xs leading-relaxed text-faint">
          This is the KP method applied mechanically and shown in full so you can check it. A practitioner may weigh
          further factors; treat the verdict as a reading, not a certainty.
        </p>
      </div>
    </Section>
  );
}
