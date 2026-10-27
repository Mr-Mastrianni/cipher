/**
 * The teaching session's shared rules.
 *
 * Scheduling, going live and advancing notes are the parts of the room both
 * transports must agree on. The HTTP route and the WebSocket server duplicate a
 * little validation by necessity; these tests pin the HTTP side so a change to
 * the host-only rule or the slide bounds cannot pass silently.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { applyWorldAction, emptyWorld, type PlayerIdentity } from "../room";

const host: PlayerIdentity = {
  id: "w-aaaaaaaaaaaaaaaaaaaa",
  name: "Mira",
  color: "#d4ff3f",
  form: "cloak",
  crest: "\u2726",
};

const other: PlayerIdentity = {
  ...host,
  id: "w-bbbbbbbbbbbbbbbbbbbb",
  name: "Bishop",
  color: "#5ce1e6",
};

const slides = [
  { id: "one", title: "The sub lord", body: "Start with the cusp." },
  { id: "two", title: "The promise", body: "Read the sub lord's house." },
];

test("a host can schedule a session and attach a 2D call", () => {
  const now = Date.UTC(2026, 0, 10, 18, 0);
  const result = applyWorldAction(
    emptyWorld(),
    "session:schedule",
    {
      title: "Reading the sub lords together",
      agenda: "Bring one chart.",
      startsAt: now + 86_400_000,
      slides,
      callId: "call-1",
      callTitle: "The weekly circle",
    },
    host,
    now,
  );
  assert.equal(result.ok, true);
  assert.equal(result.world.session?.status, "scheduled");
  assert.equal(result.world.session?.hostId, host.id);
  assert.equal(result.world.session?.slides?.length, 2);
  assert.equal(result.world.session?.callTitle, "The weekly circle");
  assert.equal(result.world.session?.slide, 0);
});

test("another member cannot start or edit a scheduled session", () => {
  const now = Date.UTC(2026, 0, 10, 18, 0);
  const scheduled = applyWorldAction(
    emptyWorld(),
    "session:schedule",
    { title: "A session", startsAt: now + 86_400_000, slides },
    host,
    now,
  ).world;
  const start = applyWorldAction(scheduled, "session:start", {}, other, now + 1);
  assert.equal(start.ok, false);
  assert.match(start.error ?? "", /floor|session|host/i);
  const update = applyWorldAction(
    scheduled,
    "session:update",
    { title: "Not mine", slides: [] },
    other,
    now + 2,
  );
  assert.equal(update.ok, false);
});

test("starting a scheduled session preserves its notes and opens slide one", () => {
  const now = Date.UTC(2026, 0, 10, 18, 0);
  const scheduled = applyWorldAction(
    emptyWorld(),
    "session:schedule",
    { title: "A session", startsAt: now + 86_400_000, slides },
    host,
    now,
  ).world;
  const live = applyWorldAction(scheduled, "session:start", {}, host, now + 5);
  assert.equal(live.ok, true);
  assert.equal(live.world.session?.status, "live");
  assert.equal(live.world.session?.slides?.length, 2);
  assert.equal(live.world.session?.at, now + 5);
  assert.equal(live.world.session?.slide, 0);
});

test("only the host advances slides, and only within the deck", () => {
  const now = Date.UTC(2026, 0, 10, 18, 0);
  const live = applyWorldAction(
    emptyWorld(),
    "session:start",
    { title: "A session", slides },
    host,
    now,
  ).world;
  const denied = applyWorldAction(live, "session:slide", { index: 1 }, other, now + 1);
  assert.equal(denied.ok, false);
  const advanced = applyWorldAction(live, "session:slide", { index: 1 }, host, now + 2);
  assert.equal(advanced.ok, true);
  assert.equal(advanced.world.session?.slide, 1);
  const outOfBounds = applyWorldAction(live, "session:slide", { index: 9 }, host, now + 3);
  assert.equal(outOfBounds.ok, false);
});

test("a host can edit notes while live and end the floor", () => {
  const now = Date.UTC(2026, 0, 10, 18, 0);
  const live = applyWorldAction(
    emptyWorld(),
    "session:start",
    { title: "A session", slides },
    host,
    now,
  ).world;
  const edited = applyWorldAction(
    live,
    "session:update",
    { title: "A better title", agenda: "Updated", slides: [slides[0]] },
    host,
    now + 10,
  );
  assert.equal(edited.ok, true);
  assert.equal(edited.world.session?.title, "A better title");
  assert.equal(edited.world.session?.slides?.length, 1);
  assert.equal(edited.world.session?.status, "live");
  const ended = applyWorldAction(edited.world, "session:end", {}, host, now + 20);
  assert.equal(ended.ok, true);
  assert.equal(ended.world.session, null);
  const denied = applyWorldAction(live, "session:end", {}, other, now + 21);
  assert.equal(denied.ok, false);
});

test("a live floor blocks scheduling another session", () => {
  const now = Date.UTC(2026, 0, 10, 18, 0);
  const live = applyWorldAction(
    emptyWorld(),
    "session:start",
    { title: "A session" },
    host,
    now,
  ).world;
  const second = applyWorldAction(
    live,
    "session:schedule",
    { title: "Later" },
    host,
    now + 1,
  );
  assert.equal(second.ok, false);
});
