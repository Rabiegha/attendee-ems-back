#!/bin/bash

# ========================================
# Script de seed local pour développement
# ========================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Seed Database - Development${NC}"
echo -e "${GREEN}========================================${NC}"

# Vérifier que Docker est en cours
if ! docker ps >/dev/null 2>&1; then
    echo -e "${RED}ERROR: Docker is not running${NC}"
    exit 1
fi

# Vérifier que le container PostgreSQL existe
if ! docker ps -a --format '{{.Names}}' | grep -q "ems-postgres"; then
    echo -e "${RED}ERROR: PostgreSQL container 'ems-postgres' not found${NC}"
    echo "Start the development environment first: docker compose up -d"
    exit 1
fi

# Demander confirmation
echo -e "\n${YELLOW}⚠️  WARNING: This will ERASE all existing data!${NC}"
echo -e "This will:"
echo "  - Delete all attendees, events, users, organizations"
echo "  - Create 3 test organizations (Choyou, ACME Events, TechConf)"
echo "  - Create 7 test users with different roles"
echo "  - Create 4 test events with registrations"
echo "  - Create fake attendees and registrations"
echo ""
echo -e "${YELLOW}All passwords will be 'admin123', 'manager123', or 'staff123'${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
echo

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Aborted."
    exit 0
fi

# Exécuter le seed
echo -e "\n${YELLOW}Executing development seed...${NC}"

docker exec -i ems-postgres psql -U ems_user -d ems_development < seed-dev.sql

echo -e "\n${GREEN}✅ Development seed completed successfully!${NC}"

echo -e "\n${GREEN}🔑 Test credentials:${NC}"
echo ""
echo "Choyou Organization:"
echo "  - admin@choyou.fr / admin123 (Super Admin)"
echo "  - manager@choyou.fr / manager123 (Manager)"
echo "  - staff@choyou.fr / staff123 (Staff)"
echo ""
echo "ACME Events Organization:"
echo "  - admin@acme.com / admin123 (Admin)"
echo "  - manager@acme.com / manager123 (Manager)"
echo ""
echo "TechConf Organization:"
echo "  - admin@techconf.com / admin123 (Admin)"
echo ""

echo -e "\n${GREEN}📊 Database summary:${NC}"
docker exec -i ems-postgres psql -U ems_user -d ems_development -c "
    SELECT 
        'Organizations' as table_name, COUNT(*)::text as count FROM organizations
    UNION ALL
    SELECT 'Users', COUNT(*)::text FROM users
    UNION ALL
    SELECT 'Events', COUNT(*)::text FROM events
    UNION ALL
    SELECT 'Attendees', COUNT(*)::text FROM attendees
    UNION ALL
    SELECT 'Registrations', COUNT(*)::text FROM registrations;
"

echo -e "\n${GREEN}🚀 Your development environment is ready!${NC}"
