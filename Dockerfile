# Imagen de producción de Viajes Holy (servidor Node + estáticos de /src)
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8888 \
    HOST=0.0.0.0 \
    UPLOADS_DIR=/data/uploads

WORKDIR /app

# Dependencias primero para aprovechar la caché de capas
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Solo lo que necesita el servidor en ejecución (+ scripts de administración)
COPY server.js ./
COPY src ./src
COPY netlify/functions ./netlify/functions
COPY scripts ./scripts
COPY db ./db

# Carpeta de fotos (se monta como volumen); debe pertenecer a "node"
RUN mkdir -p /data/uploads && chown -R node:node /data

USER node
EXPOSE 8888

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8888/healthz || exit 1

CMD ["node", "server.js"]
