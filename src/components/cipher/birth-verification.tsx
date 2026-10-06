"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Clock, Globe2, TriangleAlert } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** The birth moment as entered: wall-clock time to the second, at a place and zone. */
export interface BirthMomentDraft {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  timeZone: string;
  latitude: number;
  longitude: number;
  placeName?: string;
}

export interface VerifiedBirth extends BirthMomentDraft {
  fold?: "earlier" | "later";
  nodeType: "mean" | "true";
}

interface ResolvedMoment {
  utc: string;
  local: string;
  utcOffset: string;
  abbreviation: string;
  isDst: boolean;
}

type ResolveResponse =
  | { ok: true; ambiguous: true; timeZone: string; candidates: { earlier: ResolvedMoment; later: ResolvedMoment } }
  | { ok: true; ambiguous: false; timeZone: string; resolved: ResolvedMoment; warnings: string[] }
  | { ok: false; error: string };

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The KP birth-time verification step.
 *
 * Shows exactly how the entered wall-clock time resolves — zone, UTC offset,
 * daylight saving and the UTC instant — and requires an explicit confirmation
 * (and, for a repeated local hour, an explicit choice) before `onChange`
 * reports a verified birth. Until then it reports `null`.
 */
export function BirthVerification({
  draft,
  onChange,
}: {
  draft: BirthMomentDraft;
  onChange: (verified: VerifiedBirth | null) => void;
}) {
  const [response, setResponse] = useState<ResolveResponse | null>(null);
  const [fold, setFold] = useState<"earlier" | "later" | null>(null);
  const [nodeType, setNodeType] = useState<"mean" | "true">("mean");
  const [confirmed, setConfirmed] = useState(false);

  const key = JSON.stringify(draft);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/birth/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: key,
    })
      .then((r) => r.json() as Promise<ResolveResponse>)
      .catch((): ResolveResponse => ({ ok: false, error: "We could not reach the server to verify the time." }))
      .then((data) => {
        if (!cancelled) setResponse(data);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const ambiguous = response?.ok === true && response.ambiguous;
  const moment: ResolvedMoment | null =
    response?.ok !== true
      ? null
      : response.ambiguous
        ? fold
          ? response.candidates[fold]
          : null
        : response.resolved;
  const ready = Boolean(moment) && confirmed;

  useEffect(() => {
    onChange(ready ? { ...draft, nodeType, ...(ambiguous && fold ? { fold } : {}) } : null);
    // `draft` is captured through `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fold, nodeType, key, ambiguous]);

  if (!response) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Spinner size="sm" label="Verifying" /> Resolving the exact instant…
      </p>
    );
  }
  if (!response.ok) {
    return (
      <p role="alert" className="flex items-start gap-2 text-sm leading-relaxed text-danger">
        <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
        {response.error}
      </p>
    );
  }

  const entered = `${draft.year}-${pad(draft.month)}-${pad(draft.day)} ${pad(draft.hour)}:${pad(draft.minute)}:${pad(draft.second)}`;

  return (
    <div className="flex flex-col gap-6">
      <dl className="surface m-0 grid gap-px overflow-hidden rounded-lg bg-hairline sm:grid-cols-2">
        {[
          ["Local birth time", entered],
          ["Time zone", response.timeZone],
          ["Place", `${draft.placeName ? `${draft.placeName} · ` : ""}${Math.abs(draft.latitude).toFixed(4)}°${draft.latitude >= 0 ? "N" : "S"} ${Math.abs(draft.longitude).toFixed(4)}°${draft.longitude >= 0 ? "E" : "W"}`],
          ["UTC offset", moment ? `${moment.utcOffset}${moment.abbreviation ? ` (${moment.abbreviation})` : ""}` : "choose below"],
          ["Daylight saving", moment ? (moment.isDst ? "In effect" : "Not in effect") : "choose below"],
          ["Exact instant (UTC)", moment ? moment.utc.replace("T", " ").replace(".000Z", "") : "choose below"],
        ].map(([term, value]) => (
          <div key={term} className="bg-ink px-5 py-4">
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">{term}</dt>
            <dd className="mt-1.5 font-mono text-sm tabular-nums text-bone">{value}</dd>
          </div>
        ))}
      </dl>

      {ambiguous ? (
        <fieldset className="flex flex-col gap-3 rounded-lg border border-warn/40 bg-warn/5 p-5">
          <legend className="flex items-center gap-2 px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-warn">
            <Clock aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
            This local time happened twice
          </legend>
          <p className="text-sm leading-relaxed text-muted">
            The clocks fell back on this date in {response.timeZone}, so {entered.slice(11)} occurred twice, an hour apart.
            KP will not guess. Check the birth record (it may note daylight or standard time) and choose:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["earlier", "later"] as const).map((option) => {
              const candidate = response.candidates[option];
              return (
                <label
                  key={option}
                  className={cn(
                    "flex cursor-pointer flex-col gap-1 rounded-md border p-4 transition-colors",
                    fold === option ? "border-gold bg-gold/10" : "border-hairline hover:border-line",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm text-bone">
                    <input
                      type="radio"
                      name="fold"
                      value={option}
                      checked={fold === option}
                      onChange={() => {
                        setFold(option);
                        setConfirmed(false);
                      }}
                      className="accent-[var(--c-gold)]"
                    />
                    {option === "earlier" ? "The first occurrence" : "The second occurrence"}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {candidate.utcOffset} {candidate.abbreviation} · {candidate.isDst ? "daylight" : "standard"} time
                  </span>
                  <span className="font-mono text-[11px] text-faint">{candidate.utc.replace("T", " ").replace(".000Z", " UTC")}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {response.ok && !response.ambiguous && response.warnings.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-warn">
          {response.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
          <Globe2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
          Rahu and Ketu
        </legend>
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["mean", "Mean node", "KP default"],
              ["true", "True node", "osculating"],
            ] as const
          ).map(([value, label, note]) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                nodeType === value ? "border-gold bg-gold/10 text-bone" : "border-hairline text-muted hover:border-line",
              )}
            >
              <input
                type="radio"
                name="nodeType"
                value={value}
                checked={nodeType === value}
                onChange={() => setNodeType(value)}
                className="accent-[var(--c-gold)]"
              />
              {label}
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{note}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label
        className={cn(
          "flex items-start gap-3 rounded-lg border p-5 transition-colors",
          moment ? "cursor-pointer" : "cursor-not-allowed opacity-60",
          confirmed ? "border-gold/50 bg-gold/5" : "border-hairline",
        )}
      >
        <input
          type="checkbox"
          checked={confirmed}
          disabled={!moment}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-gold)]"
        />
        <span className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-sm text-bone">
            {confirmed ? <CircleCheck aria-hidden="true" className="h-4 w-4 text-gold" strokeWidth={1.5} /> : null}
            I confirm this birth moment, to the second, in this time zone
          </span>
          <span className="text-xs leading-relaxed text-faint">
            A KP cusp moves about 15″ of arc per second of clock time; the cuspal sub lord can change with a
            few seconds of error. Use the time from the birth record, not a rounded memory.
          </span>
        </span>
      </label>
    </div>
  );
}
