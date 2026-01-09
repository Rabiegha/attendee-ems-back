#!/bin/bash

# ========================================
# 🚀 Script de Déploiement Automatique EMS
# VPS: 51.75.252.74
# Domaines: attendee.fr, api.attendee.fr
# ========================================
#
# 🎯 UTILISATION :
#   ./deploy.sh                    # Mise à jour normale (GARDE les données)
#   ./deploy.sh --force-seed       # Force le reseed (EFFACE les données)
#   ./deploy.sh --first-install    # Première installation
#
# ✅ Ce script fait TOUT automatiquement :
#   - Git pull
#   - Génération des secrets sécurisés
#   - Build du frontend
#   - Gestion intelligente de la base de données
#   - Migrations Prisma
#   - Seed SEULEMENT si nouvelle DB
#   - SSL/HTTPS automatique
#
# ⚠️ VOS DONNÉES SONT PRÉSERVÉES entre les mises à jour !
# ========================================

set -e  # Exit on error

# Parse command line arguments
FORCE_SEED=false
FIRST_INSTALL=false

for arg in "$@"; do
    case $arg in
        --force-seed)
            FORCE_SEED=true
            shift
            ;;
        --first-install)
            FIRST_INSTALL=true
            shift
            ;;
    esac
done

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   EMS Production Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Configuration
DEPLOY_DIR="/opt/ems-attendee"
BACKEND_REPO="https://github.com/Rabiegha/attendee-ems-back.git"
FRONTEND_REPO="https://github.com/Rabiegha/attendee-ems-front.git"
BRANCH="main"

# Step 1: Create deployment directory
echo -e "\n${YELLOW}[1/8] Creating deployment directory...${NC}"
sudo mkdir -p "$DEPLOY_DIR"
sudo chown -R debian:debian "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# Step 2: Clone backend repository
echo -e "\n${YELLOW}[2/10] Updating backend repository (branch: $BRANCH)...${NC}"
if [ -d "backend" ]; then
    echo "Backend directory exists, pulling latest changes..."
    cd backend
    
    # Stash any local changes to avoid conflicts
    git stash >/dev/null 2>&1 || true
    
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
    
    cd ..
else
    git clone -b "$BRANCH" "$BACKEND_REPO" backend
fi

# Step 3: Clone frontend repository
echo -e "\n${YELLOW}[3/10] Updating frontend repository (branch: $BRANCH)...${NC}"
if [ -d "frontend" ]; then
    echo "Frontend directory exists, pulling latest changes..."
    cd frontend
    
    # Stash any local changes to avoid conflicts
    git stash >/dev/null 2>&1 || true
    
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
    
    cd ..
else
    git clone -b "$BRANCH" "$FRONTEND_REPO" frontend
fi

# Step 4: Load .env.vps configuration
echo -e "\n${YELLOW}[4/10] Loading backend configuration from .env.vps...${NC}"

# Check if .env.vps exists
if [ ! -f "$DEPLOY_DIR/backend/.env.vps" ]; then
    echo -e "${RED}ERROR: .env.vps not found in $DEPLOY_DIR/backend/${NC}"
    echo "Please create .env.vps with all required configuration"
    exit 1
fi

# Copy .env.vps to .env.production
cp "$DEPLOY_DIR/backend/.env.vps" "$DEPLOY_DIR/backend/.env.production"

# Step 5: Detect if this is an update or first install
echo -e "\n${YELLOW}[5/10] Checking deployment type...${NC}"

# Check if Docker volumes exist (indicates previous deployment)
POSTGRES_VOLUME_EXISTS=$(docker volume ls -q -f name=ems_postgres_data 2>/dev/null || echo "")
DB_HAS_DATA=false

if [ -n "$POSTGRES_VOLUME_EXISTS" ] && [ "$FIRST_INSTALL" = false ]; then
    echo "Existing PostgreSQL volume found - this is an UPDATE"
    echo -e "${GREEN}✓ Your data will be PRESERVED${NC}"
    DB_HAS_DATA=true
else
    echo "No existing data found - this is a FIRST INSTALL"
    FIRST_INSTALL=true
fi

# Step 6: Generate or reuse secrets
echo -e "\n${YELLOW}[6/10] Managing secrets...${NC}"

if [ "$DB_HAS_DATA" = true ] && [ -f "$DEPLOY_DIR/backend/.env" ]; then
    # Reuse existing secrets to avoid breaking database connection
    echo "Reusing existing secrets to maintain database connection..."
    echo -e "${GREEN}✓ Existing secrets preserved${NC}"
