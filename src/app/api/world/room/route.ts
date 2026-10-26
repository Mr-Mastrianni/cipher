/**
 * `/api/world/room` — the room transport for deployments without a WebSocket.
 *
 * Vercel cannot hold a socket open. This route gives the world a working
 * multiplayer room on the same deployment: presence is a small row per member,
 * the shared world is one JSON document per room, and chat is append-only. The
 * client polls at a little over 1 Hz and interpolates bodies, while builds,
 * terraces, sessions and signals appear on the next poll.
 *
 * It is deliberately not a general-purpose chat service. The standalone
 * `server/world-server.mjs` remains the lower-latency option for a host with a
 * long-lived process, and the client prefers it when `NEXT_PUBLIC_WORLD_WS_URL`
 * is set or the app is running locally.
 *
 * Storage: `cipher_world_presence`, `cipher_world_state`, `cipher_world_chat`.
 * The tables are created idempotently on first use, so a fresh database needs no
 * migration step. They are additive and touch no existing Cipher table.
 */

import { randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";

import { clerkConfigured, getCurrentUser } from "@/lib/auth";
import {
  applyWorldAction,
  cleanColor,
  cleanNumber,
  cleanPlayerId,
  cleanText,
  emptyWorld,
  isWorldAction,
  resolveIdentity,
  sanitizeRoom,
  WORLD_ROOM_MAX_PLAYERS,
  type RoomChat,
  type RoomPlayer,
  type WorldDoc,
} from "@/lib/world/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAT_WINDOW_MS = 3000;
const CHAT_MAX = 3;
const MOVE_WINDOW_MS = 1000;
const MOVE_MAX = 8;

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
const db = sql as unknown as ((strings: TemplateStringsArray, ...values: unknown[]) => Promise<Array<Record<string, unknown>>>) | null;

const globalForWorld = globalThis as unknown as {
  __cipherWorldTables?: Promise<void>;
  __cipherWorldLimits?: Map<string, number[]>;
};

const limits = (globalForWorld.__cipherWorldLimits ??= new Map());

function rateLimit(key: string, count: number, windowMs: number) {
  const now = Date.now();
  const bucket = limits.get(key) ?? [];
  while (bucket.length > 0 && now - bucket[0] > windowMs) bucket.shift();
  if (bucket.length >= count) return false;
  bucket.push(now);
  limits.set(key, bucket);
  return true;
}

async function ensureTables(): Promise<void> {
  if (!db) return;
  if (!globalForWorld.__cipherWorldTables) {
    globalForWorld.__cipherWorldTables = (async () => {
      await db`
        CREATE TABLE IF NOT EXISTS cipher_world_presence (
          room text NOT NULL,
          player_id text NOT NULL,
          data jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (room, player_id)
        )
      `;
      await db`
        CREATE INDEX IF NOT EXISTS cipher_world_presence_room_idx
        ON cipher_world_presence (room, updated_at DESC)
      `;
      await db`
        CREATE TABLE IF NOT EXISTS cipher_world_state (
          room text PRIMARY KEY,
          builds jsonb NOT NULL DEFAULT '[]'::jsonb,
          plots jsonb NOT NULL DEFAULT '{}'::jsonb,
          session jsonb,
          signals jsonb NOT NULL DEFAULT '[]'::jsonb,
          version bigint NOT NULL DEFAULT 1,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await db`
        CREATE TABLE IF NOT EXISTS cipher_world_chat (
          id bigserial PRIMARY KEY,
          room text NOT NULL,
          player_id text NOT NULL,
          name text NOT NULL,
          color text NOT NULL,
          channel text NOT NULL DEFAULT 'world',
          text text NOT NULL,
          at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await db`
        CREATE INDEX IF NOT EXISTS cipher_world_chat_room_idx
        ON cipher_world_chat (room, id)
      `;
    })().catch((error) => {
      // Do not cache a failed initialisation: the next request should try again.
      globalForWorld.__cipherWorldTables = undefined;
      throw error;
    });
  }
  await globalForWorld.__cipherWorldTables;
}

function jsonValue(value: unknown, fallback: unknown) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return fallback;
    }
  }
  return value;
}

