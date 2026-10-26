# The Cipher — WebSocket room server
#
# A tiny, self-contained image for the low-latency room. The Next app can live
# anywhere; this process needs a persistent volume for data/world.json.
#
#   docker build -t cipher-world ./server
#   docker run -p 8787:8787 -v cipher-world:/data \
#     -e WORLD_DATA_FILE=/data/world.json cipher-world

FROM node:22-alpine AS runtime
WORKDIR /app

RUN npm init -y >/dev/null 2>&1 && npm install --omit=dev ws@8.22.0 >/dev/null 2>&1

COPY world-server.mjs ./

ENV NODE_ENV=production \
    PORT=8787 \
    WORLD_DATA_FILE=/data/world.json

RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=4s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "world-server.mjs"]