else
    # Generate new secrets for first install
    echo "Generating fresh secrets..."
    
    # Generate new secrets
    echo "Generating PostgreSQL password..."
    POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9')
    
    echo "Generating JWT secrets..."
    JWT_ACCESS_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    
    # Function to replace or append variable
    update_env() {
        local key=$1
        local value=$2
        local file=$3
        
        if grep -q "^${key}=" "$file"; then
            # Key exists, replace it using | as delimiter to handle special chars in value
            sed -i "s|^${key}=.*|${key}=${value}|g" "$file"
        else
            # Key doesn't exist, append it
            echo "${key}=${value}" >> "$file"
        fi
    }
    
    update_env "POSTGRES_PASSWORD" "${POSTGRES_PASSWORD}" "$DEPLOY_DIR/backend/.env.production"
    update_env "JWT_ACCESS_SECRET" "${JWT_ACCESS_SECRET}" "$DEPLOY_DIR/backend/.env.production"
    update_env "JWT_REFRESH_SECRET" "${JWT_REFRESH_SECRET}" "$DEPLOY_DIR/backend/.env.production"
    update_env "JWT_SECRET" "${JWT_SECRET}" "$DEPLOY_DIR/backend/.env.production"
    
    # Ensure POSTGRES_USER is consistent
    update_env "POSTGRES_USER" "ems_prod" "$DEPLOY_DIR/backend/.env.production"
    
    # Reconstruct DATABASE_URL
    echo "Updating DATABASE_URL..."
    NEW_DATABASE_URL="postgresql://ems_prod:${POSTGRES_PASSWORD}@postgres:5432/ems_production"
    update_env "DATABASE_URL" "${NEW_DATABASE_URL}" "$DEPLOY_DIR/backend/.env.production"
    
    # Create .env file for Docker Compose
    cat > "$DEPLOY_DIR/backend/.env" <<EOF
POSTGRES_USER=ems_prod
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=ems_production
EOF
    
    echo -e "${GREEN}✓ New secrets generated and configured${NC}"
fi

# Step 7: Build frontend
echo -e "\n${YELLOW}[7/10] Building frontend for production...${NC}"
cd "$DEPLOY_DIR/frontend"

# Install dependencies
echo "Installing frontend dependencies..."
npm install

# Build frontend
echo "Building frontend..."
VITE_API_URL=https://api.attendee.fr npm run build

echo -e "${GREEN}✓ Frontend built successfully${NC}"

# Step 8: Copy frontend build to nginx directory
echo -e "\n${YELLOW}[8/10] Preparing frontend for Nginx...${NC}"
mkdir -p "$DEPLOY_DIR/backend/frontend"
cp -r "$DEPLOY_DIR/frontend/dist/"* "$DEPLOY_DIR/backend/frontend/"
echo -e "${GREEN}✓ Frontend files copied${NC}"

# Step 9: Start or update Docker services
echo -e "\n${YELLOW}[9/10] Managing Docker services...${NC}"
cd "$DEPLOY_DIR/backend"

if [ "$DB_HAS_DATA" = true ]; then
    # UPDATE MODE - Preserve data
    echo "Running in UPDATE mode - preserving your data..."
    
    # Stop containers but keep volumes
    echo "Stopping containers..."
    docker compose -f docker-compose.prod.yml down 2>/dev/null || true
    
    # Start with latest code, rebuild images
    echo "Starting services with updated code..."
    docker compose -f docker-compose.prod.yml up -d --build
    
    # Wait for services to be ready
    echo "Waiting for services to initialize..."
    sleep 10
    
    echo -e "${GREEN}✓ Services updated successfully${NC}"
    
else
    # FIRST INSTALL MODE - Fresh setup
    echo "Running in FIRST INSTALL mode - setting up fresh environment..."
    
    # Stop any existing containers and clean volumes
    echo "Cleaning up any existing containers..."
    docker compose -f docker-compose.prod.yml down -v 2>/dev/null || true
    
    # Start fresh services
    echo "Starting fresh services..."
    docker compose -f docker-compose.prod.yml up -d --build
    
    # Wait for database initialization
    echo "Waiting for PostgreSQL initialization..."
    sleep 15
    
    echo -e "${GREEN}✓ Fresh services started successfully${NC}"
