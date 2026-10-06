"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  GRAHA_LABEL,
  NAKSHATRAS,
  NAKSHATRA_ARC,
  RASIS,
  type Graha,
} from "@/lib/kp/constants";
import { formatRasiDegree } from "@/lib/kp/lords";
import type { KpChartView, KpPeriodView } from "@/lib/kp/view";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────────
 * Geometry
 * ──────────────────────────────────────────────────────────────────────────── */

const SIZE = 640;
const C = SIZE / 2;
const R_OUTER = 304;
const R_NAKSHATRA = 280;
const R_RASI = 240;
const R_PLANET = 206;
const R_HOUSE_INNER = 128;
const R_CORE = 64;

type Selection = { kind: "graha"; graha: Graha } | { kind: "cusp"; house: number } | null;

/** Screen point for a sidereal longitude, with the Ascendant at 9 o'clock and the zodiac running counter-clockwise. */
function point(longitude: number, ascendant: number, radius: number) {
  const angle = ((180 + longitude - ascendant) * Math.PI) / 180;
  return { x: C + radius * Math.cos(angle), y: C - radius * Math.sin(angle) };
}

function arcPath(start: number, end: number, ascendant: number, rOuter: number, rInner: number) {
  const span = (((end - start) % 360) + 360) % 360;
  const large = span > 180 ? 1 : 0;
  const a = point(start, ascendant, rOuter);
  const b = point(end, ascendant, rOuter);
  const c = point(end, ascendant, rInner);
  const d = point(start, ascendant, rInner);
  // Counter-clockwise on screen = sweep-flag 0.
  return `M${a.x},${a.y} A${rOuter},${rOuter} 0 ${large} 0 ${b.x},${b.y} L${c.x},${c.y} A${rInner},${rInner} 0 ${large} 1 ${d.x},${d.y} Z`;
}

/**
 * Place graha badges without collisions: crowded grahas (within `crowd`
 * degrees of a neighbour) alternate between two radial tiers and are nudged
 * apart angularly just enough to stay legible. The tick on the rasi ring
 * always marks the true longitude.
 */
function spread(planets: KpChartView["planets"], crowd = 9, minGap = 5) {
  const sorted = [...planets].sort((a, b) => a.longitude - b.longitude);
  const placed = sorted.map((p) => ({ graha: p.graha, longitude: p.longitude, display: p.longitude, tier: 0 }));
  // Tiers: alternate inside each run of crowded neighbours.
  for (let i = 1; i < placed.length; i += 1) {
    const gap = placed[i].longitude - placed[i - 1].longitude;
    placed[i].tier = gap < crowd ? 1 - placed[i - 1].tier : 0;
  }
  // Angular nudge between badges that share a tier.
  for (let pass = 0; pass < 6; pass += 1) {
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        if (placed[i].tier !== placed[j].tier) continue;
        const gap = (((placed[j].display - placed[i].display) % 360) + 360) % 360;
        const distance = Math.min(gap, 360 - gap);
        if (distance < minGap * 1.6) {
          const push = (minGap * 1.6 - distance) / 2;
          const forward = gap <= 180;
          placed[i].display -= forward ? push : -push;
          placed[j].display += forward ? push : -push;
        }
      }
    }
  }
  return placed;
}

const short = (g: Graha) => GRAHA_LABEL[g].short;
const name = (g: Graha) => GRAHA_LABEL[g].english;

function stability(seconds: number | null): { label: string; tone: "ok" | "warn" | "danger" } {
  if (seconds === null || seconds > 3600) return { label: "stable", tone: "ok" };
  if (seconds >= 60) return { label: `±${Math.round(seconds / 60)} min`, tone: "ok" };
  if (seconds >= 10) return { label: `±${Math.round(seconds)} s`, tone: "warn" };
  return { label: `±${Math.max(1, Math.round(seconds))} s`, tone: "danger" };
}

const TONE_CLASS = { ok: "text-faint", warn: "text-warn", danger: "text-danger" } as const;

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso),
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Wheel
 * ──────────────────────────────────────────────────────────────────────────── */

