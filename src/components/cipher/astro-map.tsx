"use client";

import { useMemo, useState } from "react";
import { geoEqualEarth, geoGraticule10, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryObject } from "topojson-specification";
import landTopology from "world-atlas/land-110m.json";
import { BookmarkPlus, Crosshair, MapPin, Trash2 } from "lucide-react";
import { GRAHA_LABEL, type Graha } from "@/lib/kp/constants";
import type { AngleLine, CartoLine } from "@/lib/astrocartography/lines";
import type { RelocatedChart } from "@/lib/astrocartography/relocate";
import { formatRasiDegree } from "@/lib/kp/lords";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const WIDTH = 960;
const HEIGHT = 500;

const GRAHA_COLOR: Record<Graha, string> = {
  sun: "var(--c-gold)",
  moon: "var(--c-bone)",
  mars: "var(--c-rose)",
  mercury: "var(--c-teal)",
  jupiter: "var(--c-gold-hi)",
  venus: "var(--c-purple-hi)",
  saturn: "var(--c-muted)",
  rahu: "var(--c-purple)",
  ketu: "var(--c-faint)",
};

export const ANGLE_LABEL: Record<AngleLine, { short: string; long: string; meaning: string }> = {
  lagna: { short: "Lagna", long: "Lagna (rising)", meaning: "rises here — it would sit on your 1st cusp" },
  seventh: { short: "7th", long: "7th cusp (setting)", meaning: "sets here — it would sit on your 7th cusp" },
  tenth: { short: "10th", long: "10th cusp (culminating)", meaning: "culminates here — it would sit on your 10th cusp" },
  fourth: { short: "4th", long: "4th cusp (nadir)", meaning: "is at the nadir here — it would sit on your 4th cusp" },
};

const DASH: Record<AngleLine, string | undefined> = {
  lagna: undefined,
  tenth: undefined,
  seventh: "6 4",
  fourth: "2 4",
};

const GRAHAS: Graha[] = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"];
const ANGLES: AngleLine[] = ["lagna", "seventh", "tenth", "fourth"];

export interface MapPlace {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  note?: string | null;
}

function formatCoord(lat: number, lon: number) {
  return `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? "E" : "W"}`;
}

/**
 * Interactive astrocartography map.
 *
 * Every graha's four angle lines over an Equal Earth projection; toggle grahas
 * and line types, click a line or any point to see the relocated KP chart for
 * that place, and save places with a note.
 */
