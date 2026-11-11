# The room server

The low-latency WebSocket room for the Cipher's 3D world. The Next app can run on
Vercel; this process needs a host that allows a long-lived connection (Railway,
Render, Fly, a VPS).

## Who gets in

Set `WORLD_TOKEN_SECRET` to the same random value here and on the Next app. The
browser asks `/api/world/token` for a two-minute token before each connect; the
app signs it only for a signed-in member, and this server checks the signature.
The member's opaque world id (the same one the HTTP room uses) becomes their
identity, so:

- builds, terraces and sessions belong to the account, not to a typed name;
- a terrace comes back on the next visit, from any device;
- opening the world in a second tab closes the first instead of duplicating it;
- two people in a room never share a name (a second "Mira" appears as "Mira 2").

In production (`NODE_ENV=production`) the server refuses to start without
`WORLD_TOKEN_SECRET`, unless `WORLD_ALLOW_ANONYMOUS=1` is set on purpose. Locally
it runs without one, link-keyed, as before.

Generate a secret with `openssl rand -base64 32`.

## Where rooms are kept

Set `DATABASE_URL` (the same Neon database as the app) and rooms are stored in
`cipher_world_state`, the table the HTTP room uses. No volume is needed and a
redeploy loses nothing. Writes are version-checked: if the HTTP room changes the
same room, nothing is overwritten; the server reloads the stored world and shows
it to everyone in the room.

Without `DATABASE_URL`, rooms go to a JSON file (`WORLD_DATA_FILE`, default
`data/world.json`), which needs a persistent volume.

Run one instance. Presence and chat are relayed in memory, so members on two
instances would not see each other.

## Run locally

```bash
node server/world-server.mjs
# ws://localhost:8787/ws
# http://localhost:8787/health
```

## Docker

```bash
docker build -t cipher-world ./server
docker run -p 8787:8787 \
  -e WORLD_TOKEN_SECRET=<secret> \
  -e DATABASE_URL=<postgres url> \
  cipher-world
```

## Railway

Create a service from this `server/` directory (the included `railway.json` uses
the Dockerfile) and set:

```
WORLD_TOKEN_SECRET=<same value as the Next app>
DATABASE_URL=<the app's Neon URL>
```

Optionally:

```
WORLD_ROOM_SECRET=<shared invitation key, on top of sign-in>
WORLD_MAX_PLAYERS=24
WORLD_MAX_BUILDS=1200
```

Then set `WORLD_TOKEN_SECRET` on the Next app too, and build it with
`NEXT_PUBLIC_WORLD_WS_URL=wss://<service>/ws` (and `NEXT_PUBLIC_WORLD_ROOM_KEY`
if a key is set). Without this server, the deployed Next app uses the
HTTP/Postgres room instead — see `docs/world.md`.
