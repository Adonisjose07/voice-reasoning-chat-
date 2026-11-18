# ==========================================
# 1. Dependencias (deps)
# ==========================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ==========================================
# 2. Compilación (builder)
# ==========================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Argumento para forzar invalidación de caché en Dokploy
ARG BUILD_VERSION=1.0.0
ENV BUILD_VERSION=${BUILD_VERSION}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ==========================================
# 3. Imagen de ejecución en producción (runner)
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ARG BUILD_VERSION=1.0.0
ENV BUILD_VERSION=${BUILD_VERSION}

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copiar dependencias y artefactos compilados
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next-build ./.next-build
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

USER nextjs

EXPOSE 3000

CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
