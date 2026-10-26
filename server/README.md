# The room server

The low-latency WebSocket room for the Cipher's 3D world. The Next app can run on
Vercel; this process needs a host that allows a long-lived connection and a
persistent volume.

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
  -v cipher-world:/data \
  -e WORLD_DATA_FILE=/data/world.json \
  cipher-world
```

## Railway

Create a service from this `server/` directory. The included `railway.json` uses
the Dockerfile; add a volume mounted at `/data` and set:

```
WORLD_DATA_FILE=/data/world.json
```

Optionally:

```
WORLD_ROOM_SECRET=<shared invitation key>
WORLD_MAX_PLAYERS=24
WORLD_MAX_BUILDS=1200
```

Then build the Next app with `NEXT_PUBLIC_WORLD_WS_URL=wss://<service>/ws` (and
`NEXT_PUBLIC_WORLD_ROOM_KEY` if a key is set). Without this server, the deployed
Next app uses the HTTP/Postgres room instead — see `docs/world.md`.