export function AstroMap({
  lines,
  code,
  birthPlace,
  initialSaved = [],
}: {
  lines: CartoLine[];
  /** Share code of the chart, for relocation and snapshots. */
  code: string;
  birthPlace: MapPlace;
  initialSaved?: MapPlace[];
}) {
  const [visibleGrahas, setVisibleGrahas] = useState<Set<Graha>>(new Set(GRAHAS));
  const [visibleAngles, setVisibleAngles] = useState<Set<AngleLine>>(new Set(ANGLES));
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [point, setPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [relocated, setRelocated] = useState<RelocatedChart | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<MapPlace[]>(initialSaved);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [manual, setManual] = useState({ lat: "", lon: "" });

  const projection = useMemo(() => geoEqualEarth().fitSize([WIDTH, HEIGHT], { type: "Sphere" }), []);
  const path = useMemo(() => geoPath(projection), [projection]);
  const land = useMemo(() => {
    const topology = landTopology as unknown as Topology<{ land: GeometryObject }>;
    return path(feature(topology, topology.objects.land)) ?? "";
  }, [path]);
  const graticule = useMemo(() => path(geoGraticule10()) ?? "", [path]);
  const sphere = useMemo(() => path({ type: "Sphere" }) ?? "", [path]);

  const drawn = useMemo(
    () =>
      lines.map((line) => ({
        key: `${line.graha}:${line.angle}`,
        line,
        d: path({ type: "MultiLineString", coordinates: line.segments }) ?? "",
      })),
    [lines, path],
  );

  async function inspect(latitude: number, longitude: number) {
    setPoint({ latitude, longitude });
    setStatus("loading");
    setError(null);
    setSaveMessage(null);
    try {
      const response = await fetch("/api/kp/relocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, latitude, longitude }),
      });
      const data = (await response.json()) as { ok: boolean; relocated?: RelocatedChart; error?: string };
      if (!response.ok || !data.ok || !data.relocated) {
        setRelocated(null);
        setError(data.error ?? "That place could not be read.");
        setStatus("error");
        return;
      }
      setRelocated(data.relocated);
      setStatus("idle");
    } catch {
      setError("We could not reach the server.");
      setStatus("error");
    }
  }

  function handleMapClick(event: React.MouseEvent<SVGSVGElement>) {
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    const inverted = projection.invert?.([x, y]);
    if (!inverted || !Number.isFinite(inverted[0]) || !Number.isFinite(inverted[1])) return;
    void inspect(Number(inverted[1].toFixed(4)), Number(inverted[0].toFixed(4)));
  }

  async function save() {
    if (!point) return;
    setSaveMessage(null);
    const response = await fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || formatCoord(point.latitude, point.longitude),
        latitude: point.latitude,
        longitude: point.longitude,
        note: note.trim() || undefined,
        code,
      }),
    }).catch(() => null);
    if (!response) return setSaveMessage("We could not reach the server.");
    if (response.status === 401) return setSaveMessage("Sign in to save places to your dashboard.");
    const data = (await response.json()) as { ok: boolean; location?: MapPlace; error?: string };
    if (!data.ok || !data.location) return setSaveMessage(data.error ?? "That place could not be saved.");
    setSaved((current) => [data.location as MapPlace, ...current]);
    setName("");
    setNote("");
    setSaveMessage("Saved to your places.");
  }

  async function remove(id: string) {
    const response = await fetch(`/api/locations?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    if (response?.ok) setSaved((current) => current.filter((place) => place.id !== id));
  }

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const marker = (place: { latitude: number; longitude: number }) => projection([place.longitude, place.latitude]);
  const birthXY = marker(birthPlace);
  const pointXY = point ? marker(point) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show grahas">
          {GRAHAS.map((graha) => {
            const on = visibleGrahas.has(graha);
            return (
              <button
                key={graha}
                type="button"
                aria-pressed={on}
                onClick={() => setVisibleGrahas((current) => toggle(current, graha))}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                  on ? "border-line text-bone" : "border-hairline text-faint opacity-60",
                )}
              >
                <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: GRAHA_COLOR[graha] }} />
                {GRAHA_LABEL[graha].english}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show line types">
          {ANGLES.map((angle) => {
            const on = visibleAngles.has(angle);
            return (
              <button
                key={angle}
                type="button"
                aria-pressed={on}
                onClick={() => setVisibleAngles((current) => toggle(current, angle))}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                  on ? "border-line text-bone" : "border-hairline text-faint opacity-60",
                )}
              >
                <svg aria-hidden="true" width="18" height="4">
                  <line x1="0" y1="2" x2="18" y2="2" stroke="currentColor" strokeWidth="2" strokeDasharray={DASH[angle]} />
                </svg>
                {ANGLE_LABEL[angle].long}
              </button>
            );
          })}
        </div>
      </div>

      {/* Map */}
      <div className="surface overflow-hidden rounded-lg">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full cursor-crosshair"
          role="img"
          aria-label="Astrocartography world map. Click anywhere to read the relocated KP chart for that place."
          onClick={handleMapClick}
        >
          <path d={sphere} className="fill-ink" />
          <path d={graticule} className="fill-none stroke-hairline" strokeWidth={0.5} />
          <path d={land} className="fill-raised stroke-line" strokeWidth={0.4} />
          {drawn.map(({ key, line, d }) => {
            if (!visibleGrahas.has(line.graha) || !visibleAngles.has(line.angle)) return null;
            const active = selectedLine === key;
            return (
              <g key={key}>
                <path
                  d={d}
                  fill="none"
                  stroke={GRAHA_COLOR[line.graha]}
                  strokeWidth={active ? 3 : 1.4}
                  strokeOpacity={selectedLine && !active ? 0.35 : 0.9}
                  strokeDasharray={DASH[line.angle]}
                />
                {/* Wide transparent hit area. */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={10}
                  className="cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedLine(active ? null : key);
                    handleMapClick(event as unknown as React.MouseEvent<SVGSVGElement>);
                  }}
                >
                  <title>{`${GRAHA_LABEL[line.graha].english} — ${ANGLE_LABEL[line.angle].long}`}</title>
                </path>
              </g>
            );
          })}
          {saved.map((place) => {
            const xy = marker(place);
            return xy ? (
              <g key={place.id ?? place.name} transform={`translate(${xy[0]},${xy[1]})`} pointerEvents="none">
                <circle r={4} className="fill-teal stroke-void" strokeWidth={1} />
              </g>
            ) : null;
          })}
          {birthXY ? (
            <g transform={`translate(${birthXY[0]},${birthXY[1]})`} pointerEvents="none">
              <circle r={6} className="fill-none stroke-gold" strokeWidth={1.5} />
              <circle r={2} className="fill-gold" />
            </g>
          ) : null}
          {pointXY ? (
            <g transform={`translate(${pointXY[0]},${pointXY[1]})`} pointerEvents="none">
              <circle r={7} className="fill-bone/20 stroke-bone" strokeWidth={1.5} />
            </g>
          ) : null}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-4 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full border border-gold" /> Birthplace</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-teal" /> Saved places</span>
        <span>Lines are astronomical (right ascension and declination), independent of any zodiac.</span>
      </div>

      {/* Keyboard-friendly alternative to clicking the map */}
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const lat = Number(manual.lat);
          const lon = Number(manual.lon);
          if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
            void inspect(lat, lon);
          } else {
            setError("Latitude −90…90 and longitude −180…180.");
            setStatus("error");
          }
        }}
      >
        <label className="flex flex-col gap-1 text-xs text-faint">
          Latitude
          <input value={manual.lat} onChange={(e) => setManual({ ...manual, lat: e.target.value })} inputMode="decimal" className="field w-32 px-0 py-1.5 font-mono text-sm text-bone" placeholder="51.5074" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-faint">
          Longitude
          <input value={manual.lon} onChange={(e) => setManual({ ...manual, lon: e.target.value })} inputMode="decimal" className="field w-32 px-0 py-1.5 font-mono text-sm text-bone" placeholder="-0.1278" />
        </label>
        <Button type="submit" variant="secondary" size="sm" iconLeft={<Crosshair className="h-3.5 w-3.5" strokeWidth={1.5} />}>
          Read this place
        </Button>
      </form>

      {/* Selected place */}
      <div className="surface rounded-lg p-5" aria-live="polite">
        {!point ? (
          <p className="text-sm text-muted">
            Click a line or anywhere on the map. You will see the KP chart relocated there — the same birth
            instant, new Placidus cusps and sub lords — and every line passing within 600 km.
          </p>
        ) : status === "loading" ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Spinner size="sm" label="Relocating" /> Raising the cusps for {formatCoord(point.latitude, point.longitude)}…
          </p>
        ) : status === "error" ? (
          <p role="alert" className="text-sm text-danger">{error}</p>
        ) : relocated ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-2 font-display text-lg text-bone">
                <MapPin aria-hidden="true" className="h-4 w-4 text-gold" strokeWidth={1.5} />
                {formatCoord(relocated.latitude, relocated.longitude)}
              </p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-xs">
                {[relocated.cusps[0], relocated.cusps[9]].map((cusp) => (
                  <div key={cusp.house} className="contents">
                    <dt className="text-faint">{cusp.house === 1 ? "Lagna" : "10th (MC)"}</dt>
                    <dd className="m-0 text-code">
                      {formatRasiDegree(cusp.longitude)} {cusp.rasi} · star {GRAHA_LABEL[cusp.starLord].short} · sub{" "}
                      <span className="text-gold">{GRAHA_LABEL[cusp.subLord].english}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted">
                Cuspal sub lords here:{" "}
                <span className="font-mono text-bone">
                  {relocated.cusps.map((c) => `${c.house}:${GRAHA_LABEL[c.subLord].short}`).join("  ")}
                </span>
              </p>
              <p className="text-xs text-muted">
                Houses:{" "}
                <span className="font-mono text-bone">
                  {relocated.houses.map((h) => `${GRAHA_LABEL[h.graha].short} ${h.house}`).join(" · ")}
                </span>
              </p>
              {relocated.nearby.length > 0 ? (
                <ul className="m-0 list-none space-y-1 p-0 text-sm text-muted">
                  {relocated.nearby.slice(0, 6).map((n) => (
                    <li key={`${n.graha}:${n.angle}`}>
                      <span style={{ color: GRAHA_COLOR[n.graha] }}>●</span>{" "}
                      <span className="text-bone">{GRAHA_LABEL[n.graha].english}</span> {ANGLE_LABEL[n.angle].meaning}{" "}
                      <span className="font-mono text-xs text-faint">({n.km} km)</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-faint">No planetary line passes within 600 km.</p>
              )}
            </div>

            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <label className="flex flex-col gap-1 text-xs text-faint">
                Name this place
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="field px-0 py-1.5 text-sm text-bone" placeholder="Lisbon" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-faint">
                Your insight
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} className="field resize-y px-0 py-1.5 text-sm text-bone" placeholder="Why this place matters to you." />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" variant="primary" size="sm" iconLeft={<BookmarkPlus className="h-3.5 w-3.5" strokeWidth={1.5} />}>
                  Save place
                </Button>
                {saveMessage ? <span className="text-xs text-muted">{saveMessage}</span> : null}
              </div>
            </form>
          </div>
        ) : null}
      </div>

      {saved.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">Your places</h3>
          <ul className="surface m-0 list-none divide-y divide-hairline/70 rounded-lg p-0">
            {saved.map((place) => (
              <li key={place.id ?? place.name} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => void inspect(place.latitude, place.longitude)}
                  className="flex flex-col items-start text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <span className="text-sm text-bone">{place.name}</span>
                  <span className="font-mono text-[11px] text-faint">{formatCoord(place.latitude, place.longitude)}</span>
                  {place.note ? <span className="mt-1 text-xs text-muted">{place.note}</span> : null}
                </button>
                {place.id ? (
                  <button
                    type="button"
                    aria-label={`Delete ${place.name}`}
                    onClick={() => void remove(place.id as string)}
                    className="rounded p-1 text-faint transition-colors hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
