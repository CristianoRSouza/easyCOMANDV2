# syntax=docker/dockerfile:1
# =============================================================================
# EasyControl Web (Next.js) — imagem de produção, multi-stage, `output: standalone`.
#
#   docker build --build-arg BUILD_ID=dev -t easysoftsistemas/easycontrol-web:dev .
#   docker run --rm -p 3000:3000 -e EASYCONTROL_API_URL=http://easycontrol-api:3030 \
#     easysoftsistemas/easycontrol-web:dev
#
# A MESMA imagem serve homologação e produção: o endereço da API e as opções de cookie entram em
# EXECUÇÃO pelo ambiente da stack. O build não precisa (nem deve ver) segredo nenhum — o
# navegador só fala com este servidor, e quem tem as chaves do Stripe/Supabase é a API.
# =============================================================================

# ---- dependências (o build precisa das devDependencies) ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx next build

# ---- runtime: só o servidor mínimo, os estáticos e o public/ ----
FROM node:22-alpine AS runtime

# tini: sem um init de verdade o node vira PID 1 e não recebe SIGTERM de forma previsível.
RUN apk add --no-cache tini

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

ARG BUILD_ID=dev
ENV BUILD_ID=${BUILD_ID}

USER node
EXPOSE 3000

# Liveness do próprio Next (`/api/health`): não depende da API, para um problema lá não
# derrubar este contêiner em ciclo de reinício.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" > /dev/null 2>&1 || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
