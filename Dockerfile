# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.2.0 --activate

# Install deps in their own layer so `pnpm install` is cache-skipped on
# source-only changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# SvelteKit's postbuild "analyse" step imports every server module (db client,
# auth.ts) to determine route prerendering — which means it actually runs
# their top-level code. db/client.ts opens the DB connection eagerly, and
# better-auth throws (not warns) if BETTER_AUTH_SECRET is unset. Neither of
# these placeholder values reaches the runtime image or gets baked into the
# build output — the real ones come from CapRover's env vars when the
# container actually starts and re-imports this code fresh.
RUN mkdir -p data
ENV BETTER_AUTH_SECRET=build-time-placeholder-unused-at-runtime
RUN pnpm run build

# ---------------------------------------------------------------------------

FROM node:24-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=80

# node_modules is carried over as-is (including devDependencies) rather than
# pruned, so `scripts/seed-admin.ts` can still be run one-off via `tsx` inside
# the running container (see README) without a separate install step.
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

# CapRover: add a Persistent Directory mapped to this path so the SQLite file
# (and better-auth's tables in it) survive redeploys.
VOLUME ["/app/data"]

EXPOSE 80

ENTRYPOINT ["./docker-entrypoint.sh"]