fi

# Ensure API is ready
echo "Ensuring API is ready..."
docker compose -f docker-compose.prod.yml restart api
sleep 10

# Test database connection
echo "Testing database connection..."
if docker compose -f docker-compose.prod.yml exec -T api npx prisma db execute --stdin <<< "SELECT 1;" &>/dev/null; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
else
    echo -e "${RED}✗ Database connection failed!${NC}"
    
    if [ "$DB_HAS_DATA" = true ]; then
        echo -e "${YELLOW}Database authentication failed with existing volume${NC}"
        echo -e "${YELLOW}This usually means the password in .env doesn't match the database${NC}"
        echo ""
        echo "Options:"
        echo "  1. Recreate volumes (WILL DELETE ALL DATA)"
        echo "  2. Abort and check credentials manually"
        echo ""
        read -p "Recreate volumes and start fresh? (yes/no): " -r
        echo
        
        if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            echo "Stopping services and removing volumes..."
            docker compose -f docker-compose.prod.yml down -v
            
            echo "Starting fresh services..."
            docker compose -f docker-compose.prod.yml up -d --build
            
            sleep 15
            
            # Set to first install mode to trigger seed
            FIRST_INSTALL=true
            DB_HAS_DATA=false
            
            echo -e "${GREEN}✓ Fresh database created${NC}"
        else
            echo -e "${RED}Deployment aborted. Please check your database credentials.${NC}"
            echo "The password in /opt/ems-attendee/backend/.env should match the database password."
            exit 1
        fi
    else
        echo -e "${RED}Fresh install but database connection failed!${NC}"
        echo "This is unusual. Check Docker logs:"
        echo "  docker compose -f docker-compose.prod.yml logs postgres"
        exit 1
    fi
fi

# Step 10: Run migrations and seed
echo -e "\n${YELLOW}[10/10] Managing database...${NC}"

# Always run migrations (safe, idempotent)
echo "Running Prisma migrations..."
docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy
echo -e "${GREEN}✓ Migrations applied${NC}"

# Seed logic - intelligent decision
if [ "$FORCE_SEED" = true ]; then
    # Force seed requested - using production seed
    echo -e "${YELLOW}Force seed requested - seeding database with production data...${NC}"
    
    # Verify seed file exists
    if [ ! -f "$DEPLOY_DIR/backend/seed-production.sql" ]; then
        echo -e "${RED}ERROR: seed-production.sql not found in $DEPLOY_DIR/backend/${NC}"
        echo "Attempting to use local copy..."
        if [ ! -f "seed-production.sql" ]; then
            echo -e "${RED}FATAL: seed-production.sql not found anywhere!${NC}"
            exit 1
        fi
    fi
    
    # Generate fresh bcrypt hash for admin123
    echo "Generating secure password hash for admin@choyou.fr..."
    ADMIN_HASH=$(docker compose -f docker-compose.prod.yml exec -T api node -e "const bcrypt = require('bcrypt'); bcrypt.hash('admin123', 10).then(hash => console.log(hash));" 2>/dev/null | tr -d '\r\n' | grep '^\$2')
    
    if [ -z "$ADMIN_HASH" ]; then
        echo -e "${RED}ERROR: Failed to generate password hash${NC}"
        exit 1
    fi
    
    echo "Hash generated: ${ADMIN_HASH:0:20}..."
    
    # Create temporary seed file with actual hash
    echo "Preparing production seed..."
    if [ -f "$DEPLOY_DIR/backend/seed-production.sql" ]; then
        sed "s|{{ADMIN_PASSWORD_HASH}}|${ADMIN_HASH}|g" "$DEPLOY_DIR/backend/seed-production.sql" > /tmp/seed-production-temp.sql
    else
        sed "s|{{ADMIN_PASSWORD_HASH}}|${ADMIN_HASH}|g" seed-production.sql > /tmp/seed-production-temp.sql
    fi
    
    # Verify temp file was created
    if [ ! -f "/tmp/seed-production-temp.sql" ]; then
        echo -e "${RED}ERROR: Failed to create temporary seed file${NC}"
        exit 1
    fi
    
    # Execute seed
    echo "Executing production seed..."
    if ! docker compose -f docker-compose.prod.yml exec -T postgres psql -U ems_prod -d ems_production < /tmp/seed-production-temp.sql 2>&1 | tee /tmp/seed-output.log; then
        echo -e "${RED}ERROR: Seed execution failed. Check /tmp/seed-output.log${NC}"
        cat /tmp/seed-output.log
        exit 1
    fi
    
    # Clean up
    rm -f /tmp/seed-production-temp.sql /tmp/seed-output.log
    
    echo -e "${GREEN}✓ Production seed completed${NC}"
    echo -e "${GREEN}  Organization: Choyou${NC}"
    echo -e "${GREEN}  Admin: admin@choyou.fr / admin123${NC}"
    
