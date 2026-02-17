# syntax=docker/dockerfile:1
FROM node:20-bullseye-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Use npm install when no lockfile is present
RUN --mount=type=cache,target=/root/.npm \
  if [ -f package-lock.json ]; then npm ci --prefer-offline; else npm install --prefer-offline; fi

FROM base AS test
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
RUN --mount=type=cache,target=/root/.cache/prisma npx prisma generate
CMD ["npm", "test"]

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
RUN --mount=type=cache,target=/root/.cache/prisma npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary

# Create non-root user
RUN addgroup --system app && adduser --system --ingroup app app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

# Prisma CLI sometimes needs to write into these dirs (engines/cache). Avoid a slow recursive chown over all of /app.
# Next.js image optimization cache needs write access to /app/.next/cache.
RUN mkdir -p /app/.next/cache/images && \
    chown -R app:app /app/node_modules/prisma /app/node_modules/@prisma /app/node_modules/.prisma /app/.next/cache || true

USER app
EXPOSE 3000
CMD ["npm", "run", "start"]
