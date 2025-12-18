#!/bin/bash

echo "========================================="
echo "   CORS DIAGNOSTIC SCRIPT"
echo "========================================="

echo ""
echo "1️⃣ Checking if containers are running..."
docker ps --filter "name=ems" --format "table {{.Names}}\t{{.Status}}"

echo ""
echo "2️⃣ Checking .env.production CORS configuration..."
if [ -f /opt/ems-attendee/backend/.env.production ]; then
    echo "File exists:"
    grep "API_CORS_ORIGIN" /opt/ems-attendee/backend/.env.production
else
    echo "❌ .env.production NOT FOUND!"
fi

echo ""
echo "3️⃣ Checking API container logs (last 30 lines)..."
docker logs ems-api --tail 30

echo ""
echo "4️⃣ Testing API directly (bypass Nginx)..."
docker exec ems-api curl -I http://localhost:3000/health 2>/dev/null || echo "❌ API not responding"

echo ""
echo "5️⃣ Testing API via Nginx..."
curl -I https://api.attendee.fr/health 2>&1 | head -10

echo ""
echo "6️⃣ Testing CORS preflight request..."
curl -X OPTIONS https://api.attendee.fr/auth/login \
  -H "Origin: https://attendee.fr" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -i 2>&1 | head -20

echo ""
echo "7️⃣ Checking Nginx configuration..."
docker exec ems-nginx cat /etc/nginx/conf.d/default.conf | grep -A 5 "proxy_set_header"

echo ""
echo "========================================="
echo "   DIAGNOSTIC COMPLETE"
echo "========================================="
