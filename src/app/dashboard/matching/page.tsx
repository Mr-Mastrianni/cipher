"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Eye, EyeOff, MessageCircle, Orbit, Sparkles, Users } from "lucide-react";
import { MATCH_INTERESTS } from "@/lib/matching/interests";
import type { MatchReason } from "@/lib/matching/score";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader, PageShell } from "@/components/chrome/page-shell";
import { Section } from "@/components/chrome/section";
import { cn } from "@/lib/utils";

interface Match {
  member: {
    id: string;
    name: string;
    imageUrl: string | null;
    bio: string | null;
    hd: { type: string; profile: string } | null;
    kp: { moonNakshatra: string; lagnaRasi: string } | null;
  };
  score: number;
  reasons: MatchReason[];
}

interface MatchingPayload {
  ok: boolean;
  error?: string;
  optedIn?: boolean;
  interests?: string[];
  canMessage?: boolean;
  needsBirthProfile?: boolean;
  matches?: Match[];
}

const STRAND: Record<MatchReason["strand"], { label: string; icon: typeof Orbit; tone: string }> = {
  interests: { label: "Interests", icon: Sparkles, tone: "text-teal" },
  "human-design": { label: "Human Design", icon: Users, tone: "text-purple-hi" },
  kp: { label: "KP", icon: Orbit, tone: "text-gold" },
};

async function fetchMatching(): Promise<MatchingPayload> {
  try {
    const response = await fetch("/api/matching", { cache: "no-store" });
    return (await response.json()) as MatchingPayload;
  } catch {
    return { ok: false, error: "We could not reach the server." };
  }
}

