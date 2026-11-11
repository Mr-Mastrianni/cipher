/**
 * The WebSocket room's membership check.
 *
 * The app signs (`src/lib/world/room-token.ts`), the room server verifies
 * (`server/room-token.mjs`). They are separate files because the server image
 * carries no app code, so these tests pin that they agree, and then run the real
 * server to check what a token buys: an identity that can't be borrowed.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { WebSocket } from "ws";

import { memberWorldId } from "../room";
import { signRoomToken } from "../room-token";
import { verifyRoomToken } from "../../../../server/room-token.mjs";

const SECRET = "test-secret-for-the-room";
const mira = memberWorldId("user-mira");
const jo = memberWorldId("user-jo");

test("a token the app signs is accepted by the room server", () => {
  const token = signRoomToken(SECRET, mira);
  assert.deepEqual(verifyRoomToken(SECRET, token), { ok: true, sub: mira });
});

test("a token is refused when tampered with, expired, or signed with another secret", () => {
  const now = Date.now();
  const token = signRoomToken(SECRET, mira, now);
  const [part, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ v: 1, sub: jo, exp: now + 60_000 })).toString("base64url");
  assert.equal(verifyRoomToken(SECRET, `${forged}.${sig}`).ok, false);
  assert.equal(verifyRoomToken(SECRET, `${part}.${sig}x`).ok, false);
  assert.equal(verifyRoomToken("another-secret", token).ok, false);
  assert.equal(verifyRoomToken(SECRET, token, now + 3 * 60_000).ok, false);
  assert.equal(verifyRoomToken(SECRET, undefined).ok, false);
  assert.equal(verifyRoomToken("", token).ok, false);
});

test("the app will not sign for anything but a member world id", () => {
  assert.throws(() => signRoomToken(SECRET, "w-anonymous-id"));
  assert.throws(() => signRoomToken("", mira));
});

/* ── the real server ───────────────────────────────────────────────────── */

type Msg = Record<string, unknown>;

interface Conn {
  ws: WebSocket;
  messages: Msg[];
  closed: Promise<number>;
  next(type: string, match?: (m: Msg) => boolean): Promise<Msg>;
}

function connect(port: number, params: Record<string, string>): Promise<Conn> {
  const url = new URL(`ws://127.0.0.1:${port}/ws`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const ws = new WebSocket(url);
  const messages: Msg[] = [];
  const waiters: Array<{ type: string; match?: (m: Msg) => boolean; resolve: (m: Msg) => void }> = [];
  ws.on("message", (raw) => {
    const msg = JSON.parse(String(raw)) as Msg;
    messages.push(msg);
    for (const w of [...waiters]) {
      if (msg.t === w.type && (!w.match || w.match(msg))) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(msg);
      }
    }
  });
  const closed = new Promise<number>((resolve) => ws.on("close", (code) => resolve(code)));
  const conn: Conn = {
    ws,
    messages,
    closed,
    next(type, match) {
      const seen = messages.find((m) => m.t === type && (!match || match(m)));
      if (seen) {
        messages.splice(messages.indexOf(seen), 1);
        return Promise.resolve(seen);
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`no ${type} message`)), 4000);
        waiters.push({
          type,
          match,
          resolve: (m) => {
            clearTimeout(timer);
            messages.splice(messages.indexOf(m), 1);
            resolve(m);
          },
        });
      });
    },
  };
  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve(conn));
    ws.once("unexpected-response", () => reject(new Error("refused")));
    ws.once("error", reject);
    // A refused connection still opens, then closes with a reason.
  });
}

async function startServer(dir: string, port: number): Promise<ChildProcess> {
  const child = spawn(process.execPath, [path.resolve("server/world-server.mjs")], {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "production",
      WORLD_TOKEN_SECRET: SECRET,
      WORLD_DATA_FILE: path.join(dir, "world.json"),
      DATABASE_URL: "",
      WORLD_ROOM_SECRET: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server did not start")), 8000);
    child.stdout?.on("data", (chunk) => {
      if (String(chunk).includes("listening")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("exit", (code) => reject(new Error(`server exited ${code}`)));
  });
  return child;
}

function stop(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
  });
}

test("the room server admits members by token and keeps their terrace by account", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cipher-world-"));
  const port = 18000 + Math.floor(Math.random() * 2000);
  let server = await startServer(dir, port);
  try {
    // No token: refused with the sign-in code.
    const stranger = await connect(port, { room: "test-room", id: "w-pretender-01" });
    assert.equal(await stranger.closed, 4401);

    // A member's id is the one in the token, whatever the client claims.
    const a = await connect(port, { room: "test-room", token: signRoomToken(SECRET, mira), id: "w-claimed-id" });
    const welcome = await a.next("welcome");
    assert.equal((welcome.you as Msg).id, mira);
    a.ws.send(JSON.stringify({ t: "hello", name: "Mira", color: "#123456", form: "orb" }));
    a.ws.send(JSON.stringify({ t: "plot:claim", index: 3, title: "Mira's terrace" }));
    await a.next("plot:claim", (m) => (m.plot as Msg).owner === mira);

    // Another member choosing the same name appears under a different one and
    // cannot take the terrace by it.
    const b = await connect(port, { room: "test-room", token: signRoomToken(SECRET, jo) });
    await b.next("welcome");
    b.ws.send(JSON.stringify({ t: "hello", name: "Mira" }));
    const note = await b.next("system", (m) => String(m.text).includes("already called Mira"));
    assert.match(String(note.text), /Mira 2/);
    b.ws.send(JSON.stringify({ t: "plot:update", index: 3, title: "Mine now" }));
    const refused = await b.next("error");
    assert.match(String(refused.message), /not yours/);

    // Opening the world again as Mira replaces the earlier connection.
    const a2 = await connect(port, { room: "test-room", token: signRoomToken(SECRET, mira) });
    const welcomeAgain = await a2.next("welcome");
    assert.equal((welcomeAgain.you as Msg).plot, 3);
    assert.equal(await a.closed, 4000);
    a2.ws.send(JSON.stringify({ t: "ping" }));
    await a2.next("pong");

    a2.ws.close();
    b.ws.close();
    await stop(server);

    // After a restart, the terrace is still Mira's, and only hers.
    server = await startServer(dir, port);
    const a3 = await connect(port, { room: "test-room", token: signRoomToken(SECRET, mira) });
    const after = await a3.next("welcome");
    assert.equal((after.you as Msg).plot, 3);
    const plots = after.plots as Msg[];
    assert.equal(plots.find((p) => p.index === 3)?.owner, mira);
    a3.ws.close();
  } finally {
    await stop(server).catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
});