function playerFromRow(value: unknown): RoomPlayer | null {
  const data = jsonValue(value, null) as Record<string, unknown> | null;
  if (!data) return null;
  const id = cleanPlayerId(data.id);
  if (!id) return null;
  return {
    id,
    name: cleanText(data.name, 32) || "A traveller",
    color: cleanColor(data.color),
    form:
      data.form === "orb" || data.form === "wanderer" || data.form === "cloak"
        ? data.form
        : "cloak",
    crest: cleanText(data.crest, 4) || "\u2726",
    x: cleanNumber(data.x),
    y: cleanNumber(data.y),
    z: cleanNumber(data.z),
    yaw: cleanNumber(data.yaw),
    pitch: cleanNumber(data.pitch),
    mode: data.mode === "fly" ? "fly" : "walk",
    region: cleanText(data.region, 24),
    at: cleanNumber(data.at, Date.now()),
  };
}

function worldFromRow(row: Record<string, unknown> | undefined): WorldDoc {
  if (!row) return emptyWorld();
  return {
    builds: (jsonValue(row.builds, []) as WorldDoc["builds"]) ?? [],
    plots: (jsonValue(row.plots, {}) as WorldDoc["plots"]) ?? {},
    session: (jsonValue(row.session, null) as WorldDoc["session"]) ?? null,
    signals: (jsonValue(row.signals, []) as WorldDoc["signals"]) ?? [],
    version: Number(row.version ?? 1) || 1,
  };
}

async function loadWorld(room: string): Promise<WorldDoc> {
  if (!db) throw new Error("The world's database is not configured.");
  const rows = await db`
    SELECT builds, plots, session, signals, version
    FROM cipher_world_state
    WHERE room = ${room}
    LIMIT 1
  `;
  if (rows.length === 0) {
    await db`
      INSERT INTO cipher_world_state (room, builds, plots, session, signals, version)
      VALUES (${room}, '[]'::jsonb, '{}'::jsonb, NULL, '[]'::jsonb, 1)
      ON CONFLICT (room) DO NOTHING
    `;
    return loadWorld(room);
  }
  return worldFromRow(rows[0]);
}

async function saveWorld(room: string, world: WorldDoc, expectedVersion: number): Promise<boolean> {
  if (!db) return false;
  const rows = await db`
    UPDATE cipher_world_state
    SET builds = ${JSON.stringify(world.builds)}::jsonb,
        plots = ${JSON.stringify(world.plots)}::jsonb,
        session = ${world.session ? JSON.stringify(world.session) : null}::jsonb,
        signals = ${JSON.stringify(world.signals)}::jsonb,
        version = ${world.version}::bigint,
        updated_at = now()
    WHERE room = ${room} AND version = ${expectedVersion}::bigint
    RETURNING version
  `;
  return rows.length > 0;
}

async function upsertPresence(room: string, player: RoomPlayer) {
  if (!db) return;
  await db`
    INSERT INTO cipher_world_presence (room, player_id, data, updated_at)
    VALUES (${room}, ${player.id}, ${JSON.stringify(player)}::jsonb, now())
    ON CONFLICT (room, player_id)
    DO UPDATE SET data = EXCLUDED.data, updated_at = now()
  `;
}

async function prunePresence(room: string) {
  if (!db) return;
  await db`
    DELETE FROM cipher_world_presence
    WHERE room = ${room} AND updated_at < now() - interval '5 minutes'
  `;
}

async function leave(room: string, playerId: string) {
  if (!db || !playerId) return;
  await db`
    DELETE FROM cipher_world_presence
    WHERE room = ${room} AND player_id = ${playerId}
  `;
}

