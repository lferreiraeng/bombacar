FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app

# Instala apenas dependências de produção primeiro (melhor cache)
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Restante do código
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

# Volume persistente para data.json
VOLUME ["/data"]

EXPOSE 3000

CMD ["node", "server.js"]
