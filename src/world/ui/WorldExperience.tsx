"use client";

import { useEffect, useRef } from "react";

import { Realm } from "../engine/realm";
import type { SkyPosition } from "../engine/space";
import type { MemberChart } from "../state";
import { getStore, seedIdentity, useRealm } from "../state";
import { Landing, type Viewer } from "./Landing";
import { Hud } from "./Hud";
import {
  EmbedNote,
  PauseOverlay,
  Panels,
  Toast,
  TouchControls,
} from "./panels";
import "./world.css";

/**
 * The `/world` experience.
 *
 * The canvas owns the frame loop; React owns the thin layer above it. The engine
 * is created once per mount and destroyed on the way out. In development React
 * StrictMode mounts twice, so the init and the teardown are both guarded: a
 * second body must not inherit the first body's WebGL context.
 */
export function WorldExperience({
  sky,
  chart,
  viewer,
}: {
  sky: SkyPosition[];
  chart: MemberChart | null;
  viewer: Viewer;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const realmRef = useRef<Realm | null>(null);
  const openedTeach = useRef(false);
  const s = useRealm();

  useEffect(() => {
    seedIdentity({ name: viewer.name });
    // The store is a module singleton; a client-side return to /world must not
    // inherit the last visit's phase, players or open panel.
    getStore().set({
      phase: "landing",
      ready: false,
      error: null,
      panel: null,
      chatOpen: false,
      target: null,
      attunement: null,
      players: [],
      playerCount: 1,
      builds: [],
      plots: [],
      session: null,
      selfId: "",
      chat: [],
      feed: [],
      unread: 0,
      community: null,
      communityUnread: 0,
      chart,
      sky: { positions: sky, updatedAt: Date.now() },
    });
    if (!canvasRef.current) return;
    let disposed = false;
    const realm = new Realm(canvasRef.current, { sky, chart });
    realmRef.current = realm;
    realm
      .init()
      .then(() => {
        if (disposed) realm.destroy();
      })
      .catch((error: unknown) => {
        console.error("[world] init failed", error);
        getStore().set({
          error:
            error instanceof Error
              ? error.message
              : "The world could not open. WebGL2 is required; try a current browser with hardware acceleration on.",
          ready: false,
        });
      });
    return () => {
      disposed = true;
      realm.destroy();
      realmRef.current = null;
    };
  }, [viewer.name, sky, chart]);

  useEffect(() => {
    if (s.phase === "landing" || !viewer.teachCallId || openedTeach.current) return;
    openedTeach.current = true;
    getStore().set({ panel: "learn" });
  }, [s.phase, viewer.teachCallId]);

  useEffect(() => {
    document.documentElement.dataset.world = "true";
    document.body.dataset.world = "true";
    return () => {
      delete document.documentElement.dataset.world;
      delete document.body.dataset.world;
    };
  }, []);

  return (
    <div className="world-app">
      <canvas
        ref={canvasRef}
        className="world-canvas"
        tabIndex={0}
        aria-label="The Cipher: a navigable 3D world"
      />
      {s.phase === "landing" ? <Landing viewer={viewer} /> : null}
      {s.phase !== "landing" ? <Hud viewer={viewer} /> : null}
      <Panels viewer={viewer} />
      <PauseOverlay viewer={viewer} />
      <TouchControls />
      <Toast />
      <EmbedNote />
      {s.error && s.phase === "landing" ? (
        <div className="world-fatal" role="alert">
          <div>
            <p className="world-kicker">The world could not open</p>
            <h2>WebGL2 is required</h2>
            <p>{s.error}</p>
            <p className="world-panel-note">
              The flat cosmic map has the same chart data and no GPU requirement.
            </p>
            <a className="world-btn world-btn-primary" href="/dashboard/map">
              Open the flat map
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
