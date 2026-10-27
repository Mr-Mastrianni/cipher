/**
 * The room transport contract.
 *
 * Two implementations exist: the WebSocket room for hosts with a long-lived
 * process, and the HTTP/Postgres room for Vercel. The realm talks only to this
 * interface, so movement, building, terraces and sessions do not care which one
 * is underneath.
 */

import type { AvatarForm, BuildPiece, SessionInput } from "../state";

export interface RoomTransport {
  connect(): void;
  reconnect(): void;
  close(): void;
  move(
    x: number,
    y: number,
    z: number,
    yaw: number,
    pitch: number,
    mode: "walk" | "fly",
    region: string,
  ): void;
  buildAdd(piece: BuildPiece): void;
  buildRemove(id: string): void;
  chat(text: string, where: string): void;
  signal(
    from: [number, number, number],
    to: [number, number, number],
  ): void;
  emote(kind: string): void;
  claimPlot(
    index: number,
    title: string,
    color: string,
    glyph: string,
    motto: string,
  ): void;
  updatePlot(
    index: number,
    title: string,
    color: string,
    glyph: string,
    motto: string,
  ): void;
  releasePlot(index: number): void;
  scheduleSession(input: SessionInput): void;
  updateSession(input: SessionInput): void;
  startSession(input?: SessionInput): void;
  setSessionSlide(index: number): void;
  endSession(): void;
  setIdentity(name: string, color: string, form: AvatarForm, crest: string): void;
}
