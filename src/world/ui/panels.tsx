"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  CloudOff,
  Compass,
  ExternalLink,
  Hammer,
  MapPin,
  MessageCircle,
  Play,
  Radio,
  RotateCw,
  Send,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";

import {
  AVATAR_COLORS,
  AVATAR_CRESTS,
  AVATAR_FORMS,
  BUILD_MATERIALS,
  BUILD_PIECES,
  CENTRES,
  CODEX_TABS,
  CONTROLS,
  GRAHAS,
  LEARNING_TRACKS,
  NAKSHATRAS,
  PAVILIONS,
  PLACES,
  PLOTS,
  PLOT_PIECE_LIMIT,
  RASIS_META,
} from "../content/world";
import type { CodexTab } from "../content/world";
import { getStore, useRealm, type AvatarForm, type PlotState } from "../state";
import { send } from "../engine/bus";
import { cn } from "@/lib/utils";
import {
  Btn,
  Empty,
  Field,
  KeyCap,
  Panel,
  Section,
  Slider,
  Tabs,
  TextInput,
  Toggle,
} from "./common";
import { AvatarPreview, type Viewer } from "./Landing";

const CHAT_CHANNELS = [
  { id: "world", label: "The world" },
  ...PAVILIONS.map((pavilion) => ({ id: pavilion.slug, label: pavilion.name })),
];