async function readPresence(room: string): Promise<RoomPlayer[]> {
  if (!db) return [];
  const rows = await db`
    SELECT data FROM cipher_world_presence
    WHERE room = ${room}
      AND updated_at > now() - interval '20 seconds'
    ORDER BY updated_at DESC
    LIMIT ${WORLD_ROOM_MAX_PLAYERS}
  `;
  const players: RoomPlayer[] = [];
  for (const row of rows) {
    const player = playerFromRow(row.data);
    if (player) players.push(player);
  }
  return players;
}

function chatFromRow(row: Record<string, unknown>): RoomChat {
  return {
    id: Number(row.id),
    from: cleanText(row.name, 32) || "A traveller",
    color: cleanColor(row.color),
    text: cleanText(row.text, 400),
    where: cleanText(row.channel, 32) || "world",
    at: Number(row.at_ms ?? Date.now()),
  };
}

async function readChat(room: string, since: number): Promise<RoomChat[]> {
  if (!db) return [];
  const rows =
    since > 0
      ? await db`
          SELECT id, name, color, channel, text,
                 (extract(epoch FROM at) * 1000)::bigint AS at_ms
          FROM cipher_world_chat
          WHERE room = ${room} AND id > ${since}::bigint
          ORDER BY id ASC
          LIMIT 50
        `
      : await db`
          SELECT id, name, color, channel, text,
                 (extract(epoch FROM at) * 1000)::bigint AS at_ms
          FROM cipher_world_chat
          WHERE room = ${room}
          ORDER BY id DESC
          LIMIT 50
        `;
  const messages = rows.map(chatFromRow);
  return since > 0 ? messages : messages.reverse();
}

interface SnapshotOptions {
  room: string;
  playerId: string;
  sinceVersion: number;
  chatSince: number;
  includeWorld: boolean;
}

