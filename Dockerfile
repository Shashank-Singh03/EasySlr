# Single-stage image for the EasySLR app. Optimized for reliability/clarity over minimal size
# (a multi-stage `output: "standalone"` build is the size optimization — noted in the README).
FROM node:20-slim

# Prisma needs openssl at runtime; ca-certificates for TLS.
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app

# Install deps first for layer caching. The prisma schema must be present because the `postinstall`
# script runs `prisma generate` (which produces the Linux query engine inside this container).
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# Build. SKIP_ENV_VALIDATION lets the build run without runtime secrets; env is injected at run time.
COPY . .
ENV SKIP_ENV_VALIDATION=1
RUN pnpm build

ENV NODE_ENV=production
EXPOSE 3000

# Apply migrations and seed (idempotent) against the linked DB, then serve.
CMD ["sh", "-c", "pnpm prisma migrate deploy && pnpm db:seed && pnpm start"]
