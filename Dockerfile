# syntax=docker/dockerfile:1
# BMN Connect — Web (Next.js standalone). Build context = repo root.
#   docker build -f apps/web/Dockerfile -t bmn-web \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api .

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@11.6.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY apps/omni/package.json ./apps/omni/
# Scripts off (pnpm 11 hard-fails on un-approved build scripts in CI); sharp is
# optional for Next image optimisation, so rebuild it best-effort.
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm rebuild sharp || true

FROM deps AS build
COPY apps/web ./apps/web
ENV NEXT_TELEMETRY_DISABLED=1
# Baked into the client bundle at build time (used for the API/omni rewrites).
ARG NEXT_PUBLIC_API_URL=http://localhost:4400/api
ARG NEXT_PUBLIC_OMNI_URL=http://localhost:4500/omni
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_OMNI_URL=$NEXT_PUBLIC_OMNI_URL
RUN pnpm --filter @bmn/web build

# ---- runner: minimal standalone server ----
FROM node:22-slim AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
# `output: 'standalone'` emits a self-contained server + trimmed node_modules.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3400
ENV PORT=3400 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
