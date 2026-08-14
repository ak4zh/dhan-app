#!/bin/sh
set -e

mkdir -p /app/data

node scripts/migrate.mjs

exec node build/index.js
