"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CircleDot,
  Globe2,
  Orbit,
  Radio,
  Sparkles,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";

import {
  AVATAR_COLORS,
  AVATAR_CRESTS,
  AVATAR_FORMS,
} from "../content/world";
import { getStore, useRealm, type TeachingCall } from "../state";
import { send } from "../engine/bus";
import { worldServerUrl } from "../net/client";
import { cn } from "@/lib/utils";
import { Btn } from "./common";

export interface Viewer {
  name: string;
  tier: string;
  signedIn: boolean;
  twoDeeHref: string;
  chartHref: string;
  hasChart: boolean;
  /** Upcoming 2D calls a teaching session can be attached to. */
  calls: TeachingCall[];
  /** A call the member arrived from, so the teaching desk can select it. */
  teachCallId?: string;
}

/**
 * The threshold.
 *
 * Not a login wall: a place to decide who you are before you are seen. Name,
 * silhouette, colour and crest are the whole avatar contract; everything else
 * the engine knows comes from the 2D site's own profile.
 */
export function Landing({ viewer }: { viewer: Viewer }) {
  const s = useRealm();
  const store = getStore();
  const identity = s.identity;
  const [room, setRoom] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("room") ?? "the-cipher";
    } catch {
      return "the-cipher";
    }
  });
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  const [players, setPlayers] = useState(0);

  const serverLabel = useMemo(() => {
    if (status === "checking") return "looking for the room…";
    if (status === "online") return players > 0 ? `room online · ${players} inside` : "room online · you would be first";
    return "solo orbit · the room server is not reachable";
  }, [status, players]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const ws = worldServerUrl(room);
        const url = new URL(ws);
        url.protocol = url.protocol === "wss:" ? "https:" : "http:";
        url.pathname = "/health";
        url.search = "";
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 2600);
        const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
        window.clearTimeout(timer);
        if (!response.ok) throw new Error("no health");
        const data = (await response.json()) as { players?: number };
        if (cancelled) return;
        setStatus("online");
        setPlayers(Number(data.players) || 0);
      } catch {
        if (!cancelled) setStatus("offline");
      }
    };
    void check();
    const timer = window.setInterval(check, 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [room]);

  function changeRoom(next: string) {
    const clean = next
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 40);
    setRoom(clean);
    store.set({ room: clean || "the-cipher" });
    try {
      const url = new URL(window.location.href);
      if (clean && clean !== "the-cipher") url.searchParams.set("room", clean);
      else url.searchParams.delete("room");
      window.history.replaceState({}, "", url);
    } catch {
      /* history is a convenience */
    }
  }

  function enter() {
    store.set({ room: room || "the-cipher" });
    send({ type: "enter" });
  }

  return (
    <div className="world-landing">
      <div className="world-landing-noise" aria-hidden="true" />

      <header className="world-landing-top">
        <Link href="/" className="world-brand" aria-label="The Cipher home">
          <Orbit aria-hidden="true" className="h-5 w-5" strokeWidth={1.4} />
          <span>THE CIPHER</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="world-tag">
            {viewer.signedIn ? `${viewer.tier} member` : "demo orbit"}
          </span>
          <Link href={viewer.twoDeeHref} className="world-2d-link">
            The 2D site
            <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
          </Link>
        </div>
      </header>

      <main className="world-landing-main">
        <section className="world-landing-copy">
          <p className="world-kicker">A world inside the work</p>
          <h1 className="world-landing-title">
            The Cipher
            <span>is a place now.</span>
          </h1>
          <p className="world-landing-lede">
            Walk the Axis. Fly to the Sky Wheel. Claim a terrace, build something
            with someone on the other side of the planet, and take the floor to
            teach what you have learned. Your KP chart and bodygraph hang in the
            Observatory, cast from the same engine as the 2D site.
          </p>

          <ul className="world-landing-points">
            <li>
              <Globe2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.4} />
              <span>Members join from anywhere. The room is the invitation.</span>
            </li>
            <li>
              <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={1.4} />
              <span>Your own avatar, your own terrace, your own signal.</span>
            </li>
            <li>
              <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.4} />
              <span>The 2D site is always one click away, top right.</span>
            </li>
          </ul>

          <Btn
            variant="primary"
            className="world-enter-hero"
            onClick={enter}
            disabled={!identity.name.trim()}
          >
            <CircleDot aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
            {identity.name.trim() ? `Enter as ${identity.name}` : "Choose a name to enter"}
            <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
          </Btn>

          {!viewer.hasChart ? (
            <p className="world-landing-note">
              You have not entered your birth data yet. The world still opens; the
              Observatory will explain what to add.{" "}
              <Link href={viewer.chartHref}>Enter your coordinates →</Link>
            </p>
          ) : null}
        </section>

        <section className="world-landing-card" aria-label="Create your arrival">
          <div className="world-avatar-stage" data-form={identity.form}>
            <AvatarPreview color={identity.color} form={identity.form} crest={identity.crest} />
            <div className="world-avatar-caption">
              <span style={{ color: identity.color }}>{identity.crest}</span>
              <strong>{identity.name || "A traveller"}</strong>
              <span>{AVATAR_FORMS.find((form) => form.id === identity.form)?.name}</span>
            </div>
          </div>

          <div className="world-landing-form">
            <label className="world-field">
              <span className="world-field-label">Your name in the world</span>
              <input
                className="world-input"
                value={identity.name}
                maxLength={32}
                onChange={(event) => store.setIdentity({ name: event.target.value })}
                placeholder="How should people see you?"
                aria-label="Your name in the world"
              />
            </label>

            <fieldset className="world-fieldset">
              <legend className="world-field-label">Silhouette</legend>
              <div className="world-form-grid">
                {AVATAR_FORMS.map((form) => (
                  <button
                    key={form.id}
                    type="button"
                    onClick={() => store.setIdentity({ form: form.id })}
                    aria-pressed={identity.form === form.id}
                    className={cn("world-form-card", identity.form === form.id && "is-active")}
                    title={form.blurb}
                  >
                    <span className={cn("world-form-mark", `is-${form.id}`)} style={{ borderColor: identity.color }} />
                    <span>{form.name}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="world-fieldset">
              <legend className="world-field-label">Colour</legend>
              <div className="world-swatches">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color.css}
                    type="button"
                    onClick={() => store.setIdentity({ color: color.css })}
                    aria-label={color.name}
                    aria-pressed={identity.color === color.css}
                    className={cn("world-swatch", identity.color === color.css && "is-active")}
                    style={{ backgroundColor: color.css }}
                    title={color.name}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset className="world-fieldset">
              <legend className="world-field-label">Crest</legend>
              <div className="world-crests">
                {AVATAR_CRESTS.map((crest) => (
                  <button
                    key={crest.glyph}
                    type="button"
                    onClick={() => store.setIdentity({ crest: crest.glyph })}
                    aria-label={crest.name}
                    aria-pressed={identity.crest === crest.glyph}
                    className={cn("world-crest", identity.crest === crest.glyph && "is-active")}
                    title={crest.name}
                    style={{ color: identity.crest === crest.glyph ? identity.color : undefined }}
                  >
                    {crest.glyph}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="world-field">
              <span className="world-field-label">Room</span>
              <span className="world-field-hint">
                Share the link. The room name is the invitation — there are no
                accounts inside the world.
              </span>
              <input
                className="world-input"
                value={room}
                maxLength={40}
                onChange={(event) => changeRoom(event.target.value)}
                placeholder="the-cipher"
                aria-label="Room name"
              />
            </label>

            <div className="world-room-status" data-status={status}>
              {status === "online" ? (
                <Wifi aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
              ) : status === "offline" ? (
                <WifiOff aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.6} />
              ) : (
                <Radio aria-hidden="true" className="h-3.5 w-3.5 animate-pulse" strokeWidth={1.6} />
              )}
              <span>{serverLabel}</span>
            </div>

            {s.error ? (
              <p className="world-error" role="alert">
                {s.error}
              </p>
            ) : null}

            <Btn variant="primary" className="world-enter" onClick={enter} disabled={!identity.name.trim()}>
              <CircleDot aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
              {identity.name.trim() ? `Enter as ${identity.name}` : "Choose a name to enter"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
            </Btn>

            <p className="world-landing-fine">
              <Users aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
              {viewer.signedIn
                ? "Your 2D membership, chart and rooms are unchanged."
                : "You are exploring in demo mode. Sign in on the 2D site to bring your chart."}
            </p>
          </div>
        </section>
      </main>

      <footer className="world-landing-foot">
        <span>Click to capture the mouse · WASD to walk · F to fly</span>
        <span className="hidden sm:inline">The valley, the chart and the wheel are computed, not painted.</span>
      </footer>
    </div>
  );
}

/** A 2D silhouette of the 3D avatar, so the choice reads before entry. */
export function AvatarPreview({
  color,
  form,
  crest,
  size = "lg",
}: {
  color: string;
  form: "cloak" | "orb" | "wanderer";
  crest: string;
  size?: "sm" | "lg";
}) {
  return (
    <div className={cn("world-avatar", `world-avatar-${form}`, size === "sm" && "is-sm")} aria-hidden="true">
      <div className="world-avatar-halo" style={{ background: `radial-gradient(circle, ${color}33 0%, transparent 68%)` }} />
      {form === "orb" ? (
        <div className="world-avatar-orb" style={{ borderColor: color, boxShadow: `0 0 30px ${color}66, inset 0 0 22px ${color}77` }}>
          <span style={{ color }}>{crest}</span>
        </div>
      ) : (
        <>
          <div className="world-avatar-ring" style={{ borderColor: `${color}99` }} />
          <div className={cn("world-avatar-body", form === "wanderer" && "is-wanderer")} style={{ borderColor: `${color}55` }}>
            <span className="world-avatar-hem" style={{ background: color }} />
            {form === "wanderer" ? <span className="world-avatar-staff" style={{ background: `${color}cc` }} /> : null}
          </div>
          <div className="world-avatar-head" style={{ boxShadow: `0 0 18px ${color}88` }}>
            <span style={{ color }}>{crest}</span>
          </div>
        </>
      )}
    </div>
  );
}