export function Panels({ viewer }: { viewer: Viewer }) {
  const s = useRealm();
  const close = () => getStore().set({ panel: null, chatOpen: false });

  return (
    <>
      <AtlasPanel open={s.panel === "atlas"} onClose={close} viewer={viewer} />
      <ChatPanel open={s.panel === "chat"} onClose={close} />
      <CodexPanel open={s.panel === "codex"} onClose={close} />
      <ChartPanel open={s.panel === "chart"} onClose={close} />
      <LearnPanel open={s.panel === "learn"} onClose={close} viewer={viewer} />
      <BuildPanel open={s.panel === "build"} onClose={close} />
      <PlotsPanel open={s.panel === "plots"} onClose={close} />
      <AvatarPanel open={s.panel === "avatar"} onClose={close} />
      <SettingsPanel open={s.panel === "settings"} onClose={close} viewer={viewer} />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Atlas
 * ──────────────────────────────────────────────────────────────────────────── */

function AtlasPanel({ open, onClose, viewer }: { open: boolean; onClose: () => void; viewer: Viewer }) {
  const s = useRealm();
  const others = s.players.filter((player) => player.id !== s.selfId);

  return (
    <Panel
      open={open}
      onClose={onClose}
      kicker="The world, in one page"
      title="The Atlas"
      wide
      footer={
        <div className="world-panel-foot-row">
          <span className={cn("world-dot-label", s.connected ? "is-live" : "is-solo")}>
            <Radio aria-hidden="true" className="h-3 w-3" strokeWidth={1.8} />
            {s.connected ? `in the room · ${s.ping} ms` : s.solo ? "solo orbit" : "connecting"}
          </span>
          <div className="flex items-center gap-2">
            {!s.connected ? (
              <Btn size="sm" onClick={() => send({ type: "reconnect" })}>
                <CloudOff aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
                Reconnect
              </Btn>
            ) : null}
            <Link href="/dashboard/map" className="world-btn world-btn-ghost world-btn-sm">
              <MapPin aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
              The 2D map
            </Link>
            <Link href={viewer.twoDeeHref} className="world-btn world-btn-primary world-btn-sm">
              Exit to the site
              <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
            </Link>
          </div>
        </div>
      }
    >
      <div className="world-atlas-grid">
        <Section title="Travel" hint="Every place is a walk away; every place is also one click.">
          <ul className="world-place-list">
            {PLACES.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => {
                    send({ type: "travel", id: place.id });
                    onClose();
                  }}
                >
                  <span className="world-place-mark" style={{ background: place.css }} aria-hidden="true" />
                  <span className="min-w-0">
                    <strong>{place.name}</strong>
                    <span>{place.kicker}</span>
                  </span>
                  <span className="world-place-go">
                    {place.id === "space" ? "fly" : "walk"}
                    <ArrowUpRight aria-hidden="true" className="h-3 w-3" strokeWidth={1.8} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>

        <div className="world-atlas-side">
          <Section
            title={`Here now · ${s.playerCount}`}
            hint={s.connected ? "Bodies are simulated by their own clients." : "The room server is not connected."}
          >
            <ul className="world-member-list">
              <li>
                <span className="world-member-avatar" style={{ borderColor: s.identity.color }}>
                  {s.identity.crest}
                </span>
                <span className="min-w-0">
                  <strong>{s.identity.name}</strong>
                  <span>you · {s.regionTitle}</span>
                </span>
                <span className="world-member-tag">you</span>
              </li>
              {others.map((player) => (
                <li key={player.id}>
                  <span className="world-member-avatar" style={{ borderColor: player.color }}>
                    {player.crest}
                  </span>
                  <span className="min-w-0">
                    <strong>{player.name}</strong>
                    <span>{player.region || (player.mode === "fly" ? "flying" : "walking")}</span>
                  </span>
                  {player.plot !== null && player.plot !== undefined ? (
                    <span className="world-member-tag">terrace {player.plot + 1}</span>
                  ) : null}
                </li>
              ))}
              {others.length === 0 ? (
                <li className="world-member-empty">
                  <Users aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
                  The room is yours. Share the link to bring someone in.
                </li>
              ) : null}
            </ul>
          </Section>

          <Section title="The floor" hint="The Amphitheatre is where a member teaches the room.">
            {s.session ? (
              <div className="world-live-card">
                <p className="world-kicker">
                  <span className="world-live-dot" aria-hidden="true" />
                  live now
                </p>
                <p className="world-session-title">{s.session.title}</p>
                <p className="world-session-host">{s.session.host}</p>
                <Btn
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    send({ type: "teleport", x: -140, z: 22, label: "The Amphitheatre" });
                    onClose();
                  }}
                >
                  <Play aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Join on the floor
                </Btn>
              </div>
            ) : (
              <div className="world-quiet-card">
                <p>The floor is open.</p>
                <p>Walk to the Amphitheatre, or take it from the Learn panel.</p>
                <Btn size="sm" onClick={() => getStore().set({ panel: "learn" })}>
                  <BookOpen aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
                  Open Learn
                </Btn>
              </div>
            )}
          </Section>

          <Section title="Room" hint="The room name is the invitation; there are no accounts inside the world.">
            <div className="world-kv">
              <span>Room</span>
              <strong>{s.room}</strong>
            </div>
            <div className="world-kv">
              <span>Room server</span>
              <strong>{s.connected ? "connected" : s.solo ? "offline — exploring alone" : "connecting"}</strong>
            </div>
            <div className="world-kv">
              <span>Quality</span>
              <strong>{s.settings.quality}</strong>
            </div>
            <div className="world-kv">
              <span>Time</span>
              <strong>{s.settings.timeOfDay}</strong>
            </div>
            {s.serverNote ? <p className="world-server-note">{s.serverNote}</p> : null}
          </Section>
        </div>
      </div>
    </Panel>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Chat
 * ──────────────────────────────────────────────────────────────────────────── */

function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useRealm();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const channel = s.chatRoom || "world";
  const messages = s.chat.filter((message) => message.where === channel || (channel === "world" && message.where === "world"));

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [open, messages.length, channel]);

  function submit() {
    const clean = text.trim();
    if (!clean) return;
    if (!s.connected) {
      getStore().set({
        serverNote: "The room server is offline, so the message was not sent. Reconnect from the Atlas.",
      });
      return;
    }
    send({ type: "chat", text: clean, where: channel });
    setText("");
  }

  const pavilion = PAVILIONS.find((p) => p.slug === channel);

  return (
    <Panel
      open={open}
      onClose={onClose}
      kicker="The room, and the rooms inside it"
      title={channel === "world" ? "The world" : (pavilion?.name ?? "The world")}
      footer={
        <div className="world-chat-compose">
          <input
            className="world-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder={s.connected ? "Say something to the room…" : "The room server is offline…"}
            maxLength={400}
            aria-label="Message"
          />
          <Btn variant="primary" onClick={submit} disabled={!text.trim()}>
            <Send aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
            Send
          </Btn>
        </div>
      }
    >
      <div className="world-channel-tabs" role="tablist" aria-label="Conversation">
        {CHAT_CHANNELS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={channel === item.id}
            onClick={() => getStore().set({ chatRoom: item.id, unread: 0 })}
            className={cn("world-channel", channel === item.id && "is-active")}
          >
            {item.label}
            {item.id === "world" ? <span className="world-channel-badge">all</span> : null}
          </button>
        ))}
      </div>

      {pavilion ? <p className="world-channel-note">{pavilion.description}</p> : null}

      <div className="world-chat-log">
        {messages.length === 0 ? (
          <Empty title="Quiet for now">
            {channel === "world"
              ? "Messages here reach everyone in the world. Pavilion channels are for the room named on the tab."
              : "This pavilion's conversation is empty. The 2D room is still there, with its full history."}
          </Empty>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={cn("world-chat-line", `is-${message.kind}`)}>
              {message.kind === "system" ? (
                <p className="world-chat-system">{message.text}</p>
              ) : (
                <>
                  <div className="world-chat-meta">
                    <strong style={{ color: message.color }}>{message.from}</strong>
                    <time dateTime={new Date(message.at).toISOString()}>
                      {new Date(message.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </time>
                  </div>
                  <p>{message.text}</p>
                </>
              )}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <p className="world-panel-note">
        A pavilion channel is the world&apos;s edge of a Collective room. The full,
        persistent conversation stays on the 2D site.{" "}
        <Link href={`/dashboard/community/${channel === "world" ? "general" : channel}`}>
          Open the room in 2D
          <ArrowUpRight aria-hidden="true" className="inline h-3 w-3" strokeWidth={1.8} />
        </Link>
      </p>
    </Panel>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Codex
 * ──────────────────────────────────────────────────────────────────────────── */

function CodexPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useRealm();
  const tab = s.codexTab;
  const chartGrahas = s.chart?.grahas ?? [];

  return (
    <Panel open={open} onClose={onClose} kicker="The spine of the world" title="The Codex" wide>
      <Tabs
        tabs={CODEX_TABS}
        value={tab}
        onChange={(value) => getStore().set({ codexTab: value as CodexTab })}
        label="Codex sections"
      />

      {tab === "grahas" ? (
        <div className="world-codex-list">
          {GRAHAS.map((graha) => {
            const live = chartGrahas.find((g) => g.id === graha.id);
            const selected = s.chartFocus === graha.id;
            return (
              <article key={graha.id} className={cn("world-codex-card", selected && "is-focus")}>
                <div className="world-codex-glyph" style={{ color: graha.css }}>
                  {graha.glyph}
                </div>
                <div className="min-w-0">
                  <p className="world-codex-title">
                    {graha.name}
                    <span>{graha.sanskrit}</span>
                  </p>
                  {live ? (
                    <p className="world-codex-data">
                      {live.lon.toFixed(2)}° · {live.nakshatraName} · {live.rashiName}
                      {live.retrograde ? " ℞" : ""}
                    </p>
                  ) : (
                    <p className="world-codex-data">no chart cast yet</p>
                  )}
                  <p className="world-codex-note">{graha.note}</p>
                </div>
              </article>
            );
          })}
          <p className="world-panel-note">
            In KP a graha is read through its sign, star and sub lord. The stone in
            the world is a place to look at a longitude, not a promise about a life.
          </p>
        </div>
      ) : null}

      {tab === "nakshatras" ? (
        <>
          <p className="world-panel-note">
            Twenty-seven equal mansions of 13°20′, from 0° sidereal Aries. The
            marker in the Axis carries its number; the Sky Wheel carries its name.
          </p>
          <div className="world-nak-grid">
            {NAKSHATRAS.map((nakshatra, index) => {
              const occupied = chartGrahas.some((g) => g.nakshatraIndex === index);
              const selected = s.chartFocus === String(index);
              return (
                <div
                  key={nakshatra.name}
                  className={cn("world-nak-card", occupied && "is-occupied", selected && "is-focus")}
                >
                  <span className="world-nak-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="world-nak-name">{nakshatra.name}</span>
                  <span className="world-nak-lord" style={{ color: nakshatra.css }}>
                    {nakshatra.lord}
                  </span>
                  <span className="world-nak-span">
                    {((index * 360) / 27).toFixed(1)}°–{(((index + 1) * 360) / 27).toFixed(1)}°
                  </span>
                  {occupied ? <span className="world-nak-dot" aria-label="A graha is here" /> : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {tab === "centres" ? (
        <>
          <p className="world-panel-note">
            Nine centres, four motors, and a body that can be defined or open. The
            nine stelae around the Axis light for the centres defined in your
            bodygraph.
          </p>
          <div className="world-centre-grid">
            {CENTRES.map((centre) => {
              const defined = s.chart?.definedCentres.includes(centre.key) ?? false;
              const selected = s.chartFocus === centre.key;
              return (
                <article
                  key={centre.key}
                  className={cn("world-centre-card", defined && "is-defined", selected && "is-focus")}
                  style={{ borderColor: defined ? centre.css : undefined }}
                >
                  <div className="world-centre-head">
                    <span style={{ color: centre.css }}>{centre.short}</span>
                    <span className="world-centre-state">{defined ? "defined" : "open"}</span>
                  </div>
                  <p className="world-kicker">{centre.kind}</p>
                  <p className="world-codex-note">{centre.note}</p>
                  <p className="world-centre-bio">{centre.biology}</p>
                </article>
              );
            })}
          </div>
        </>
      ) : null}

      {tab === "places" ? (
        <div className="world-codex-list">
          {PLACES.map((place) => (
            <article key={place.id} className={cn("world-codex-card", s.region === place.id && "is-focus")}>
              <div className="world-codex-glyph" style={{ color: place.css }}>
                <MapPin aria-hidden="true" className="h-5 w-5" strokeWidth={1.4} />
              </div>
              <div className="min-w-0">
                <p className="world-codex-title">
                  {place.name}
                  <span>{place.kicker}</span>
                </p>
                <p className="world-codex-note">{place.blurb}</p>
                <button
                  type="button"
                  className="world-inline-link"
                  onClick={() => {
                    send({ type: "travel", id: place.id });
                    onClose();
                  }}
                >
                  {place.id === "space" ? "Fly there" : "Walk there"}
                  <ArrowUpRight aria-hidden="true" className="h-3 w-3" strokeWidth={1.8} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {tab === "controls" ? (
        <div className="world-controls-grid">
          {CONTROLS.map((control) => (
            <div key={control.keys} className="world-control-row">
              <span className="world-control-keys">
                {control.keys.split(" ").map((key) => (
                  <KeyCap key={key}>{key}</KeyCap>
                ))}
              </span>
              <span>{control.what}</span>
            </div>
          ))}
          <p className="world-panel-note">
            On a phone or tablet the controls appear automatically: a stick to move,
            drag anywhere to look, and buttons for jump, fly, use, signal, build and
            place.
          </p>
        </div>
      ) : null}
    </Panel>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Chart
 * ──────────────────────────────────────────────────────────────────────────── */

function ChartPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useRealm();
  const chart = s.chart;

  return (
    <Panel
      open={open}
      onClose={onClose}
      kicker="The Observatory"
      title="Your chart, above the floor"
      wide
      footer={
        <div className="world-panel-foot-row">
          <span className="world-panel-note">Astronomy is astronomy; the meaning is tradition.</span>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/chart" className="world-btn world-btn-ghost world-btn-sm">
              The full KP chart
              <ArrowUpRight aria-hidden="true" className="h-3 w-3" strokeWidth={1.8} />
            </Link>
            <Link href="/dashboard/map" className="world-btn world-btn-ghost world-btn-sm">
              The cosmic map
              <ArrowUpRight aria-hidden="true" className="h-3 w-3" strokeWidth={1.8} />
            </Link>
          </div>
        </div>
      }
    >
      {!chart ? (
        <Empty title="The Observatory is waiting for your coordinates">
          Add your birth date, the exact second and the place, and the astrolabe
          will hang your chart above the basin. The world still moves without it.{" "}
          <Link href="/onboarding">Enter your coordinates →</Link>
        </Empty>
      ) : (
        <div className="world-chart-grid">
          <div className="world-chart-visual">
            <NatalWheel chart={chart} />
            <div className="world-chart-meta">
              <p className="world-kicker">Cast for</p>
              <p>{chart.label}</p>
              <p className="world-chart-place">{chart.place}</p>
              {chart.lagnaName ? (
                <p className="world-chart-lagna">
                  Lagna <strong>{chart.lagnaName}</strong>
                </p>
              ) : null}
            </div>
          </div>

          <div className="world-chart-side">
            <Section title="The nine grahas" hint="Sidereal longitudes at the birth instant.">
              <table className="world-graha-table">
                <thead>
                  <tr>
                    <th scope="col">Graha</th>
                    <th scope="col">Longitude</th>
                    <th scope="col">Nakshatra</th>
                    <th scope="col">Rasi</th>
                  </tr>
                </thead>
                <tbody>
                  {chart.grahas.map((graha) => (
                    <tr key={graha.id}>
                      <th scope="row">
                        <span style={{ color: graha.css }}>{graha.glyph}</span> {graha.name}
                      </th>
                      <td>{graha.lon.toFixed(2)}°{graha.retrograde ? " ℞" : ""}</td>
                      <td>{graha.nakshatraName}</td>
                      <td>{graha.rashiName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="The bodygraph" hint="Nine centres, thirty-six channels, twenty-six activations.">
              <div className="world-bodygraph-summary">
                <div>
                  <span>Type</span>
                  <strong>{chart.bodygraphType ?? "—"}</strong>
                </div>
                <div>
                  <span>Authority</span>
                  <strong>{chart.bodygraphAuthority ?? "—"}</strong>
                </div>
                <div>
                  <span>Profile</span>
                  <strong>{chart.bodygraphProfile ?? "—"}</strong>
                </div>
                <div>
                  <span>Channels</span>
                  <strong>{chart.bodygraphChannels ?? 0}</strong>
                </div>
              </div>
              <div className="world-centre-chips">
                {CENTRES.map((centre) => {
                  const defined = chart.definedCentres.includes(centre.key);
                  return (
                    <span
                      key={centre.key}
                      className={cn("world-centre-chip", defined && "is-defined")}
                      style={{ borderColor: defined ? centre.css : undefined, color: defined ? centre.css : undefined }}
                    >
                      {centre.short}
                    </span>
                  );
                })}
              </div>
              <p className="world-panel-note">
                {chart.definedCentres.length
                  ? `${chart.definedCentres.length} centres defined. The lit stelae around the Axis are the same set.`
                  : "No centres defined in the stored bodygraph."}
              </p>
            </Section>
          </div>
        </div>
      )}
    </Panel>
  );
}

function NatalWheel({ chart }: { chart: NonNullable<ReturnType<typeof useRealm>["chart"]> }) {
  const size = 340;
  const centre = size / 2;
  const outer = 150;
  const inner = 118;
  function point(longitude: number, radius: number) {
    const a = ((longitude - 90) * Math.PI) / 180;
    return { x: centre + Math.cos(a) * radius, y: centre + Math.sin(a) * radius };
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="world-natal-wheel" role="img" aria-label="Natal chart wheel">
      <circle cx={centre} cy={centre} r={outer} fill="none" stroke="rgba(212,255,63,0.35)" strokeWidth="1" />
      <circle cx={centre} cy={centre} r={inner} fill="none" stroke="rgba(92,225,230,0.22)" strokeWidth="0.7" />
      <circle cx={centre} cy={centre} r={outer - 10} fill="none" stroke="rgba(212,255,63,0.14)" strokeWidth="0.5" />
      {RASIS_META.map((rasi, index) => {
        const start = point(index * 30, inner);
        const end = point(index * 30, outer);
        const label = point(index * 30 + 15, (inner + outer) / 2);
        return (
          <g key={rasi.index}>
            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="rgba(244,241,255,0.12)" strokeWidth="0.7" />
            <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="rgba(244,241,255,0.42)">
              {rasi.name.slice(0, 3)}
            </text>
          </g>
        );
      })}
      {NAKSHATRAS.filter((_, index) => index % 3 === 0).map((nakshatra, index) => {
        const p = point(index * 40, outer - 4);
        return <circle key={nakshatra.name} cx={p.x} cy={p.y} r="1.4" fill="rgba(92,225,230,0.55)" />;
      })}
      {chart.grahas.map((graha) => {
        const p = point(graha.lon, inner - 14);
        return (
          <g key={graha.id}>
            <line x1={centre} y1={centre} x2={p.x} y2={p.y} stroke={graha.css} strokeOpacity="0.14" strokeWidth="0.6" />
            <circle cx={p.x} cy={p.y} r="2" fill={graha.css} />
            <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize="13" fill={graha.css}>
              {graha.glyph}
            </text>
          </g>
        );
      })}
      {chart.lagna !== null ? (
        <g>
          <line
            x1={point(chart.lagna, inner - 26).x}
            y1={point(chart.lagna, inner - 26).y}
            x2={point(chart.lagna, outer + 4).x}
            y2={point(chart.lagna, outer + 4).y}
            stroke="#d4ff3f"
            strokeWidth="1.4"
          />
          <text
            x={point(chart.lagna, outer + 14).x}
            y={point(chart.lagna, outer + 14).y}
            textAnchor="middle"
            fontSize="8"
            fill="#d4ff3f"
          >
            ASC
          </text>
        </g>
      ) : null}
      <circle cx={centre} cy={centre} r="3" fill="#d4ff3f" />
      <circle cx={centre} cy={centre} r="30" fill="none" stroke="rgba(212,255,63,0.16)" strokeWidth="0.6" />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Learn
 * ──────────────────────────────────────────────────────────────────────────── */

function LearnPanel({ open, onClose, viewer }: { open: boolean; onClose: () => void; viewer: Viewer }) {
  const s = useRealm();
  const [title, setTitle] = useState("");
  const [track, setTrack] = useState<string | null>(null);
  const active = LEARNING_TRACKS.find((item) => item.id === track);

  return (
    <Panel
      open={open}
      onClose={onClose}
      kicker="The Amphitheatre"
      title="Learn, and teach the room"
      wide
      footer={
        <div className="world-panel-foot-row">
          <span className="world-panel-note">
            The world gives you somewhere to stand. The courses, the flashcards and
            the full lessons stay on the 2D site.
          </span>
          <Link href={viewer.chartHref} className="world-btn world-btn-ghost world-btn-sm">
            Your 2D learning
            <ArrowUpRight aria-hidden="true" className="h-3 w-3" strokeWidth={1.8} />
          </Link>
        </div>
      }
    >
      <Section title="The floor" hint="A live session is visible to everyone in the world.">
        {s.session ? (
          <div className="world-live-card is-wide">
            <div>
              <p className="world-kicker">
                <span className="world-live-dot" aria-hidden="true" />
                live now · {s.session.host}
              </p>
              <p className="world-session-title">{s.session.title}</p>
              <p className="world-session-host">
                {s.selfId && s.session.hostId === s.selfId
                  ? "You are holding the floor."
                  : "Walk to the Amphitheatre, or join from here."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Btn
                size="sm"
                variant="primary"
                onClick={() => {
                  send({ type: "teleport", x: -140, z: 22, label: "The Amphitheatre" });
                  onClose();
                }}
              >
                <Play aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
                Join on the floor
              </Btn>
              {s.selfId && s.session.hostId === s.selfId ? (
                <Btn size="sm" variant="danger" onClick={() => send({ type: "session-end" })}>
                  End the session
                </Btn>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="world-session-start">
            <div>
              <p className="world-codex-title">Take the floor</p>
              <p className="world-codex-note">
                Give the room a title. Everyone here sees it, and can walk over or
                join in one click. Five minutes on one thing you actually learned is
                enough.
              </p>
            </div>
            <div className="world-session-form">
              <TextInput
                value={title}
                onChange={setTitle}
                placeholder="What are you teaching?"
                maxLength={80}
                ariaLabel="Session title"
              />
              <Btn
                variant="primary"
                size="sm"
                disabled={!title.trim() || !s.connected}
                onClick={() => {
                  send({ type: "session-start", title });
                  setTitle("");
                }}
              >
                <Radio aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
                Go live
              </Btn>
            </div>
            {!s.connected ? (
              <p className="world-panel-note">
                A live session needs the room server. You can still open a track and
                walk to its place.
              </p>
            ) : null}
          </div>
        )}
      </Section>

      <Section title="Six doors in" hint="Each track points at the full material on the 2D site.">
        <div className="world-learn-grid">
          {LEARNING_TRACKS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn("world-learn-card", active?.id === item.id && "is-active")}
              onClick={() => setTrack(active?.id === item.id ? null : item.id)}
              style={{ borderColor: active?.id === item.id ? item.css : undefined }}
            >
              <span className="world-learn-kicker" style={{ color: item.css }}>
                {item.kicker} · {item.minutes} min
              </span>
              <strong>{item.title}</strong>
              <span className="world-learn-blurb">{item.blurb}</span>
            </button>
          ))}
        </div>
      </Section>

      {active ? (
        <Section title={active.title} hint={`${active.kicker} · ${active.minutes} minutes`}>
          <div className="world-track-detail" style={{ borderColor: active.css }}>
            <ul>
              {active.bullets.map((bullet) => (
                <li key={bullet}>
                  <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} style={{ color: active.css }} />
                  {bullet}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Btn
                size="sm"
                onClick={() => {
                  send({ type: "travel", id: active.place });
                  onClose();
                }}
              >
                <MapPin aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
                Go to the place
              </Btn>
              <Link href={active.href} className="world-btn world-btn-primary world-btn-sm">
                Open the track
                <ExternalLink aria-hidden="true" className="h-3 w-3" strokeWidth={1.8} />
              </Link>
            </div>
          </div>
        </Section>
      ) : null}

      <p className="world-panel-note">
        Members teach members here. Nothing in the world is a substitute for a
        teacher, a text, or the member&apos;s own experiment.
      </p>
    </Panel>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Build
 * ──────────────────────────────────────────────────────────────────────────── */

function BuildPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useRealm();
  const piece = BUILD_PIECES.find((item) => item.id === s.buildPiece) ?? BUILD_PIECES[0];
  const myPieces = s.builds.filter((build) => build.owner === s.selfId).length;
  const plotPieces = s.identity.plot !== null ? s.builds.filter((build) => build.plot === s.identity.plot).length : 0;

  return (
    <Panel
      open={open}
      onClose={onClose}
      kicker="The Studio"
      title="The shared bench"
      wide
      footer={
        <div className="world-panel-foot-row">
          <span className="world-panel-note">
            {s.insidePlot !== null
              ? `You are on Terrace ${s.insidePlot + 1}.`
              : Math.hypot(s.position[0] - 150, s.position[2] - 36) < 18
                ? "You are in the Studio."
                : "Walk to the Studio, or claim a terrace, to build."}
          </span>
          <div className="flex items-center gap-2">
            <Btn size="sm" onClick={() => send({ type: "rotate" })}>
              <RotateCw aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
              Rotate
            </Btn>
            <Btn size="sm" variant={s.buildMode ? "danger" : "primary"} onClick={() => getStore().set({ buildMode: !s.buildMode })}>
              {s.buildMode ? "Leave build mode" : "Enter build mode"}
            </Btn>
          </div>
        </div>
      }
    >
      <div className="world-build-grid">
        <Section title="Pieces" hint="1–9 and 0 choose a piece while building.">
          <div className="world-piece-grid">
            {BUILD_PIECES.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => getStore().set({ buildPiece: item.id })}
                aria-pressed={s.buildPiece === item.id}
                className={cn("world-piece", s.buildPiece === item.id && "is-active")}
                title={`${item.name} — ${item.note}`}
              >
                <span className="world-piece-glyph">{item.glyph}</span>
                <span>{item.name}</span>
                <span className="world-piece-index">{index === 9 ? 0 : index + 1}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Materials" hint="[ and ] cycle; every material is a real surface.">
          <div className="world-material-grid">
            {BUILD_MATERIALS.map((material) => (
              <button
                key={material.id}
                type="button"
                onClick={() => getStore().set({ buildMaterial: material.id })}
                aria-pressed={s.buildMaterial === material.id}
                className={cn("world-material", s.buildMaterial === material.id && "is-active")}
                title={material.note}
              >
                <span
                  className="world-material-swatch"
                  style={{
                    backgroundColor: material.css,
                    boxShadow: `0 0 14px ${material.css}55`,
                  }}
                />
                <span>{material.name}</span>
              </button>
            ))}
          </div>

          <div className="world-build-controls">
            <Slider
              label="Scale"
              min={0.4}
              max={4}
              step={0.1}
              value={s.buildScale}
              onChange={(value) => getStore().set({ buildScale: value })}
              format={(value) => `${value.toFixed(1)}×`}
            />
            <Slider
              label="Rotation"
              min={0}
              max={Math.PI * 2}
              step={Math.PI / 12}
              value={s.buildRotate % (Math.PI * 2)}
              onChange={(value) => getStore().set({ buildRotate: value })}
              format={(value) => `${Math.round((value * 180) / Math.PI)}°`}
            />
          </div>
        </Section>

        <div className="world-build-side">
          <Section title={piece.name} hint={piece.note}>
            <div className="world-piece-preview" aria-hidden="true">
              <span>{piece.glyph}</span>
              <span style={{ color: (BUILD_MATERIALS.find((m) => m.id === s.buildMaterial) ?? BUILD_MATERIALS[0]).css }}>
                {(BUILD_MATERIALS.find((m) => m.id === s.buildMaterial) ?? BUILD_MATERIALS[0]).name}
              </span>
            </div>
            <p className="world-panel-note">
              The ghost is the real geometry at 42% opacity. It turns rose where a
              piece cannot stand.
            </p>
            <div className="world-build-actions">
              <Btn variant="primary" size="sm" onClick={() => send({ type: "touch-place" })} disabled={!s.buildMode}>
                <Hammer aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
                Place
              </Btn>
              <Btn size="sm" onClick={() => send({ type: "touch-remove" })} disabled={!s.hoverBuild}>
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
                Remove
              </Btn>
            </div>
          </Section>

          <Section title="The room's bench" hint="Shared the instant a piece lands.">
            <div className="world-kv">
              <span>Pieces in the room</span>
              <strong>{s.builds.length}</strong>
            </div>
            <div className="world-kv">
              <span>Yours</span>
              <strong>{myPieces}</strong>
            </div>
            <div className="world-kv">
              <span>Your terrace</span>
              <strong>{s.identity.plot !== null ? `${plotPieces} / ${PLOT_PIECE_LIMIT}` : "none claimed"}</strong>
            </div>
            <div className="world-kv">
              <span>Zone</span>
              <strong>
                {s.inBuildZone === "studio" ? "the Studio" : s.inBuildZone === "plot" ? "your terrace" : "none"}
              </strong>
            </div>
          </Section>

          <Section title="Build together" hint="A terrace is the member&apos;s; the Studio is everyone&apos;s.">
            <p className="world-panel-note">
              Place at the Studio for a shared sculpture, or claim a terrace from the
              Plots panel to make a room of your own. Only the member who placed a
              piece can remove it; a terrace&apos;s pieces go with the terrace when it is
              released.
            </p>
          </Section>
        </div>
      </div>
    </Panel>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Plots
 * ──────────────────────────────────────────────────────────────────────────── */

function PlotsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useRealm();
  const selected = s.plotDraft ?? s.identity.plot ?? 0;
  const selectedPlot = s.plots.find((plot) => plot.index === selected);
  const mine = s.identity.plot !== null ? s.plots.find((plot) => plot.index === s.identity.plot) : null;
  const isMine = selectedPlot?.owner === s.selfId || (s.identity.plot === selected && !!selectedPlot);
  const otherOwned = Boolean(selectedPlot && !isMine);

  return (
    <Panel
      open={open}
      onClose={onClose}
      kicker="The Terraces"
      title="A place of your own"
      wide
      footer={
        <div className="world-panel-foot-row">
          <span className="world-panel-note">
            A terrace persists in the room. There are twelve; they are first-come.
          </span>
          <Btn
            size="sm"
            onClick={() => {
              send({ type: "teleport", x: PLOTS[selected].x, z: PLOTS[selected].z, label: `Terrace ${selected + 1}` });
              onClose();
            }}
          >
            <MapPin aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
            Walk to terrace {selected + 1}
          </Btn>
        </div>
      }
    >
      <Section title="The twelve" hint="Select a terrace to claim, edit, or visit.">
        <div className="world-plot-grid">
          {PLOTS.map((plot) => {
            const claim = s.plots.find((item) => item.index === plot.index);
            const isYours = claim?.owner === s.selfId || s.identity.plot === plot.index;
            return (
              <button
                key={plot.index}
                type="button"
                onClick={() => getStore().set({ plotDraft: plot.index })}
                className={cn(
                  "world-plot-card",
                  selected === plot.index && "is-active",
                  isYours && "is-yours",
                  claim && !isYours && "is-taken",
                )}
                style={{ borderColor: selected === plot.index ? (claim?.color ?? "#ff8fd1") : undefined }}
              >
                <span className="world-plot-number">{String(plot.index + 1).padStart(2, "0")}</span>
                <span className="world-plot-title">{claim ? claim.title : "Unclaimed"}</span>
                <span className="world-plot-owner">
                  {claim ? (isYours ? "yours" : claim.ownerName) : "press to claim"}
                </span>
                {claim ? (
                  <span className="world-plot-glyph" style={{ color: claim.color }}>
                    {claim.glyph}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </Section>

      <div className="world-plot-detail">
        <Section
          title={`Terrace ${selected + 1}`}
          hint={
            otherOwned
              ? `Held by ${selectedPlot?.ownerName}. Only the owner can edit it.`
              : isMine
                ? "Yours. Name it, colour it, build inside it."
                : "Unclaimed. Claim it to make it yours."
          }
        >
          {otherOwned ? (
            <div className="world-quiet-card">
              <p>
                {selectedPlot?.title} — {selectedPlot?.ownerName}
              </p>
              <p>{selectedPlot?.motto}</p>
              <Btn size="sm" onClick={() => { getStore().set({ panel: "chat" }); }}>
                <MessageCircle aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
                Say hello in the world
              </Btn>
            </div>
          ) : (
            <PlotEditor
              key={`${selected}:${open}:${selectedPlot?.at ?? "none"}`}
              selected={selected}
              plot={selectedPlot}
              isMine={isMine}
              connected={s.connected}
              identity={s.identity}
              onClose={onClose}
            />
          )}
        </Section>

        <Section title="What a terrace is" hint="Not a profile page: a room with a door.">
          <p className="world-panel-note">
            A member claims one of twelve plots on the western rise. The banner and
            beacon carry the name and colour; the plot holds up to {PLOT_PIECE_LIMIT}{" "}
            pieces. Releasing a terrace removes its pieces with it. The Studio is
            the shared alternative: no claim, no limit beyond the room&apos;s bench.
          </p>
          <div className="world-kv">
            <span>Your terrace</span>
            <strong>{mine ? `${mine.index + 1} · ${mine.title}` : "not claimed"}</strong>
          </div>
          <div className="world-kv">
            <span>Claimed in this room</span>
            <strong>{s.plots.length} / 12</strong>
          </div>
        </Section>
      </div>
    </Panel>
  );
}

function PlotEditor({
  selected,
  plot,
  isMine,
  connected,
  identity,
  onClose,
}: {
  selected: number;
  plot: PlotState | undefined;
  isMine: boolean;
  connected: boolean;
  identity: { name: string; color: string; crest: string };
  onClose: () => void;
}) {
  const [title, setTitle] = useState(plot?.title ?? "");
  const [motto, setMotto] = useState(plot?.motto ?? "");
  const [color, setColor] = useState(plot?.color ?? identity.color);
  const [glyph, setGlyph] = useState(plot?.glyph ?? identity.crest);

  return (
    <div className="world-plot-form">
      <Field label="Name the terrace">
        <TextInput value={title} onChange={setTitle} placeholder="The Quiet Room" maxLength={40} />
      </Field>
      <Field label="A line about it">
        <TextInput value={motto} onChange={setMotto} placeholder="where the work gets finished" maxLength={80} />
      </Field>
      <Field label="Beacon colour">
        <div className="world-swatches">
          {AVATAR_COLORS.map((item) => (
            <button
              key={item.css}
              type="button"
              className={cn("world-swatch", color === item.css && "is-active")}
              style={{ backgroundColor: item.css }}
              aria-label={item.name}
              onClick={() => setColor(item.css)}
            />
          ))}
        </div>
      </Field>
      <Field label="Banner glyph">
        <div className="world-crests">
          {AVATAR_CRESTS.map((item) => (
            <button
              key={item.glyph}
              type="button"
              className={cn("world-crest", glyph === item.glyph && "is-active")}
              aria-label={item.name}
              onClick={() => setGlyph(item.glyph)}
              style={{ color: glyph === item.glyph ? color : undefined }}
            >
              {item.glyph}
            </button>
          ))}
        </div>
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        {isMine ? (
          <>
            <Btn
              variant="primary"
              size="sm"
              onClick={() => {
                send({
                  type: "plot-update",
                  index: selected,
                  title,
                  color,
                  glyph,
                  motto,
                });
                onClose();
              }}
            >
              <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
              Save the terrace
            </Btn>
            <Btn
              size="sm"
              onClick={() => {
                send({ type: "plot-release", index: selected });
                getStore().set({ plotDraft: null });
              }}
            >
              Release
            </Btn>
            <Btn size="sm" onClick={() => getStore().set({ panel: "build", buildMode: true })}>
              <Hammer aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
              Build here
            </Btn>
          </>
        ) : (
          <Btn
            variant="primary"
            size="sm"
            disabled={!connected}
            onClick={() => {
              send({
                type: "plot-claim",
                index: selected,
                title: title || `${identity.name}'s terrace`,
                color,
                glyph,
                motto,
              });
              onClose();
            }}
          >
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
            Claim terrace {selected + 1}
          </Btn>
        )}
      </div>
      {!connected ? (
        <p className="world-panel-note">
          Claiming needs the room server. In solo orbit your build stays on this
          device and no terrace is reserved for you.
        </p>
      ) : null}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Avatar
 * ──────────────────────────────────────────────────────────────────────────── */

function AvatarPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useRealm();
  const identity = s.identity;
  const [saved, setSaved] = useState(false);

  return (
    <Panel
      open={open}
      onClose={onClose}
      kicker="How you are seen"
      title="Your avatar"
      footer={
        <div className="world-panel-foot-row">
          <span className="world-panel-note">
            Appearance travels with your body in the room; it is not uploaded or
            stored on the server.
          </span>
          <div className="flex items-center gap-2">
            <Btn size="sm" onClick={() => send({ type: "third-person" })}>
              {s.settings.thirdPerson ? "First person" : "See yourself"}
            </Btn>
            <Btn
              variant="primary"
              size="sm"
              onClick={() => {
                send({
                  type: "identity",
                  name: identity.name.trim() || "A traveller",
                  color: identity.color,
                  form: identity.form,
                  crest: identity.crest,
                });
                setSaved(true);
                window.setTimeout(() => setSaved(false), 2200);
              }}
            >
              {saved ? <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} /> : null}
              {saved ? "Saved" : "Save and appear"}
            </Btn>
          </div>
        </div>
      }
    >
      <div className="world-avatar-panel">
        <div className="world-avatar-stage is-panel" data-form={identity.form}>
          <AvatarPreview color={identity.color} form={identity.form} crest={identity.crest} />
          <div className="world-avatar-caption">
            <span style={{ color: identity.color }}>{identity.crest}</span>
            <strong>{identity.name || "A traveller"}</strong>
            <span>{AVATAR_FORMS.find((form) => form.id === identity.form)?.name}</span>
          </div>
        </div>

        <div className="world-avatar-form">
          <Field label="Name in the world">
            <TextInput
              value={identity.name}
              onChange={(value) => getStore().setIdentity({ name: value })}
              maxLength={32}
              placeholder="A traveller"
            />
          </Field>

          <Field label="Silhouette" hint="Three bodies, each readable at distance.">
            <div className="world-form-grid">
              {AVATAR_FORMS.map((form) => (
                <button
                  key={form.id}
                  type="button"
                  className={cn("world-form-card", identity.form === form.id && "is-active")}
                  onClick={() => getStore().setIdentity({ form: form.id as AvatarForm })}
                  aria-pressed={identity.form === form.id}
                  title={form.blurb}
                >
                  <span className={cn("world-form-mark", `is-${form.id}`)} style={{ borderColor: identity.color }} />
                  <span>{form.name}</span>
                  <small>{form.blurb}</small>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Colour">
            <div className="world-swatches">
              {AVATAR_COLORS.map((item) => (
                <button
                  key={item.css}
                  type="button"
                  className={cn("world-swatch", identity.color === item.css && "is-active")}
                  style={{ backgroundColor: item.css }}
                  aria-label={item.name}
                  onClick={() => getStore().setIdentity({ color: item.css })}
                />
              ))}
            </div>
          </Field>

          <Field label="Crest">
            <div className="world-crests">
              {AVATAR_CRESTS.map((item) => (
                <button
                  key={item.glyph}
                  type="button"
                  className={cn("world-crest", identity.crest === item.glyph && "is-active")}
                  aria-label={item.name}
                  onClick={() => getStore().setIdentity({ crest: item.glyph })}
                  style={{ color: identity.crest === item.glyph ? identity.color : undefined }}
                >
                  {item.glyph}
                </button>
              ))}
            </div>
          </Field>

          <div className="world-kv">
            <span>Terrace</span>
            <strong>{identity.plot !== null ? `Terrace ${identity.plot + 1}` : "none"}</strong>
          </div>
          <div className="world-kv">
            <span>Seen by</span>
            <strong>{s.playerCount - 1} other{ s.playerCount - 1 === 1 ? "" : "s"}</strong>
          </div>
          <p className="world-panel-note">
            The 2D site keeps the profile that matters: birth data, chart, courses
            and membership. This face is only for the world.
          </p>
        </div>
      </div>
    </Panel>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Settings
 * ──────────────────────────────────────────────────────────────────────────── */

function SettingsPanel({ open, onClose, viewer }: { open: boolean; onClose: () => void; viewer: Viewer }) {
  const s = useRealm();
  const settings = s.settings;
  const set = (patch: Partial<typeof settings>) => getStore().setSettings(patch);

  return (
    <Panel
      open={open}
      onClose={onClose}
      kicker="The instrument"
      title="Settings"
      footer={
        <div className="world-panel-foot-row">
          <span className="world-panel-note">
            {s.connected ? `Room ${s.room} · ${s.ping} ms` : s.solo ? "Solo orbit · the room server is not connected" : "Room connecting"}
          </span>
          <Link href={viewer.twoDeeHref} className="world-btn world-btn-primary world-btn-sm">
            Exit to the 2D site
            <ArrowUpRight aria-hidden="true" className="h-3 w-3" strokeWidth={1.8} />
          </Link>
        </div>
      }
    >
      <Section title="The look" hint="Quality is automatic on a phone; override it here.">
        <div className="world-setting-row">
          <span>Quality</span>
          <div className="world-segmented">
            {(["auto", "high", "balanced", "low"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={settings.quality === value}
                className={cn(settings.quality === value && "is-active")}
                onClick={() => send({ type: "quality", value })}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <div className="world-setting-row">
          <span>Time of day</span>
          <div className="world-segmented">
            {(["dusk", "void", "golden"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={settings.timeOfDay === value}
                className={cn(settings.timeOfDay === value && "is-active")}
                onClick={() => send({ type: "time", value })}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <Slider
          label="Field of view"
          min={60}
          max={100}
          step={1}
          value={settings.fov}
          onChange={(value) => set({ fov: value })}
          format={(value) => `${value}°`}
        />
        <div className="world-setting-row">
          <span>Reduce motion</span>
          <Toggle checked={settings.reduceMotion} onChange={(value) => set({ reduceMotion: value })} label="Reduce motion" />
        </div>
        <div className="world-setting-row">
          <span>Photo mode</span>
          <Toggle checked={settings.photoMode} onChange={() => send({ type: "photo" })} label="Photo mode" />
        </div>
      </Section>

      <Section title="The body" hint="These are the values the movement actually reads.">
        <Slider
          label="Look sensitivity"
          min={0.3}
          max={2.5}
          step={0.05}
          value={settings.sensitivity}
          onChange={(value) => set({ sensitivity: value })}
          format={(value) => `${value.toFixed(2)}×`}
        />
        <div className="world-setting-row">
          <span>Invert vertical look</span>
          <Toggle checked={settings.invertY} onChange={(value) => set({ invertY: value })} label="Invert vertical look" />
        </div>
        <div className="world-setting-row">
          <span>Third person</span>
          <Toggle checked={settings.thirdPerson} onChange={() => send({ type: "third-person" })} label="Third person" />
        </div>
        <div className="world-setting-row">
          <span>Subtitles and attunements</span>
          <Toggle checked={settings.subtitles} onChange={(value) => set({ subtitles: value })} label="Subtitles" />
        </div>
      </Section>

      <Section title="Sound" hint="Everything you hear is synthesised; there are no audio files.">
        <Slider
          label="Volume"
          min={0}
          max={1}
          step={0.05}
          value={settings.volume}
          onChange={(value) => set({ volume: value })}
          format={(value) => `${Math.round(value * 100)}%`}
        />
        <Slider
          label="Ambience"
          min={0}
          max={1}
          step={0.05}
          value={settings.ambience}
          onChange={(value) => set({ ambience: value })}
          format={(value) => `${Math.round(value * 100)}%`}
        />
      </Section>

      <Section title="The room" hint="Presence, chat and the shared bench need the room server.">
        <div className="world-kv">
          <span>Status</span>
          <strong>
            {s.connected ? `connected · ${s.playerCount} here` : s.solo ? "solo orbit" : "connecting"}
          </strong>
        </div>
        <div className="world-kv">
          <span>Room</span>
          <strong>{s.room}</strong>
        </div>
        <div className="world-kv">
          <span>Ping</span>
          <strong>{s.connected ? `${s.ping} ms` : "—"}</strong>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!s.connected ? (
            <Btn size="sm" onClick={() => send({ type: "reconnect" })}>
              <Radio aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
              Reconnect
            </Btn>
          ) : null}
          <Btn
            size="sm"
            onClick={() => {
              try {
                window.localStorage.removeItem("cipher:world:identity");
                window.localStorage.removeItem("cipher:world:settings");
              } catch {
                /* storage may be blocked */
              }
              getStore().setIdentity({ name: "A traveller", color: "#d4ff3f", form: "cloak", crest: "\u2726", plot: null });
              window.location.reload();
            }}
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
            Forget my avatar
          </Btn>
        </div>
        <p className="world-panel-note">
          The room name is the only key. For a private evening, put a name only you
          and your people know in the URL: <code>?room=our-private-room</code>.
        </p>
      </Section>

      <Section title="A last thing" hint="The 2D site is not a fallback. It is the record.">
        <p className="world-panel-note">
          The world is for meeting, making and teaching. Your chart, courses,
          community history and membership stay on the 2D site, and the exit is
          always in the top right.
        </p>
      </Section>
    </Panel>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Pause, toasts, touch, embed
 * ──────────────────────────────────────────────────────────────────────────── */

export function PauseOverlay({ viewer }: { viewer: Viewer }) {
  const s = useRealm();
  if (s.phase !== "paused" || s.panel) return null;
  return (
    <div className="world-pause">
      <div className="world-pause-card">
        <p className="world-kicker">The Cipher is still here</p>
        <h2>Paused</h2>
        <p className="world-pause-lede">
          The mouse was released. Resume, or take a moment in the Atlas.
        </p>
        <div className="world-pause-actions">
          <Btn variant="primary" onClick={() => send({ type: "resume" })}>
            <Play aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
            Resume
          </Btn>
          <Btn onClick={() => getStore().set({ panel: "atlas" })}>
            <Compass aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
            Atlas
          </Btn>
          <Btn onClick={() => getStore().set({ panel: "settings" })}>Settings</Btn>
          <Link href={viewer.twoDeeHref} className="world-btn world-btn-ghost">
            The 2D site
            <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.8} />
          </Link>
        </div>
        <p className="world-pause-fine">
          <KeyCap>Esc</KeyCap> closes a panel · <KeyCap>Tab</KeyCap> Atlas ·{" "}
          <KeyCap>T</KeyCap> talk · <KeyCap>P</KeyCap> photo mode
        </p>
      </div>
    </div>
  );
}

export function Toast() {
  const s = useRealm();
  if (!s.toast) return null;
  return (
    <div className={cn("world-toast", `is-${s.toast.tone ?? "info"}`)} role="status" aria-live="polite">
      <p>{s.toast.title}</p>
      {s.toast.detail ? <span>{s.toast.detail}</span> : null}
    </div>
  );
}

export function TouchControls() {
  const s = useRealm();
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const stickRef = useRef<HTMLDivElement>(null);
  const lookRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const [sprint, setSprint] = useState(false);
  const [ascend, setAscend] = useState(false);

  if (!s.touch || s.phase !== "playing" || s.panel) return null;

  function moveStick(event: React.PointerEvent) {
    const el = stickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = (event.clientX - cx) / (rect.width / 2);
    let dy = (event.clientY - cy) / (rect.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > 1) {
      dx /= length;
      dy /= length;
    }
    setStick({ x: dx, y: dy });
    send({ type: "touch-move", x: dx, y: -dy });
  }

  function endStick() {
    setStick({ x: 0, y: 0 });
    send({ type: "touch-move", x: 0, y: 0 });
  }

  return (
    <div className="world-touch">
      <div
        className="world-touch-look"
        onPointerDown={(event) => {
          lookRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          const prev = lookRef.current;
          if (!prev || prev.id !== event.pointerId) return;
          send({
            type: "touch-look",
            dx: (event.clientX - prev.x) * 0.0045,
            dy: (event.clientY - prev.y) * 0.0045,
          });
          prev.x = event.clientX;
          prev.y = event.clientY;
        }}
        onPointerUp={() => {
          lookRef.current = null;
        }}
        onPointerCancel={() => {
          lookRef.current = null;
        }}
      />

      <div
        ref={stickRef}
        className="world-stick"
        onPointerDown={(event) => {
          (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
          moveStick(event);
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 0) moveStick(event);
        }}
        onPointerUp={endStick}
        onPointerCancel={endStick}
        aria-label="Move"
      >
        <span className="world-stick-base" />
        <span className="world-stick-knob" style={{ transform: `translate(${stick.x * 34}px, ${stick.y * 34}px)` }} />
      </div>

      <div className="world-touch-buttons">
        <button
          type="button"
          className="world-touch-btn"
          onPointerDown={() => {
            setSprint(true);
            send({ type: "touch-sprint", on: true });
          }}
          onPointerUp={() => {
            setSprint(false);
            send({ type: "touch-sprint", on: false });
          }}
        >
          Run
        </button>
        <button type="button" className={cn("world-touch-btn", sprint && "is-active")} onClick={() => send({ type: "touch-jump" })}>
          Jump
        </button>
        <button type="button" className="world-touch-btn" onClick={() => { send({ type: "fly-toggle" }); }}>
          {s.mode === "fly" ? "Land" : "Fly"}
        </button>
        <button type="button" className="world-touch-btn" onClick={() => send({ type: "touch-use" })}>
          Use
        </button>
        <button
          type="button"
          className={cn("world-touch-btn", ascend && "is-active")}
          onPointerDown={() => {
            setAscend(true);
            send({ type: "touch-ascend", on: true });
          }}
          onPointerUp={() => {
            setAscend(false);
            send({ type: "touch-ascend", on: false });
          }}
        >
          Up
        </button>
        <button type="button" className="world-touch-btn is-accent" onClick={() => send({ type: "touch-fire" })}>
          Signal
        </button>
        <button type="button" className="world-touch-btn" onClick={() => getStore().set({ panel: "build", buildMode: true })}>
          Build
        </button>
        <button type="button" className="world-touch-btn" onClick={() => getStore().set({ panel: "atlas" })}>
          Atlas
        </button>
      </div>
    </div>
  );
}

function subscribeNever() {
  return () => {};
}

/** Browser-only: SSR must not guess whether the page is framed. */
function framedSnapshot() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function EmbedNote() {
  const embedded = useSyncExternalStore(subscribeNever, framedSnapshot, () => false);
  if (!embedded) return null;
  return (
    <div className="world-embed-note">
      <span>This is a preview frame. Mouse capture and keyboard focus are often blocked here.</span>
      <button type="button" onClick={() => window.open(window.location.href, "_blank", "noopener,noreferrer")}>
        Open in a new tab
      </button>
    </div>
  );
}

/** Kept exported for the plots panel's typing without importing the engine. */
export type TerracePlot = PlotState;

