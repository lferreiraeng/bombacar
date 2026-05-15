FROM node:20-bookworm-slim

WORKDIR /app

# Dependências do sistema (curl pro healthcheck; resto vem via --with-deps)
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Instala deps Node primeiro (melhor cache de layer)
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Baixa Chromium + libs nativas necessárias
RUN npx playwright install --with-deps chromium

# Restante do código
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

# Volume é gerenciado pelo Railway (montado em /data via dashboard).
# A diretiva VOLUME do Docker não é aceita lá.

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD curl -fsS http://localhost:${PORT}/api/stats || exit 1

CMD ["node", "server.js"]
