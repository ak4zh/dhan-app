#!/bin/sh
set -e

mkdir -p /app/data

node scripts/migrate.mjs

# Never let a seeding hiccup take the whole container down — the app is
# still usable without an admin (one can be created manually afterwards).
./node_modules/.bin/tsx scripts/seed-admin.ts || echo "[entrypoint] seed-admin.ts failed, continuing startup"

exec node build/index.js