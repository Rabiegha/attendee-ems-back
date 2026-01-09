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
    
    # Start services WITHOUT nginx first (we'll handle nginx separately based on SSL)
    echo "Starting backend services with updated code..."
    docker compose -f docker-compose.prod.yml up -d --build postgres api certbot
    
    # Wait for services to be ready
    echo "Waiting for services to initialize..."
    sleep 10
    
    echo -e "${GREEN}✓ Backend services updated successfully${NC}"
    
else
    # FIRST INSTALL MODE - Fresh setup
    echo "Running in FIRST INSTALL mode - setting up fresh environment..."
    
    # Stop any existing containers and clean volumes
    echo "Cleaning up any existing containers..."
    docker compose -f docker-compose.prod.yml down -v 2>/dev/null || true
    
    # Start services WITHOUT nginx first (we'll handle nginx separately based on SSL)
    echo "Starting backend services..."
    docker compose -f docker-compose.prod.yml up -d --build postgres api certbot
    
    # Wait for database initialization
    echo "Waiting for PostgreSQL initialization..."
    sleep 20
    
    echo -e "${GREEN}✓ Backend services started successfully${NC}"
fi

# Test database connection directly (not through API)
echo "Testing database connection..."
MAX_RETRIES=3
RETRY_COUNT=0
DB_CONNECTED=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker compose -f docker-compose.prod.yml exec -T postgres psql -U ems_prod -d ems_production -c "SELECT 1;" &>/dev/null; then
        DB_CONNECTED=true
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        echo "Connection attempt $RETRY_COUNT failed, retrying in 3 seconds..."
        sleep 3
    fi
done

if [ "$DB_CONNECTED" = true ]; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
else
    echo -e "${RED}✗ Database connection failed after $MAX_RETRIES attempts!${NC}"
    
    # Show logs automatically
    echo ""
    echo "=== PostgreSQL Logs (last 30 lines) ==="
    docker compose -f docker-compose.prod.yml logs --tail 30 postgres
    
    echo ""
    
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
            
            sleep 20
            
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
        echo ""
        echo -e "${YELLOW}Possible causes:${NC}"
        echo "  - API container still starting up (check: docker logs ems-api)"
        echo "  - PostgreSQL not fully initialized (check: docker logs ems-postgres)"
        echo "  - Network issues between containers"
        echo ""
        echo "Try waiting 30 more seconds and running again:"
        echo "  sleep 30 && ./deploy.sh --first-install"
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
    echo "Generating secure password hash for admin@attendee.fr..."
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
    echo -e "${GREEN}  Admin: admin@attendee.fr / admin123${NC}"
    
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
    echo "Generating secure password hash for admin@attendee.fr..."
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
    echo -e "${GREEN}  Admin: admin@attendee.fr / admin123${NC}"
    
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
    echo -e "${YELLOW}No SSL certificates found - configuring HTTP-only mode first${NC}"
    
    # Use HTTP-only configs
    if [ -f "nginx/conf.d/attendee.fr.conf.http" ] && [ -f "nginx/conf.d/api.attendee.fr.conf.http" ]; then
        echo "Switching to HTTP-only Nginx configuration..."
        
        # Replace SSL configs with HTTP-only versions on host (will be mounted into container)
        cp nginx/conf.d/attendee.fr.conf.http nginx/conf.d/attendee.fr.conf
        cp nginx/conf.d/api.attendee.fr.conf.http nginx/conf.d/api.attendee.fr.conf
        echo -e "${GREEN}✓ HTTP-only configs prepared${NC}"
        
        # Now start Nginx with HTTP-only configs
        echo "Starting Nginx with HTTP-only configuration..."
        docker compose -f docker-compose.prod.yml up -d nginx
        
        # Wait for startup
        sleep 5
        
        # Verify Nginx started successfully
        if docker ps --filter "name=ems-nginx" --format "{{.Status}}" | grep -q "Up"; then
            echo -e "${GREEN}✓ Nginx started successfully with HTTP-only config${NC}"
            
            # Now automatically obtain SSL certificates
            echo ""
            echo -e "${YELLOW}Obtaining SSL certificates automatically...${NC}"
            
            if docker compose -f docker-compose.prod.yml exec -T certbot certbot certonly \
                --webroot -w /var/www/certbot \
                -d attendee.fr -d www.attendee.fr -d api.attendee.fr \
                --email fktorza@choyou.fr --agree-tos --non-interactive 2>&1 | tee /tmp/certbot-output.log; then
                
                # Check if certificates were actually obtained (not just renewed)
                if grep -q "Successfully received certificate" /tmp/certbot-output.log || \
                   grep -q "Certificate not yet due for renewal" /tmp/certbot-output.log; then
                    echo -e "${GREEN}✓ SSL certificates obtained successfully${NC}"
                    
                    # Restore SSL configs
                    echo "Switching to HTTPS configuration..."
                    git checkout nginx/conf.d/attendee.fr.conf nginx/conf.d/api.attendee.fr.conf 2>/dev/null || {
                        echo -e "${YELLOW}Could not restore SSL configs from git, they may already be in place${NC}"
                    }
                    
                    # Restart Nginx with SSL
                    echo "Restarting Nginx with SSL..."
                    docker compose -f docker-compose.prod.yml restart nginx
                    sleep 3
                    
                    if docker ps --filter "name=ems-nginx" --format "{{.Status}}" | grep -q "Up"; then
                        echo -e "${GREEN}✓ Nginx restarted with SSL successfully${NC}"
                        SSL_EXISTS=true
                    else
                        echo -e "${RED}✗ Nginx failed to start with SSL!${NC}"
                        docker logs ems-nginx --tail 20
                    fi
                else
                    echo -e "${RED}✗ Failed to obtain SSL certificates${NC}"
                    cat /tmp/certbot-output.log
                fi
            else
                echo -e "${RED}✗ Certbot command failed${NC}"
                cat /tmp/certbot-output.log
            fi
            
            rm -f /tmp/certbot-output.log
        else
            echo -e "${RED}✗ Nginx failed to start!${NC}"
            echo "Checking logs:"
            docker logs ems-nginx --tail 20
        fi
    else
        echo -e "${YELLOW}WARNING: HTTP-only config files not found. Nginx may fail to start.${NC}"
    fi
