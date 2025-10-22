#!/bin/bash

# Seed attendee permissions
echo "🌱 Seeding attendee permissions..."

docker-compose -f docker-compose.dev.yml exec api npx ts-node prisma/seeders/attendee-permissions.ts

echo "✅ Done!"
