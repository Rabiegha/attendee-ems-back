#!/usr/bin/env bash
set -e

# Attendre la DB si besoin (simple backoff)
if [ -n "$DATABASE_URL" ]; then
  echo "Waiting for database..."
  for i in {1..30}; do
    node -e "
      const { Client } = require('pg');
      const c = new Client({ connectionString: process.env.DATABASE_URL });
      c.connect().then(()=>{ console.log('DB up'); process.exit(0); }).catch(()=>process.exit(1));
    " && break || sleep 2
  done
fi

if [ "${RUN_MIGRATIONS}" = "true" ]; then
  echo "Running migrations..."
  npx prisma migrate deploy
  if [ "${RUN_SEEDERS}" = "true" ]; then
    echo "Running seeders..."
    npx prisma db seed || echo "Seeders failed (non-critical), continuing..."
  fi
fi

exec "$@"
