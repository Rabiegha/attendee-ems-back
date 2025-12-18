#!/bin/bash

echo "========================================="
echo "   DATABASE PASSWORD FIX"
echo "========================================="

cd /opt/ems-attendee/backend

echo ""
echo "1️⃣ Getting password from .env.production..."
if [ ! -f .env.production ]; then
    echo "❌ .env.production not found!"
    exit 1
fi

POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env.production | cut -d '=' -f 2)
echo "Password found: ${POSTGRES_PASSWORD:0:10}... (truncated for security)"

echo ""
echo "2️⃣ Testing current database connection..."
if docker exec ems-postgres psql -U ems_prod -d ems_production -c "SELECT 1;" &>/dev/null; then
    echo "✅ Database connection already works! No fix needed."
    exit 0
fi

echo "❌ Database authentication failed. Updating PostgreSQL password..."

echo ""
echo "3️⃣ Updating PostgreSQL password..."
docker exec -i ems-postgres psql -U postgres <<EOF
ALTER USER ems_prod WITH PASSWORD '$POSTGRES_PASSWORD';
EOF

echo ""
echo "4️⃣ Testing new connection..."
sleep 2
if docker exec ems-postgres psql -U ems_prod -d ems_production -c "SELECT 1;" &>/dev/null; then
    echo "✅ Database password updated successfully!"
else
    echo "❌ Still failing. Checking if database exists..."
    docker exec ems-postgres psql -U postgres -c "\l" | grep ems_production || {
        echo "Creating database..."
        docker exec ems-postgres psql -U postgres -c "CREATE DATABASE ems_production OWNER ems_prod;"
    }
fi

echo ""
echo "5️⃣ Restarting API container..."
docker compose -f docker-compose.prod.yml restart api

echo ""
echo "6️⃣ Waiting for API to start..."
sleep 10

echo ""
echo "7️⃣ Checking API logs..."
docker logs ems-api --tail 30 | grep -E "(Nest|Error|Prisma|ready|listening)"

echo ""
echo "8️⃣ Testing API health..."
sleep 5
curl -f https://api.attendee.fr/health 2>&1 && echo "✅ API is healthy!" || echo "❌ API still not responding"

echo ""
echo "========================================="
echo "   FIX COMPLETE"
echo "========================================="
