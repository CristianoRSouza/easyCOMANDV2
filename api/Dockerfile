# syntax=docker/dockerfile:1
# =============================================================================
# EasyControl API (NestJS) — imagem de produção, multi-stage.
#
#   docker build --build-arg BUILD_ID=dev -t easysoftsistemas/easycontrol-api:dev .
#   docker run --rm -p 3030:3030 --env-file api.env easysoftsistemas/easycontrol-api:dev
#
# A MESMA imagem serve homologação e produção: Supabase, Stripe, EasyERP-API e segredos entram
# em EXECUÇÃO pelo ambiente da stack (cofre → api.env), nunca no build. Hoje o EasyControl
# precisa de uma imagem por ambiente (a URL do Supabase é embutida no bundle do navegador);
# aqui o navegador não fala com o Supabase, então uma imagem só basta.
# =============================================================================

# ---- build ----
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3030

# Identidade da imagem, para conferir o que está rodando (ex.: t-<árvore do código> no CI).
ARG BUILD_ID=dev
ENV BUILD_ID=${BUILD_ID}

# Usuário não-root (padrão EasySoft: nestjs:nodejs 1001).
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nestjs

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist

USER nestjs
EXPOSE 3030

# Liveness: não depende de Supabase nem de Stripe (rota pública, sem I/O).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3030)+'/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
