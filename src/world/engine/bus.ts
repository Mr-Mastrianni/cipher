/**
 * A one-line bridge from React to the running world.
 *
 * The interface never reaches into the engine's object graph; it sends an
 * intent, and the realm decides what that means for a body in a place.
 */

import type { AvatarForm, SessionInput } from "../state";
import type { PlaceId } from "../content/world";

export type RealmCommand =
  | { type: "enter" }
  | { type: "resume" }
  | { type: "teleport"; x: number; z: number; y?: number; fly?: boolean; label?: string }
  | { type: "travel"; id: PlaceId | "space" }
  | { type: "build-toggle"; on?: boolean }
  | { type: "select-piece"; id: string }
  | { type: "select-material"; id: string }
  | { type: "rotate" }
  | { type: "scale"; delta: number }
  | { type: "time"; value: "dusk" | "void" | "golden" }
  | { type: "quality"; value: "auto" | "high" | "balanced" | "low" }
  | { type: "photo" }
  | { type: "fire" }
  | { type: "fly-toggle"; on?: boolean }
  | { type: "use" }
  | { type: "third-person"; on?: boolean }
  | { type: "session-start"; title?: string; session?: SessionInput }
  | { type: "session-schedule"; session: SessionInput }
  | { type: "session-update"; session: SessionInput }
  | { type: "session-slide"; index: number }
  | { type: "session-end" }
  | { type: "chat"; text: string; where: string }
  | { type: "identity"; name: string; color: string; form: AvatarForm; crest: string }
  | { type: "plot-claim"; index: number; title: string; color: string; glyph: string; motto: string }
  | { type: "plot-update"; index: number; title: string; color: string; glyph: string; motto: string }
  | { type: "plot-release"; index: number }
  | { type: "reconnect" }
  | { type: "touch-move"; x: number; y: number }
  | { type: "touch-sprint"; on: boolean }
  | { type: "touch-look"; dx: number; dy: number }
  | { type: "touch-jump" }
  | { type: "touch-ascend"; on: boolean }
  | { type: "touch-fire" }
  | { type: "touch-use" }
  | { type: "touch-place" }
  | { type: "touch-remove" }
  | { type: "resize" };

const bus = new EventTarget();

export function send(cmd: RealmCommand) {
  bus.dispatchEvent(new CustomEvent<RealmCommand>("world-command", { detail: cmd }));
}

export function onCommand(handler: (cmd: RealmCommand) => void) {
  const fn = (event: Event) => handler((event as CustomEvent<RealmCommand>).detail);
  bus.addEventListener("world-command", fn);
  return () => bus.removeEventListener("world-command", fn);
}