function KpWheel({
  chart,
  selection,
  onSelect,
}: {
  chart: KpChartView;
  selection: Selection;
  onSelect: (selection: Selection) => void;
}) {
  const reduced = useReducedMotion();
  const asc = chart.cusps[0].longitude;
  const placed = useMemo(() => spread(chart.planets), [chart.planets]);
  const planetBy = useMemo(() => new Map(chart.planets.map((p) => [p.graha, p])), [chart.planets]);

  const isGraha = (g: Graha) => selection?.kind === "graha" && selection.graha === g;
  const isCusp = (h: number) => selection?.kind === "cusp" && selection.house === h;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="h-auto w-full select-none"
      role="group"
      aria-label="KP sidereal chart wheel. Ascendant at left; select a graha or cusp for its lords."
    >
      <defs>
        <radialGradient id="kp-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--c-gold)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--c-gold)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Nakshatra ring: 27 segments labelled with their Vimshottari lord. */}
      {NAKSHATRAS.map((n, i) => {
        const start = i * NAKSHATRA_ARC;
        const mid = point(start + NAKSHATRA_ARC / 2, asc, (R_OUTER + R_NAKSHATRA) / 2);
        return (
          <g key={n.name}>
            <path
              d={arcPath(start, start + NAKSHATRA_ARC, asc, R_OUTER, R_NAKSHATRA)}
              className={cn("stroke-hairline", i % 2 === 0 ? "fill-raised/40" : "fill-transparent")}
              strokeWidth={0.75}
            >
              <title>{`${n.name} — star lord ${name(n.lord)}`}</title>
            </path>
            <text x={mid.x} y={mid.y} dy="0.35em" textAnchor="middle" className="fill-faint font-mono text-[9px]">
              {short(n.lord)}
            </text>
          </g>
        );
      })}

      {/* Rasi ring. */}
      {RASIS.map((r, i) => {
        const start = i * 30;
        const mid = point(start + 15, asc, (R_NAKSHATRA + R_RASI) / 2);
        return (
          <g key={r.sanskrit}>
            <path
              d={arcPath(start, start + 30, asc, R_NAKSHATRA, R_RASI)}
              className="fill-transparent stroke-hairline"
              strokeWidth={1}
            >
              <title>{`${r.sanskrit} (${r.english}) — lord ${name(r.lord)}`}</title>
            </path>
            <text x={mid.x} y={mid.y} dy="0.35em" textAnchor="middle" className="fill-muted font-mono text-[10px] uppercase tracking-[0.12em]">
              {r.sanskrit.slice(0, 4)}
            </text>
          </g>
        );
      })}

      <circle cx={C} cy={C} r={R_HOUSE_INNER} className="fill-transparent stroke-hairline" strokeWidth={1} />
      <circle cx={C} cy={C} r={R_CORE} fill="url(#kp-core)" />

      {/* Placidus cusps (unequal houses). */}
      {chart.cusps.map((cusp, i) => {
        const outer = point(cusp.longitude, asc, R_RASI);
        const inner = point(cusp.longitude, asc, R_CORE);
        const next = chart.cusps[(i + 1) % 12].longitude;
        const span = (((next - cusp.longitude) % 360) + 360) % 360;
        const label = point(cusp.longitude + span / 2, asc, (R_HOUSE_INNER + R_CORE) / 2 + 6);
        const angular = cusp.house === 1 || cusp.house === 4 || cusp.house === 7 || cusp.house === 10;
        const active = isCusp(cusp.house);
        return (
          <g
            key={cusp.house}
            role="button"
            tabIndex={0}
            aria-pressed={active}
            aria-label={`Cusp ${cusp.house}: ${formatRasiDegree(cusp.longitude)} ${cusp.rasi.sanskrit}, sub lord ${name(cusp.subLord)}`}
            onClick={() => onSelect(active ? null : { kind: "cusp", house: cusp.house })}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(active ? null : { kind: "cusp", house: cusp.house });
              }
            }}
            className="cursor-pointer outline-none [&:focus-visible>line]:stroke-gold"
          >
            <line
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              className={cn(active ? "stroke-gold" : angular ? "stroke-bone/70" : "stroke-hairline")}
              strokeWidth={active ? 2 : angular ? 1.4 : 1}
            />
            {/* A wider invisible hit area. */}
            <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="transparent" strokeWidth={12} />
            <text x={label.x} y={label.y} dy="0.35em" textAnchor="middle" className={cn("font-mono text-[11px]", active ? "fill-gold" : "fill-faint")}>
              {cusp.house}
            </text>
          </g>
        );
      })}

      {/* Grahas. */}
      {placed.map((entry, index) => {
        const p = planetBy.get(entry.graha);
        if (!p) return null;
        const tick = point(p.longitude, asc, R_RASI);
        const tickIn = point(p.longitude, asc, R_RASI - 10);
        const radius = entry.tier === 0 ? R_PLANET : R_PLANET - 36;
        const at = point(entry.display, asc, radius);
        const degree = point(entry.display, asc, entry.tier === 0 ? radius + 23 : radius - 24);
        const active = isGraha(p.graha);
        return (
          <motion.g
            key={p.graha}
            initial={reduced ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : 0.04 * index, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: `${at.x}px ${at.y}px` }}
            role="button"
            tabIndex={0}
            aria-pressed={active}
            aria-label={`${name(p.graha)}${p.retrograde ? " retrograde" : ""}: ${formatRasiDegree(p.longitude)} ${p.rasi.sanskrit}, ${p.nakshatra.name}, sub lord ${name(p.subLord)}`}
            onClick={() => onSelect(active ? null : { kind: "graha", graha: p.graha })}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(active ? null : { kind: "graha", graha: p.graha });
              }
            }}
            className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-gold"
          >
            <line x1={tick.x} y1={tick.y} x2={tickIn.x} y2={tickIn.y} className="stroke-gold/70" strokeWidth={1.5} />
            <circle
              cx={at.x}
              cy={at.y}
              r={15}
              className={cn(active ? "fill-gold/20 stroke-gold" : "fill-void stroke-hairline")}
              strokeWidth={1.2}
            />
            <text x={at.x} y={at.y} dy="0.35em" textAnchor="middle" className={cn("font-mono text-[11px]", active ? "fill-gold" : "fill-bone")}>
              {short(p.graha)}
              {p.retrograde && p.graha !== "rahu" && p.graha !== "ketu" ? (
                <tspan className="fill-warn text-[8px]" dx="1" dy="-4">R</tspan>
              ) : null}
            </text>
            <text x={degree.x} y={degree.y} dy="0.35em" textAnchor="middle" className="fill-faint font-mono text-[9px] tabular-nums">
              {Math.floor(p.rasiDegree)}°
            </text>
          </motion.g>
        );
      })}

      <text x={C} y={C - 6} textAnchor="middle" className="fill-gold font-mono text-[9px] uppercase tracking-[0.24em]">
        KP · Sidereal
      </text>
      <text x={C} y={C + 10} textAnchor="middle" className="fill-faint font-mono text-[9px] tabular-nums">
        {chart.system.ayanamsa.formatted}
      </text>
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Tables
 * ──────────────────────────────────────────────────────────────────────────── */