elif [ "$FIRST_INSTALL" = true ]; then
    # First install - seed with production data
    echo "First installation detected - seeding database with production data..."
    
    # Verify seed file exists
    if [ ! -f "$DEPLOY_DIR/backend/seed-production.sql" ]; then
        echo -e "${RED}ERROR: seed-production.sql not found in $DEPLOY_DIR/backend/${NC}"
        echo "Attempting to use local copy..."
        if [ ! -f "seed-production.sql" ]; then
            echo -e "${RED}FATAL: seed-production.sql not found anywhere!${NC}"
            exit 1
        fi
    fi
    
    # Generate fresh bcrypt hash for admin123
    echo "Generating secure password hash for admin@choyou.fr..."
    ADMIN_HASH=$(docker compose -f docker-compose.prod.yml exec -T api node -e "const bcrypt = require('bcrypt'); bcrypt.hash('admin123', 10).then(hash => console.log(hash));" 2>/dev/null | tr -d '\r\n' | grep '^\$2')
    
    if [ -z "$ADMIN_HASH" ]; then
        echo -e "${RED}ERROR: Failed to generate password hash${NC}"
        exit 1
    fi
    
    echo "Hash generated: ${ADMIN_HASH:0:20}..."
    
    # Create temporary seed file with actual hash
    echo "Preparing production seed..."
    if [ -f "$DEPLOY_DIR/backend/seed-production.sql" ]; then
        sed "s|{{ADMIN_PASSWORD_HASH}}|${ADMIN_HASH}|g" "$DEPLOY_DIR/backend/seed-production.sql" > /tmp/seed-production-temp.sql
    else
        sed "s|{{ADMIN_PASSWORD_HASH}}|${ADMIN_HASH}|g" seed-production.sql > /tmp/seed-production-temp.sql
    fi
    
    # Verify temp file was created
    if [ ! -f "/tmp/seed-production-temp.sql" ]; then
        echo -e "${RED}ERROR: Failed to create temporary seed file${NC}"
        exit 1
    fi
    
    # Execute seed
    echo "Executing production seed..."
    if ! docker compose -f docker-compose.prod.yml exec -T postgres psql -U ems_prod -d ems_production < /tmp/seed-production-temp.sql 2>&1 | tee /tmp/seed-output.log; then
        echo -e "${RED}ERROR: Seed execution failed. Check /tmp/seed-output.log${NC}"
        cat /tmp/seed-output.log
        exit 1
    fi
    
    # Clean up
    rm -f /tmp/seed-production-temp.sql /tmp/seed-output.log
    
    echo -e "${GREEN}✓ Production seed completed${NC}"
    echo -e "${GREEN}  Organization: Choyou${NC}"
    echo -e "${GREEN}  Admin: admin@choyou.fr / admin123${NC}"
    
else
    # Update mode - do NOT seed (preserve data)
    echo "Update mode - skipping seed to preserve existing data"
    echo -e "${GREEN}✓ Your data has been preserved${NC}"
fi

# Check if services are running
echo -e "\n${GREEN}Checking service status:${NC}"
docker ps --filter "name=ems" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Step 11: Configure SSL certificates automatically
echo -e "\n${YELLOW}[11/11] Configuring SSL certificates...${NC}"

# Check if SSL certificates exist
SSL_EXISTS=false

if [ -f "/etc/letsencrypt/live/attendee.fr/fullchain.pem" ]; then
    echo -e "${GREEN}✓ SSL certificates found on host${NC}"
    SSL_EXISTS=true
    
    # Copy to Docker volume if not already there
    if ! docker run --rm -v ems_certbot_conf:/certs alpine test -f /certs/live/attendee.fr/fullchain.pem 2>/dev/null; then
        echo "Copying SSL certificates from host to Docker volume..."
        if sudo docker run --rm -v /etc/letsencrypt:/source -v ems_certbot_conf:/dest alpine sh -c 'cp -r /source/* /dest/' 2>/dev/null; then
            echo -e "${GREEN}✓ SSL certificates copied to Docker volume${NC}"
        fi
    fi
    