async function snapshot({ room, playerId, sinceVersion, chatSince, includeWorld }: SnapshotOptions) {
  const [world, players, chat] = await Promise.all([
    includeWorld || sinceVersion === 0 ? loadWorld(room) : Promise.resolve(null),
    readPresence(room),
    readChat(room, chatSince),
  ]);
  const state = world ?? (await loadWorld(room));
  const yourPlot = Object.values(state.plots).find((plot) => plot.owner === playerId);
  const worldChanged = includeWorld || sinceVersion !== state.version;
  return {
    ok: true,
    room,
    now: Date.now(),
    you: { id: playerId, plot: yourPlot?.index ?? null },
    players,
    world: worldChanged ? state : undefined,
    version: state.version,
    chat,
  };
}

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : "The room store failed.";
  return Response.json({ ok: false, error: message }, { status: 503, headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request): Promise<Response> {
  try {
    if (!db) return Response.json({ ok: false, error: "The room store is not configured." }, { status: 503 });
    const user = await getCurrentUser();
    if (clerkConfigured && !user) {
      return Response.json({ ok: false, error: "Sign in to join the room." }, { status: 401 });
    }
    await ensureTables();
    const url = new URL(request.url);
    const room = sanitizeRoom(url.searchParams.get("room"));
    const identity = resolveIdentity(user?.id ?? null, null, url.searchParams.get("playerId") ?? "");
    const sinceVersion = Number(url.searchParams.get("version") ?? 0) || 0;
    const chatSince = Number(url.searchParams.get("chatSince") ?? 0) || 0;
    return Response.json(
      await snapshot({
        room,
        playerId: identity.id,
        sinceVersion,
        chatSince,
        includeWorld: sinceVersion === 0,
      }),
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return errorStatus(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    if (!db) return Response.json({ ok: false, error: "The room store is not configured." }, { status: 503 });
    const user = await getCurrentUser();
    if (clerkConfigured && !user) {
      return Response.json({ ok: false, error: "Sign in to join the room." }, { status: 401 });
    }
    await ensureTables();
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return Response.json({ ok: false, error: "A room action is required." }, { status: 400 });

    const room = sanitizeRoom(body.room);
    const action = String(body.action ?? "");
    const supplied = (body.player ?? {}) as Record<string, unknown>;
    const identity = resolveIdentity(
      user?.id ?? null,
      {
        ...supplied,
        id: supplied.id || `w-${randomBytes(8).toString("hex")}`,
      },
    );
    if (!identity.id) {
      return Response.json({ ok: false, error: "A player id is required." }, { status: 400 });
    }

    const now = Date.now();

    if (action === "hello" || action === "move") {
      if (action === "hello") await prunePresence(room);
      if (!rateLimit(`${identity.id}:move`, MOVE_MAX, MOVE_WINDOW_MS)) {
        return Response.json({ ok: true, throttled: true, id: identity.id });
      }
      const presence: RoomPlayer = {
        ...identity,
        x: Math.max(-900, Math.min(900, cleanNumber(supplied.x))),
        y: Math.max(-90, Math.min(2700, cleanNumber(supplied.y))),
        z: Math.max(-900, Math.min(900, cleanNumber(supplied.z))),
        yaw: cleanNumber(supplied.yaw),
        pitch: cleanNumber(supplied.pitch),
        mode: supplied.mode === "fly" ? "fly" : "walk",
        region: cleanText(supplied.region, 24),
        at: now,
      };
      await upsertPresence(room, presence);
      if (action === "hello") {
        return Response.json(
          await snapshot({ room, playerId: identity.id, sinceVersion: 0, chatSince: 0, includeWorld: true }),
          { headers: { "cache-control": "no-store" } },
        );
      }
      return Response.json({ ok: true, id: identity.id }, { headers: { "cache-control": "no-store" } });
    }

    if (action === "chat") {
      if (!rateLimit(`${identity.id}:chat`, CHAT_MAX, CHAT_WINDOW_MS)) {
        return Response.json({ ok: false, error: "Easy — one message at a time." }, { status: 429 });
      }
      const text = cleanText(body.text, 400);
      if (!text) return Response.json({ ok: false, error: "A message is required." }, { status: 400 });
      const channel = cleanText(body.where, 32) || "world";
      const rows = await db`
        INSERT INTO cipher_world_chat (room, player_id, name, color, channel, text)
        VALUES (${room}, ${identity.id}, ${identity.name}, ${identity.color}, ${channel}, ${text})
        RETURNING id, name, color, channel, text,
                  (extract(epoch FROM at) * 1000)::bigint AS at_ms
      `;
      const message = rows[0] ? chatFromRow(rows[0]) : null;
      return Response.json(
        { ok: true, id: identity.id, chat: message ? [message] : [] },
        { headers: { "cache-control": "no-store" } },
      );
    }

    if (action === "leave") {
      await leave(room, identity.id);
      return Response.json({ ok: true });
    }

    if (!isWorldAction(action)) {
      return Response.json({ ok: false, error: "Unknown room action." }, { status: 400 });
    }

    // World actions are optimistic: read, apply, write if the version still
    // matches. A concurrent piece or terrace claim retries rather than overwrites.
    let lastError: string | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const current = await loadWorld(room);
      const result = applyWorldAction(current, action, body, identity, now);
      if (!result.ok) {
        return Response.json({ ok: false, error: result.error ?? "The world refused that." }, { status: 409 });
      }
      if (!result.changed) {
        return Response.json(
          await snapshot({ room, playerId: identity.id, sinceVersion: 0, chatSince: Number(body.chatSince ?? 0) || 0, includeWorld: true }),
          { headers: { "cache-control": "no-store" } },
        );
      }
      const saved = await saveWorld(room, result.world, current.version);
      if (saved) {
        return Response.json(
          await snapshot({ room, playerId: identity.id, sinceVersion: 0, chatSince: Number(body.chatSince ?? 0) || 0, includeWorld: true }),
          { headers: { "cache-control": "no-store" } },
        );
      }
      lastError = "Another member changed the room at the same moment.";
    }
    return Response.json({ ok: false, error: lastError ?? "The room is busy." }, { status: 409 });
  } catch (error) {
    return errorStatus(error);
  }
}

/** A tiny probe for uptime checks and for the client's transport decision. */
export async function HEAD(): Promise<Response> {
  return new Response(null, {
    status: db ? 204 : 503,
    headers: { "cache-control": "no-store" },
  });
}
