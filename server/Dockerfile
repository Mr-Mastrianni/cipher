# The Cipher — WebSocket room server
#
# A tiny, self-contained image for the low-latency room. The Next app can live
# anywhere. Set WORLD_TOKEN_SECRET (the same value as on the Next app) so only
# signed-in members get in, and DATABASE_URL so rooms are kept in Postgres and
# no volume is needed.
#
#   docker build -t cipher-world ./server
#   docker run -p 8787:8787 \
#     -e WORLD_TOKEN_SECRET=… -e DATABASE_URL=postgres://… cipher-world

FROM node:22-alpine AS runtime
WORKDIR /app

RUN npm init -y >/dev/null 2>&1 \
  && npm install --omit=dev ws@8.22.0 @neondatabase/serverless@1.2.0 >/dev/null 2>&1

COPY world-server.mjs room-token.mjs ./

ENV NODE_ENV=production \
    PORT=8787 \
    WORLD_DATA_FILE=/data/world.json

# Only used when DATABASE_URL is not set.
RUN mkdir -p /data
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=4s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "world-server.mjs"]