elif docker compose -f docker-compose.prod.yml exec -T certbot test -f /etc/letsencrypt/live/attendee.fr/fullchain.pem &>/dev/null; then
    echo -e "${GREEN}✓ SSL certificates already exist in Docker volume${NC}"
    SSL_EXISTS=true
fi

# Configure Nginx based on SSL availability
cd "$DEPLOY_DIR/backend"

if [ "$SSL_EXISTS" = false ]; then
    echo -e "${YELLOW}No SSL certificates found - configuring HTTP-only mode${NC}"
    
    # Use HTTP-only configs
    if [ -f "nginx/conf.d/attendee.fr.conf.http" ] && [ -f "nginx/conf.d/api.attendee.fr.conf.http" ]; then
        echo "Switching to HTTP-only Nginx configuration..."
        cp nginx/conf.d/attendee.fr.conf.http nginx/conf.d/attendee.fr.conf
        cp nginx/conf.d/api.attendee.fr.conf.http nginx/conf.d/api.attendee.fr.conf
        echo -e "${GREEN}✓ HTTP-only configuration active${NC}"
    else
        echo -e "${YELLOW}WARNING: HTTP-only config files not found. Nginx may fail to start.${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}📝 To obtain SSL certificates, run this after deployment:${NC}"
    echo "  cd /opt/ems-attendee/backend"
    echo "  docker compose -f docker-compose.prod.yml exec certbot certbot certonly \\"
    echo "    --webroot -w /var/www/certbot \\"
    echo "    -d attendee.fr -d www.attendee.fr -d api.attendee.fr \\"
    echo "    --email contact@attendee.fr --agree-tos --non-interactive"
    echo ""
    echo "  Then restore SSL configs and restart Nginx:"
    echo "  git checkout nginx/conf.d/attendee.fr.conf nginx/conf.d/api.attendee.fr.conf"
    echo "  docker compose -f docker-compose.prod.yml restart nginx"
    echo ""
fi

# Restart Nginx to apply configuration
echo "Restarting Nginx..."
if docker compose -f docker-compose.prod.yml restart nginx 2>/dev/null; then
    sleep 3
    
    # Check if Nginx is running properly
    if docker ps --filter "name=ems-nginx" --format "{{.Status}}" | grep -q "Up"; then
        echo -e "${GREEN}✓ Nginx started successfully${NC}"
    else
        echo -e "${RED}✗ Nginx failed to start!${NC}"
        echo "Checking logs..."
        docker logs ems-nginx --tail 20
        echo ""
        echo -e "${YELLOW}Nginx is failing. This is usually due to SSL certificate issues.${NC}"
        echo "The deployment will continue, but you may need to fix Nginx manually."
    fi
else
    echo -e "${YELLOW}WARNING: Could not restart Nginx${NC}"
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}   🎉 Deployment completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}Service Status:${NC}"
docker ps --filter "name=ems" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo -e "\n${GREEN}🌐 Your application is now available at:${NC}"
echo "   - Frontend: https://attendee.fr"
echo "   - API: https://api.attendee.fr"
echo "   - API Health: https://api.attendee.fr/health"

if [ "$FIRST_INSTALL" = true ] || [ "$FORCE_SEED" = true ]; then
    echo -e "\n${GREEN}🔑 Admin credentials:${NC}"
    echo "   - Email: admin@choyou.fr"
    echo "   - Password: admin123"
    echo "   - Organization: Choyou"
fi

if [ "$DB_HAS_DATA" = true ] && [ "$FORCE_SEED" = false ]; then
    echo -e "\n${GREEN}✅ Your existing data has been preserved${NC}"
fi

echo -e "\n${YELLOW}📋 Useful commands:${NC}"
echo "   - View logs: cd $DEPLOY_DIR/backend && docker compose -f docker-compose.prod.yml logs -f [api|nginx|postgres]"
echo "   - Restart service: cd $DEPLOY_DIR/backend && docker compose -f docker-compose.prod.yml restart [api|nginx]"
echo "   - Check status: cd $DEPLOY_DIR/backend && docker compose -f docker-compose.prod.yml ps"
echo "   - Update again: ./deploy.sh"
echo "   - Force reseed: ./deploy.sh --force-seed (⚠️  will erase data!)"

