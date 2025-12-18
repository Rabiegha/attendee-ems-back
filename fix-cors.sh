#!/bin/bash

echo "========================================="
echo "   CORS FIX SCRIPT"
echo "========================================="

cd /opt/ems-attendee/backend

echo ""
echo "1️⃣ Backing up current .env.production..."
cp .env.production .env.production.backup.$(date +%Y%m%d_%H%M%S)

echo ""
echo "2️⃣ Ensuring CORS origins are correct..."
if grep -q "API_CORS_ORIGIN" .env.production; then
    echo "Updating existing CORS config..."
    sed -i 's|^API_CORS_ORIGIN=.*|API_CORS_ORIGIN=https://attendee.fr,https://www.attendee.fr|g' .env.production
else
    echo "Adding CORS config..."
    echo "API_CORS_ORIGIN=https://attendee.fr,https://www.attendee.fr" >> .env.production
fi

echo "New CORS config:"
grep "API_CORS_ORIGIN" .env.production

echo ""
echo "3️⃣ Restarting API container..."
docker compose -f docker-compose.prod.yml restart api

echo ""
echo "4️⃣ Waiting for API to start..."
sleep 5

echo ""
echo "5️⃣ Checking API logs..."
docker logs ems-api --tail 20

echo ""
echo "6️⃣ Testing CORS..."
curl -X OPTIONS https://api.attendee.fr/auth/login \
  -H "Origin: https://attendee.fr" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -i 2>&1 | grep -i "access-control"

echo ""
echo "========================================="
echo "   FIX COMPLETE - Try refreshing browser"
echo "========================================="