else
    echo -e "${GREEN}✓ SSL certificates found - using HTTPS configuration${NC}"
    
    # Start Nginx with SSL configs
    echo "Starting Nginx with SSL configuration..."
    docker compose -f docker-compose.prod.yml up -d nginx
    
    sleep 3
    
    if docker ps --filter "name=ems-nginx" --format "{{.Status}}" | grep -q "Up"; then
        echo -e "${GREEN}✓ Nginx started successfully with SSL${NC}"
    else
        echo -e "${RED}✗ Nginx failed to start!${NC}"
        echo "Checking logs:"
        docker logs ems-nginx --tail 20
    fi
fi

echo ""
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}   🎉 Deployment completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}Service Status:${NC}"
docker ps --filter "name=ems" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo -e "\n${YELLOW}Access URLs:${NC}"
if [ "$SSL_EXISTS" = true ]; then
    echo -e "${GREEN}  Frontend: https://attendee.fr${NC}"
    echo -e "${GREEN}  API: https://api.attendee.fr${NC}"
else
    echo -e "${GREEN}  Frontend: http://attendee.fr${NC}"
    echo -e "${GREEN}  API: http://api.attendee.fr${NC}"
    echo -e "${YELLOW}  Note: HTTPS not available yet (run SSL setup commands above)${NC}"
fi

echo ""
docker ps --filter "name=ems" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo -e "\n${GREEN}🌐 Your application is now available at:${NC}"
if [ "$SSL_EXISTS" = true ]; then
    echo "   - Frontend: https://attendee.fr"
    echo "   - API: https://api.attendee.fr"
    echo "   - API Health: https://api.attendee.fr/health"
else
    echo "   - Frontend: http://attendee.fr"
    echo "   - API: http://api.attendee.fr"
    echo "   - API Health: http://api.attendee.fr/health"
fi

if [ "$FIRST_INSTALL" = true ] || [ "$FORCE_SEED" = true ]; then
    echo -e "\n${GREEN}🔑 Admin credentials:${NC}"
    echo "   - Email: admin@attendee.fr"
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



