# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Base
# -----------------------------------------------------------------------------
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# -----------------------------------------------------------------------------
# Dependencies
# -----------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# -----------------------------------------------------------------------------
# Production build (Next.js standalone)
# -----------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public URLs: pass at image build time so client bundles match your Azure host.
# Example: docker build --build-arg NEXT_PUBLIC_APP_URL=https://myapp.azurewebsites.net .
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_WS_URL=

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

# Webpack produces a reliable `standalone` layout for Docker (Turbopack tracing can nest paths).
RUN npm run build

# -----------------------------------------------------------------------------
# Production runtime
# -----------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Runtime overrides (Azure App Settings) apply here for non-inlined server code.
# NEXT_PUBLIC_* in the running server are still those from build unless you rebuild.

CMD ["node", "server.js"]

# -----------------------------------------------------------------------------
# Local development (docker-compose)
# -----------------------------------------------------------------------------
FROM deps AS development
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
