"use client";

import Link from "next/link";
import {
  BookOpen,
  Compass,
  Hammer,
  LogOut,
  MessageCircle,
  Orbit,
  Radio,
  Settings,
  Sparkles,
  UserRound,
  Users,
  Wind,
} from "lucide-react";

import { useRealm, getStore } from "../state";
import { send } from "../engine/bus";
import { cn } from "@/lib/utils";
import type { Viewer } from "./Landing";

function heading(yaw: number) {
  const degrees = ((-yaw * 180) / Math.PI + 360) % 360;
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return { degrees, label: labels[Math.round(degrees / 45) % 8] };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
}

export function Hud({ viewer }: { viewer: Viewer }) {
  const s = useRealm();
  const compass = heading(s.yaw);
  const photo = s.settings.photoMode;
  const others = s.players.filter((player) => player.id !== s.selfId);
  const feed = s.feed.slice(-5);

  function open(panel: NonNullable<typeof s.panel>) {
    getStore().set({ panel, chatOpen: panel === "chat", unread: panel === "chat" ? 0 : s.unread });
    if (typeof document !== "undefined" && document.pointerLockElement) document.exitPointerLock();
  }

  return (
    <div className={cn("world-hud", photo && "is-photo")} aria-hidden={photo}>
      {photo ? (
        <div className="world-photo-hint">
          Photo mode · <kbd>P</kbd> to return
        </div>
      ) : null}

      {/* Top strip */}
      <header className="world-hud-top">
        <div className="world-hud-brand">
          <span className="world-hud-mark" aria-hidden="true">
            <Orbit className="h-4 w-4" strokeWidth={1.4} />
          </span>
          <div>
            <p className="world-kicker">The Cipher</p>
            <p className="world-hud-place">
              {s.regionTitle}
              <span>{s.regionSub}</span>
            </p>
          </div>
        </div>

        <div className="world-compass" aria-label={`Facing ${compass.label}, ${Math.round(compass.degrees)} degrees`}>
          <span className="world-compass-rule" />
          <span className="world-compass-value">
            {String(Math.round(compass.degrees)).padStart(3, "0")}° {compass.label}
          </span>
          <span className="world-compass-rule" />
        </div>

        <nav className="world-hud-actions" aria-label="World interface">
          <HudButton label="Atlas (Tab)" onClick={() => open("atlas")} icon={Compass} />
          <HudButton label="Talk (T)" onClick={() => open("chat")} icon={MessageCircle} badge={s.unread} />
          <HudButton label="Codex (J)" onClick={() => open("codex")} icon={BookOpen} />
          <HudButton label="Chart (C)" onClick={() => open("chart")} icon={Sparkles} />
          <HudButton
            label="Build (B)"
            onClick={() => {
              getStore().set({ buildMode: true });
              open("build");
            }}
            icon={Hammer}
            active={s.buildMode}
          />
          <HudButton label="Avatar" onClick={() => open("avatar")} icon={UserRound} />
          <HudButton label="Settings" onClick={() => open("settings")} icon={Settings} />
          <Link href={viewer.twoDeeHref} className="world-hud-btn world-hud-exit" aria-label="Exit to the 2D site">
            <LogOut aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
            <span>2D site</span>
          </Link>
        </nav>
      </header>

      {/* Left rail: presence, session, server */}
      <aside className="world-hud-rail">
        <button type="button" className="world-presence" onClick={() => open("atlas")} aria-label="Open the Atlas and see who is here">
          <span className="world-presence-count">
            <Users aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
            {s.playerCount}
          </span>
          <span className="world-presence-list" aria-hidden="true">
            {others.slice(0, 5).map((player) => (
              <span key={player.id} className="world-presence-dot" style={{ backgroundColor: player.color }} title={player.name}>
                {initials(player.name)}
              </span>
            ))}
            {others.length === 0 ? <span className="world-presence-empty">only you</span> : null}
          </span>
          <span className="world-presence-label">{s.connected ? "in the room" : s.solo ? "solo orbit" : "connecting"}</span>
        </button>

        {s.session ? (
          <div className="world-session-card">
            <p className="world-kicker">
              <span className="world-live-dot" aria-hidden="true" />
              Live on the floor
            </p>
            <p className="world-session-title">{s.session.title}</p>
            <p className="world-session-host">{s.session.host}</p>
            <button
              type="button"
              onClick={() => {
                send({ type: "teleport", x: -140, z: 22, label: "The Amphitheatre" });
                getStore().set({ panel: null });
              }}
            >
              Walk over <span aria-hidden="true">→</span>
            </button>
          </div>
        ) : null}

        {s.serverNote ? <p className="world-server-note">{s.serverNote}</p> : null}
      </aside>

      {/* Crosshair + interaction */}
      <div className="world-crosshair" aria-hidden="true">
        <span />
      </div>

      <div className="world-aim" aria-live="polite">
        {s.target ? (
          <div className="world-aim-card">
            <p className="world-aim-title">
              <kbd>E</kbd>
              {s.target.action ?? "Use"} · {s.target.title}
            </p>
            <p className="world-aim-hint">{s.target.hint}</p>
          </div>
        ) : null}
      </div>

      {s.attunement && s.altitude < 650 ? (
        <div className="world-attune" aria-live="polite">
          <p className="world-kicker">{s.attunement.tradition}</p>
          <p className="world-attune-title">{s.attunement.title}</p>
          <p className="world-attune-mantra">{s.attunement.mantra}</p>
          <p className="world-attune-meaning">{s.attunement.meaning}</p>
        </div>
      ) : null}

      {feed.length > 0 && !photo ? (
        <div className="world-feed" aria-live="polite">
          {feed.map((message) => (
            <p key={message.id} className={cn("world-feed-line", `is-${message.kind}`)}>
              {message.kind === "chat" ? <strong style={{ color: message.color }}>{message.from}</strong> : null}
              <span>{message.text}</span>
            </p>
          ))}
        </div>
      ) : null}

      {/* Bottom status */}
      <footer className="world-hud-bottom">
        <div className="world-stats">
          <span className={cn("world-mode", s.mode === "fly" && "is-fly")}>
            {s.mode === "fly" ? <Wind className="h-3.5 w-3.5" strokeWidth={1.6} /> : <Radio className="h-3.5 w-3.5" strokeWidth={1.6} />}
            {s.mode === "fly" ? "flying" : "walking"}
          </span>
          <span>{s.speed.toFixed(1)} m/s</span>
          <span>{Math.round(s.altitude)} m</span>
          {s.mode === "walk" ? <span>{Math.max(0, 4 - s.jumps)} jumps</span> : null}
          <span className="world-stats-dim">{s.fps} fps</span>
          {s.connected ? <span className="world-stats-dim">{s.ping} ms</span> : null}
        </div>

        <div className="world-hints">
          <span><kbd>WASD</kbd> move</span>
          <span><kbd>F</kbd> fly</span>
          <span><kbd>E</kbd> use</span>
          <span><kbd>B</kbd> build</span>
          <span><kbd>V</kbd> view</span>
          <span><kbd>Tab</kbd> atlas</span>
          <span><kbd>Esc</kbd> pause</span>
        </div>
      </footer>

      {!s.pointerLocked && !s.touch && !photo ? (
        <div className="world-capture-hint">
          Click the view to capture the mouse · the interface stays clickable until then
        </div>
      ) : null}

      {s.buildMode && !photo ? (
        <div className="world-build-strip">
          <span>
            <Hammer aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
            Build mode
          </span>
          <span>{s.buildPiece}</span>
          <span>{s.buildMaterial}</span>
          <span>{s.inBuildZone === "studio" ? "the Studio" : s.inBuildZone === "plot" ? "your terrace" : "not in a build zone"}</span>
          <span className="world-build-strip-hint">LMB place · RMB remove · R rotate · wheel scale</span>
          <button type="button" onClick={() => getStore().set({ buildMode: false })}>
            Done
          </button>
        </div>
      ) : null}
    </div>
  );
}

function HudButton({
  icon: Icon,
  label,
  onClick,
  active,
  badge,
}: {
  icon: typeof Compass;
  label: string;
  onClick: () => void;
  active?: boolean;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("world-hud-btn", active && "is-active")}
      aria-label={label}
      title={label}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
      {badge ? <span className="world-hud-badge">{badge > 9 ? "9+" : badge}</span> : null}
    </button>
  );
}