/** Cosmic matching: opt in, choose interests, and see who resonates and why. */
export default function MatchingPage() {
  const reduced = useReducedMotion();
  const [data, setData] = useState<MatchingPayload | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchMatching().then((payload) => {
      if (cancelled) return;
      setData(payload);
      setInterests(payload.interests ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(patch: { optIn?: boolean; interests?: string[] }) {
    setSaving(true);
    await fetch("/api/matching", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
    const payload = await fetchMatching();
    setData(payload);
    setInterests(payload.interests ?? []);
    setSaving(false);
  }

  const toggleInterest = (id: string) =>
    setInterests((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : current.length >= 8 ? current : [...current, id],
    );

  if (!data) {
    return (
      <PageShell width="lg">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner size="sm" label="Loading" /> Aligning the collective…
        </p>
      </PageShell>
    );
  }
  if (!data.ok) {
    return (
      <PageShell width="lg">
        <EmptyState icon={<Users className="h-5 w-5" />} title="Matching is for approved members" description={data.error ?? "Sign in with an approved membership to use cosmic matching."} />
      </PageShell>
    );
  }

  const interestsChanged = JSON.stringify([...interests].sort()) !== JSON.stringify([...(data.interests ?? [])].sort());

  return (
    <PageShell width="lg">
      <PageHeader
        eyebrow="Starseed Collective"
        title="Cosmic matching"
        description="Find members who resonate with you through shared interests, Human Design mechanics and KP signatures — with every reason shown."
      />

      <div className="flex flex-col gap-12">
        <Section eyebrow="Consent" title={data.optedIn ? "You are visible to matching" : "You are not visible to matching"}>
          <div className="surface flex flex-col gap-4 rounded-lg p-5">
            <p className="text-sm leading-relaxed text-muted">
              Matching is opt-in. While you are visible, other opted-in members can see your name, photo and bio,
              your Human Design type and profile, and your KP Moon nakshatra and Lagna rasi. Your birth date, time
              and place are never shown. You can switch this off at any time and you disappear immediately.
            </p>
            <div>
              <Button
                variant={data.optedIn ? "secondary" : "primary"}
                size="sm"
                loading={saving}
                iconLeft={data.optedIn ? <EyeOff className="h-3.5 w-3.5" strokeWidth={1.5} /> : <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />}
                onClick={() => void save({ optIn: !data.optedIn })}
              >
                {data.optedIn ? "Hide me from matching" : "Make me visible and show my matches"}
              </Button>
            </div>
          </div>
        </Section>

        <Section eyebrow="Interests" title="What you want to share" description="Pick up to eight. Shared interests are one of the three strands of a match.">
          <div className="flex flex-wrap gap-2">
            {MATCH_INTERESTS.map((interest) => {
              const on = interests.includes(interest.id);
              return (
                <button
                  key={interest.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleInterest(interest.id)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                    on ? "border-gold bg-gold/10 text-bone" : "border-hairline text-muted hover:border-line",
                  )}
                >
                  {interest.label}
                </button>
              );
            })}
          </div>
          {interestsChanged ? (
            <div className="mt-4">
              <Button size="sm" variant="primary" loading={saving} onClick={() => void save({ interests })}>
                Save interests
              </Button>
            </div>
          ) : null}
        </Section>

        {data.optedIn ? (
          <Section eyebrow="Resonance" title="Your matches" description="Ranked by score. KP resonance describes shared signatures between charts; it is not a classical compatibility verdict.">
            {data.needsBirthProfile ? (
              <EmptyState
                icon={<Orbit className="h-5 w-5" />}
                title="Add your verified birth moment first"
                description="Human Design and KP matching need your chart."
                action={<Button asChild variant="primary" size="sm"><Link href="/onboarding">Enter your coordinates</Link></Button>}
              />
            ) : (data.matches ?? []).length === 0 ? (
              <EmptyState icon={<Users className="h-5 w-5" />} title="No resonances yet" description="As more members opt in, matches appear here. Adding interests helps." />
            ) : (
              <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
                {(data.matches ?? []).map((match, index) => (
                  <motion.li
                    key={match.member.id}
                    initial={reduced ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduced ? 0 : 0.4, delay: reduced ? 0 : Math.min(index * 0.05, 0.3) }}
                    className="surface flex flex-col gap-4 rounded-lg p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-raised font-display text-lg text-gold">
                          {match.member.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={match.member.imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            match.member.name.slice(0, 1)
                          )}
                        </span>
                        <div>
                          <p className="font-display text-lg text-bone">{match.member.name}</p>
                          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                            {[
                              match.member.hd ? `${match.member.hd.type} ${match.member.hd.profile}` : null,
                              match.member.kp ? `Moon in ${match.member.kp.moonNakshatra}` : null,
                              match.member.kp ? `${match.member.kp.lagnaRasi} Lagna` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-display text-2xl tabular-nums text-gold">{match.score}</span>
                        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">resonance</span>
                      </div>
                    </div>
                    {match.member.bio ? <p className="text-sm leading-relaxed text-muted">{match.member.bio}</p> : null}
                    <ul className="m-0 list-none space-y-2 p-0">
                      {match.reasons.map((reason) => {
                        const strand = STRAND[reason.strand];
                        const Icon = strand.icon;
                        return (
                          <li key={reason.text} className="flex items-start gap-2 text-sm text-muted">
                            <Icon aria-hidden="true" className={cn("mt-0.5 h-4 w-4 shrink-0", strand.tone)} strokeWidth={1.5} />
                            <span>
                              <span className="sr-only">{strand.label}: </span>
                              {reason.text}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-auto flex items-center gap-3">
                      {data.canMessage ? (
                        <Button asChild size="sm" variant="secondary" iconLeft={<MessageCircle className="h-3.5 w-3.5" strokeWidth={1.5} />}>
                          <Link href={`/dashboard/messages?with=${encodeURIComponent(match.member.id)}`}>Send a message</Link>
                        </Button>
                      ) : (
                        <Badge tone="neutral" size="sm">Messaging opens at Initiate</Badge>
                      )}
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </Section>
        ) : null}
      </div>
    </PageShell>
  );
}