const TH = "px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-faint";
const TD = "whitespace-nowrap px-3 py-2.5 font-mono text-xs tabular-nums";

function LordCell({ graha, emphasis = false }: { graha: Graha; emphasis?: boolean }) {
  return (
    <td className={cn(TD, emphasis ? "text-gold" : "text-muted")} title={GRAHA_LABEL[graha].sanskrit}>
      {name(graha)}
    </td>
  );
}

function PlanetTable({ chart, selection, onSelect }: { chart: KpChartView; selection: Selection; onSelect: (s: Selection) => void }) {
  return (
    <div className="surface overflow-x-auto rounded-lg">
      <table className="w-full min-w-[46rem] border-collapse text-left">
        <caption className="sr-only">KP graha positions with sign, star, sub and sub-sub lords.</caption>
        <thead>
          <tr className="border-b border-hairline">
            {["Graha", "Position", "Nakshatra", "Sign lord", "Star lord", "Sub lord", "Sub-sub", "House", "Sub holds"].map((h) => (
              <th key={h} scope="col" className={TH}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.planets.map((p) => {
            const active = selection?.kind === "graha" && selection.graha === p.graha;
            const s = stability(p.subStableSeconds);
            return (
              <tr
                key={p.graha}
                onClick={() => onSelect(active ? null : { kind: "graha", graha: p.graha })}
                className={cn("cursor-pointer border-b border-hairline/70 last:border-b-0 transition-colors", active ? "bg-gold/10" : "hover:bg-raised/60")}
              >
                <th scope="row" className="whitespace-nowrap px-3 py-2.5 text-left text-sm font-normal text-bone">
                  {name(p.graha)}
                  <span className="ml-1.5 font-mono text-[10px] text-faint">{GRAHA_LABEL[p.graha].sanskrit}</span>
                  {p.retrograde && p.graha !== "rahu" && p.graha !== "ketu" ? (
                    <span className="ml-1.5 font-mono text-[10px] text-warn" title="Retrograde">R</span>
                  ) : null}
                </th>
                <td className={cn(TD, "text-code")}>
                  {formatRasiDegree(p.longitude)} {p.rasi.sanskrit}
                </td>
                <td className={cn(TD, "text-muted")}>
                  {p.nakshatra.name} · {p.pada}
                </td>
                <LordCell graha={p.signLord} />
                <LordCell graha={p.starLord} />
                <LordCell graha={p.subLord} emphasis />
                <LordCell graha={p.subSubLord} />
                <td className={cn(TD, "text-muted")}>{p.house}</td>
                <td className={cn(TD, TONE_CLASS[s.tone])}>{s.label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CuspTable({ chart, selection, onSelect }: { chart: KpChartView; selection: Selection; onSelect: (s: Selection) => void }) {
  return (
    <div className="surface overflow-x-auto rounded-lg">
      <table className="w-full min-w-[42rem] border-collapse text-left">
        <caption className="sr-only">KP Placidus cusps with sign, star, sub and sub-sub lords.</caption>
        <thead>
          <tr className="border-b border-hairline">
            {["Cusp", "Position", "Nakshatra", "Sign lord", "Star lord", "Sub lord", "Sub-sub", "Sub holds"].map((h) => (
              <th key={h} scope="col" className={TH}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.cusps.map((c) => {
            const active = selection?.kind === "cusp" && selection.house === c.house;
            const s = stability(c.subStableSeconds);
            return (
              <tr
                key={c.house}
                onClick={() => onSelect(active ? null : { kind: "cusp", house: c.house })}
                className={cn("cursor-pointer border-b border-hairline/70 last:border-b-0 transition-colors", active ? "bg-gold/10" : "hover:bg-raised/60")}
              >
                <th scope="row" className="px-3 py-2.5 text-left font-mono text-xs font-normal text-bone">
                  {c.house === 1 ? "1 · Lagna" : c.house === 10 ? "10 · MC" : c.house}
                </th>
                <td className={cn(TD, "text-code")}>
                  {formatRasiDegree(c.longitude)} {c.rasi.sanskrit}
                </td>
                <td className={cn(TD, "text-muted")}>{c.nakshatra.name}</td>
                <LordCell graha={c.signLord} />
                <LordCell graha={c.starLord} />
                <LordCell graha={c.subLord} emphasis />
                <LordCell graha={c.subSubLord} />
                <td className={cn(TD, TONE_CLASS[s.tone])}>{s.label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SignificatorTable({ chart, selection }: { chart: KpChartView; selection: Selection }) {
  const highlight = (g: Graha) => selection?.kind === "graha" && selection.graha === g;
  const focusHouse = selection?.kind === "cusp" ? selection.house : null;
  return (
    <div className="surface overflow-x-auto rounded-lg">
      <table className="w-full min-w-[40rem] border-collapse text-left">
        <caption className="sr-only">KP house significators by level, strongest first.</caption>
        <thead>
          <tr className="border-b border-hairline">
            <th scope="col" className={TH}>House</th>
            <th scope="col" className={TH} title="Planets in the star of the occupants">A · In occupants&apos; star</th>
            <th scope="col" className={TH}>B · Occupants</th>
            <th scope="col" className={TH} title="Planets in the star of the house lord">C · In lord&apos;s star</th>
            <th scope="col" className={TH}>D · Lord</th>
          </tr>
        </thead>
        <tbody>
          {chart.houses.map((h) => (
            <tr key={h.house} className={cn("border-b border-hairline/70 last:border-b-0", focusHouse === h.house && "bg-gold/10")}>
              <th scope="row" className="px-3 py-2.5 text-left font-mono text-xs font-normal text-bone">{h.house}</th>
              {(["A", "B", "C", "D"] as const).map((level) => (
                <td key={level} className={cn(TD, "text-muted")}>
                  {h.levels[level].length === 0 ? (
                    <span className="text-faint">—</span>
                  ) : (
                    h.levels[level].map((g, i) => (
                      <span key={g} className={cn(highlight(g) && "text-gold")}>
                        {i > 0 ? ", " : ""}
                        {short(g)}
                      </span>
                    ))
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailPanel({ chart, selection }: { chart: KpChartView; selection: Selection }) {
  if (!selection) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        Select a graha or a cusp on the wheel or in the tables to read its full lordship chain and
        what it signifies.
      </p>
    );
  }
  if (selection.kind === "graha") {
    const p = chart.planets.find((x) => x.graha === selection.graha);
    const sig = chart.planetHouses.find((x) => x.graha === selection.graha);
    if (!p) return null;
    return (
      <div className="flex flex-col gap-3">
        <p className="font-display text-xl text-bone">
          {name(p.graha)} <span className="text-base text-faint">{GRAHA_LABEL[p.graha].sanskrit}</span>
        </p>
        <p className="font-mono text-xs text-code">
          {formatRasiDegree(p.longitude)} {p.rasi.sanskrit} · {p.nakshatra.name} pada {p.pada} · house {p.house}
          {p.retrograde && p.graha !== "rahu" && p.graha !== "ketu" ? " · retrograde" : ""}
        </p>
        <p className="text-sm text-muted">
          Lordship chain: <span className="text-bone">{name(p.signLord)}</span> →{" "}
          <span className="text-bone">{name(p.starLord)}</span> → <span className="text-gold">{name(p.subLord)}</span> →{" "}
          <span className="text-bone">{name(p.subSubLord)}</span>
        </p>
        <p className="text-sm text-muted">
          Signifies houses <span className="font-mono text-bone">{sig?.houses.join(", ") || "—"}</span>
          {p.graha === "rahu" || p.graha === "ketu" ? " (including those of its sign lord, as agent)" : ""}.
        </p>
      </div>
    );
  }
  const c = chart.cusps.find((x) => x.house === selection.house);
  const h = chart.houses.find((x) => x.house === selection.house);
  if (!c || !h) return null;
  return (
    <div className="flex flex-col gap-3">
      <p className="font-display text-xl text-bone">Cusp {c.house}</p>
      <p className="font-mono text-xs text-code">
        {formatRasiDegree(c.longitude)} {c.rasi.sanskrit} ({c.rasi.english}) · {c.nakshatra.name}
      </p>
      <p className="text-sm text-muted">
        Lordship chain: <span className="text-bone">{name(c.signLord)}</span> →{" "}
        <span className="text-bone">{name(c.starLord)}</span> → <span className="text-gold">{name(c.subLord)}</span> →{" "}
        <span className="text-bone">{name(c.subSubLord)}</span>
      </p>
      <p className="text-sm text-muted">
        The cuspal sub lord ({name(c.subLord)}) decides whether this house&apos;s matters fructify.
        Significators, strongest first:{" "}
        <span className="font-mono text-bone">
          {(["A", "B", "C", "D"] as const).map((l) => `${l}: ${h.levels[l].map(short).join(" ") || "—"}`).join(" · ")}
        </span>
      </p>
    </div>
  );
}

function Dasha({ chart }: { chart: KpChartView }) {
  const [open, setOpen] = useState<string | null>(chart.current[0]?.start ?? null);
  const running = new Set(chart.current.map((p) => `${p.lord}:${p.start}`));
  const row = (p: KpPeriodView, depth: number) => {
    const isRunning = running.has(`${p.lord}:${p.start}`);
    return (
      <span className={cn("flex items-baseline justify-between gap-4", isRunning && "text-gold")}>
        <span className={cn(depth === 0 ? "text-sm text-bone" : "text-xs text-muted", isRunning && "text-gold")}>
          {name(p.lord)}
          {isRunning ? <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.16em]">running</span> : null}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-faint">
          {formatDate(p.start)} – {formatDate(p.end)}
        </span>
      </span>
    );
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Born in <span className="text-bone">{name(chart.dasha.birthLord)}</span> mahadasha with{" "}
        <span className="font-mono text-bone">{chart.dasha.balanceYears.toFixed(2)}</span> years remaining. Now running:{" "}
        <span className="text-gold">{chart.current.map((p) => name(p.lord)).join(" › ") || "—"}</span>.
      </p>
      <ul className="surface m-0 list-none divide-y divide-hairline/70 rounded-lg p-0">
        {chart.dasha.mahadashas.map((maha) => (
          <li key={maha.start}>
            <button
              type="button"
              aria-expanded={open === maha.start}
              onClick={() => setOpen(open === maha.start ? null : maha.start)}
              className="w-full px-4 py-3 text-left transition-colors hover:bg-raised/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              {row(maha, 0)}
            </button>
            {open === maha.start && maha.children ? (
              <ul className="m-0 list-none space-y-1.5 px-6 pb-4 pt-1">
                {maha.children.map((bhukti) => (
                  <li key={bhukti.start}>{row(bhukti, 1)}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
        Vimshottari · year = {chart.dasha.yearDays} days · bhuktis in proportion
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Composite
 * ──────────────────────────────────────────────────────────────────────────── */

function Heading({ id, children, note }: { id: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 id={id} className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
        {children}
      </h3>
      {note ? <p className="max-w-2xl text-sm leading-relaxed text-muted">{note}</p> : null}
    </div>
  );
}

/** The full KP chart: method badges, interactive wheel, lord tables, significators, ruling planets and dashas. */
export function KpChartPanel({ chart }: { chart: KpChartView }) {
  const [selection, setSelection] = useState<Selection>(null);
  const rp = chart.rulingPlanets;

  return (
    <div className="flex flex-col gap-10">
      <ul className="flex list-none flex-wrap gap-2 p-0" aria-label="Calculation method">
        {[
          "Krishnamurti Paddhati",
          "Sidereal zodiac",
          `KP ayanamsa ${chart.system.ayanamsa.formatted}`,
          "Placidus cusps",
          `${chart.system.nodeType === "mean" ? "Mean" : "True"} node`,
          chart.system.ephemeris,
        ].map((label) => (
          <li
            key={label}
            className="rounded-full border border-hairline px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted"
          >
            {label}
          </li>
        ))}
      </ul>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <div className="surface rounded-lg p-3 sm:p-5">
          <KpWheel chart={chart} selection={selection} onSelect={setSelection} />
        </div>
        <div className="flex flex-col gap-6">
          <div className="surface rounded-lg p-5" aria-live="polite">
            <DetailPanel chart={chart} selection={selection} />
          </div>
          <div className="surface rounded-lg p-5">
            <Heading id="kp-ruling">Ruling planets at birth</Heading>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {[
                ["Day lord", rp.dayLord],
                ["Lagna sign", rp.lagnaSignLord],
                ["Lagna star", rp.lagnaStarLord],
                ["Lagna sub", rp.lagnaSubLord],
                ["Moon sign", rp.moonSignLord],
                ["Moon star", rp.moonStarLord],
                ["Moon sub", rp.moonSubLord],
              ].map(([label, g]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-hairline/60 py-1">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{label}</dt>
                  <dd className="m-0 text-bone">{name(g as Graha)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-faint">
              Vedic day from local sunrise{rp.sunrise ? ` (${rp.sunrise.slice(11, 19)})` : ""}.
            </p>
          </div>
        </div>
      </div>

      <section aria-labelledby="kp-grahas" className="flex flex-col gap-4">
        <Heading id="kp-grahas" note="Sidereal positions with the full KP lordship chain. “Sub holds” is how far the birth time could be wrong before the sub lord changes.">
          Grahas
        </Heading>
        <PlanetTable chart={chart} selection={selection} onSelect={setSelection} />
      </section>

      <section aria-labelledby="kp-cusps" className="flex flex-col gap-4">
        <Heading id="kp-cusps" note="Placidus cusps in the sidereal zodiac. The cuspal sub lord is the deciding factor in KP; it is why the birth time must be exact to the second.">
          Cusps
        </Heading>
        <CuspTable chart={chart} selection={selection} onSelect={setSelection} />
      </section>

      <section aria-labelledby="kp-significators" className="flex flex-col gap-4">
        <Heading id="kp-significators" note="Four levels, strongest first. Rahu and Ketu also act as agents of their sign lords.">
          House significators
        </Heading>
        <SignificatorTable chart={chart} selection={selection} />
      </section>

      <section aria-labelledby="kp-dasha" className="flex flex-col gap-4">
        <Heading id="kp-dasha">Vimshottari dasha</Heading>
        <Dasha chart={chart} />
      </section>
    </div>
  );
}
