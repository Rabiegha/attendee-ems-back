#!/bin/bash

# ========================================
# Script de déploiement EMS Production
# VPS: 51.75.252.74
# Domaines: attendee.fr, api.attendee.fr
# ========================================
#
# PREMIER DÉPLOIEMENT SUR NOUVEAU VPS :
#   1. Exécuter ce script normalement
#   2. Si erreur d'authentification PostgreSQL, faire:
#      docker compose -f docker-compose.prod.yml down -v
#      docker compose -f docker-compose.prod.yml up -d
#      docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy
#      docker compose -f docker-compose.prod.yml exec -T api node dist/prisma/seed.js
#
# DÉPLOIEMENTS SUIVANTS :
#   Simplement exécuter: ./deploy.sh
#   Les volumes sont préservés pour garder les données
# ========================================

set -e  # Exit on error

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
echo -e "\n${YELLOW}[2/8] Cloning backend repository (branch: $BRANCH)...${NC}"
if [ -d "backend" ]; then
    echo "Backend directory exists, pulling latest changes..."
    cd backend
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
    cd ..
else
    git clone -b "$BRANCH" "$BACKEND_REPO" backend
fi

# Step 3: Clone frontend repository
echo -e "\n${YELLOW}[3/8] Cloning frontend repository (branch: $BRANCH)...${NC}"
if [ -d "frontend" ]; then
    echo "Frontend directory exists, pulling latest changes..."
    cd frontend
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
    cd ..
else
    git clone -b "$BRANCH" "$FRONTEND_REPO" frontend
fi

# Step 4: Load .env.vps configuration
echo -e "\n${YELLOW}[4/8] Loading backend configuration from .env.vps...${NC}"

# Check if .env.vps exists
if [ ! -f "$DEPLOY_DIR/backend/.env.vps" ]; then
    echo -e "${RED}ERROR: .env.vps not found in $DEPLOY_DIR/backend/${NC}"
    echo "Please create .env.vps with all required configuration"
    exit 1
fi

# Copy .env.vps to .env.production
cp "$DEPLOY_DIR/backend/.env.vps" "$DEPLOY_DIR/backend/.env.production"

# Step 5: Generate fresh secrets every time
echo -e "\n${YELLOW}[5/8] Generating fresh secrets...${NC}"

# Generate new secrets
echo "Generating PostgreSQL password..."
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9')

echo "Generating JWT secrets..."
JWT_ACCESS_SECRET=$(openssl rand -base64 64 | tr -d '\n')
JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')

# Replace secrets in .env.production (robustly, handling both placeholders and existing values)
echo "Updating .env.production with new secrets..."

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

# Reconstruct and update DATABASE_URL to ensure it uses the new password
# This is critical because Prisma uses DATABASE_URL, not POSTGRES_PASSWORD directly
echo "Updating DATABASE_URL..."
NEW_DATABASE_URL="postgresql://ems_prod:${POSTGRES_PASSWORD}@postgres:5432/ems_production"
update_env "DATABASE_URL" "${NEW_DATABASE_URL}" "$DEPLOY_DIR/backend/.env.production"

echo -e "${GREEN}✓ All secrets generated and configured${NC}"

# Create .env file for Docker Compose interpolation (Postgres service needs this)
echo "Creating .env for Docker Compose..."
cat > "$DEPLOY_DIR/backend/.env" <<EOF
POSTGRES_USER=ems_prod
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=ems_production
EOF

echo -e "${GREEN}✓ Backend .env.production and .env created with secure secrets${NC}"

# Step 6: Build frontend
echo -e "\n${YELLOW}[6/8] Building frontend for production...${NC}"
cd "$DEPLOY_DIR/frontend"

# Always install dependencies to ensure they are up to date
echo "Installing frontend dependencies..."
npm install

# Build frontend
echo "Building frontend..."
VITE_API_URL=https://api.attendee.fr npm run build

echo -e "${GREEN}✓ Frontend built successfully${NC}"

# Step 7: Copy frontend build to nginx directory
echo -e "\n${YELLOW}[7/8] Preparing frontend for Nginx...${NC}"
mkdir -p "$DEPLOY_DIR/backend/frontend"
cp -r "$DEPLOY_DIR/frontend/dist/"* "$DEPLOY_DIR/backend/frontend/"
echo -e "${GREEN}✓ Frontend files copied${NC}"

# Step 8: Start Docker services with fresh secrets
echo -e "\n${YELLOW}[8/9] Starting Docker services...${NC}"
cd "$DEPLOY_DIR/backend"

# Check if postgres volume exists (indicates previous deployment)
POSTGRES_VOLUME_EXISTS=$(docker volume ls -q -f name=ems_postgres_data 2>/dev/null || echo "")

if [ -n "$POSTGRES_VOLUME_EXISTS" ]; then
    echo "Existing PostgreSQL volume found, updating password before recreating..."
    
    # Start postgres to update password
    docker compose -f docker-compose.prod.yml up -d postgres 2>/dev/null || true
    
    # Wait for postgres to be ready
    echo "Waiting for PostgreSQL to start..."
    sleep 10
    
    # Update password in running PostgreSQL instance (use postgres superuser)
    echo "Updating PostgreSQL password to match new configuration..."
    docker exec -i ems-postgres psql -U postgres <<EOF 2>/dev/null || true
ALTER USER ems_prod WITH PASSWORD '${POSTGRES_PASSWORD}';
EOF
    
    echo -e "${GREEN}✓ PostgreSQL password updated${NC}"
fi

# Stop existing containers (keep volumes to preserve data)
echo "Stopping existing containers..."
docker compose -f docker-compose.prod.yml down 2>/dev/null || true

# Start services with fresh build and force recreate containers with new secrets
echo "Starting services with new configuration..."
docker compose -f docker-compose.prod.yml up -d --build --force-recreate

# Wait for database to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 10

# Note: PostgreSQL password is set during container initialization via POSTGRES_PASSWORD env var
# No need to manually sync password after creation - it's already correct
echo -e "${GREEN}✓ PostgreSQL initialized with configured password${NC}"

# Restart API to apply new database connection
echo "Restarting API with correct database credentials..."
docker compose -f docker-compose.prod.yml restart api
sleep 5

# Run Prisma migrations and seed
echo "Running Prisma migrations..."
docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy
echo -e "${GREEN}✓ Migrations applied${NC}"

echo "Running database seed..."
docker compose -f docker-compose.prod.yml exec -T api node dist/prisma/seed.js
echo -e "${GREEN}✓ Database seeded${NC}"

# Check if services are running
echo -e "\n${GREEN}Checking service status:${NC}"
docker ps --filter "name=ems" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Step 9: Configure SSL certificates automatically
echo -e "\n${YELLOW}[9/9] Configuring SSL certificates...${NC}"

# Check if SSL certificates exist
if docker compose -f docker-compose.prod.yml exec -T certbot ls /etc/letsencrypt/live/attendee.fr/fullchain.pem &>/dev/null; then
    echo -e "${GREEN}✓ SSL certificates already exist and are valid${NC}"
else
    echo "SSL certificates not found, generating them now..."
    
    # Save original nginx configurations
    echo "Creating temporary HTTP-only Nginx configuration..."
    cp nginx/conf.d/attendee.fr.conf nginx/conf.d/attendee.fr.conf.ssl 2>/dev/null || true
    cp nginx/conf.d/api.attendee.fr.conf nginx/conf.d/api.attendee.fr.conf.ssl 2>/dev/null || true
    
    # Create temporary HTTP-only configuration for attendee.fr
    cat > nginx/conf.d/attendee.fr.conf <<'NGINX'
# Configuration temporaire pour attendee.fr (HTTP only - pour obtenir certificats SSL)
server {
    listen 80;
    server_name attendee.fr www.attendee.fr;

    # Let's Encrypt validation
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Frontend static files
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

    # Create temporary HTTP-only configuration for api.attendee.fr
    cat > nginx/conf.d/api.attendee.fr.conf <<'NGINX'
# Configuration temporaire pour api.attendee.fr (HTTP only - pour obtenir certificats SSL)
server {
    listen 80;
    server_name api.attendee.fr;

    # Let's Encrypt validation
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Proxy vers l'API
    location / {
        proxy_pass http://api:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

    # Restart Nginx with HTTP-only configuration
    echo "Restarting Nginx with temporary HTTP-only configuration..."
    docker compose -f docker-compose.prod.yml restart nginx
    sleep 5
    
    # Generate SSL certificates with Certbot
    echo "Requesting SSL certificates from Let's Encrypt..."
    docker compose -f docker-compose.prod.yml exec -T certbot certbot certonly \
        --webroot \
        -w /var/www/certbot \
        -d attendee.fr \
        -d www.attendee.fr \
        -d api.attendee.fr \
        --email contact@attendee.fr \
        --agree-tos \
        --no-eff-email \
        --non-interactive \
        || {
            echo -e "${RED}Failed to obtain SSL certificates${NC}"
            echo "Restoring original configuration..."
            mv nginx/conf.d/attendee.fr.conf.ssl nginx/conf.d/attendee.fr.conf 2>/dev/null || true
            mv nginx/conf.d/api.attendee.fr.conf.ssl nginx/conf.d/api.attendee.fr.conf 2>/dev/null || true
            echo -e "${YELLOW}WARNING: SSL certificates could not be obtained. The site will run on HTTP only.${NC}"
        }
    
    # Check if certificates were successfully created
    if docker compose -f docker-compose.prod.yml exec -T certbot ls /etc/letsencrypt/live/attendee.fr/fullchain.pem &>/dev/null; then
        echo -e "${GREEN}✓ SSL certificates obtained successfully${NC}"
        
        # Restore SSL-enabled Nginx configurations
        echo "Restoring SSL-enabled Nginx configuration..."
        mv nginx/conf.d/attendee.fr.conf.ssl nginx/conf.d/attendee.fr.conf
        mv nginx/conf.d/api.attendee.fr.conf.ssl nginx/conf.d/api.attendee.fr.conf
        
        # Restart Nginx with SSL configuration
        echo "Restarting Nginx with SSL configuration..."
        docker compose -f docker-compose.prod.yml restart nginx
        sleep 3
        
        echo -e "${GREEN}✓ SSL certificates configured and active${NC}"
    fi
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}   Deployment completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}Service Status:${NC}"
docker ps --filter "name=ems" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo -e "\n${GREEN}Your application is now available at:${NC}"
echo "   - Frontend: https://attendee.fr"
echo "   - API: https://api.attendee.fr"
echo "   - API Health: https://api.attendee.fr/health"

echo -e "\n${YELLOW}Demo credentials (from seed):${NC}"
echo "   - Super Admin: john.doe@system.com / admin123"
echo "   - Admin: jane.smith@acme.com / admin123"
echo "   - Manager: bob.johnson@acme.com / manager123"

echo -e "\n${YELLOW}Useful commands:${NC}"
echo "   - View logs: docker compose -f docker-compose.prod.yml logs -f [api|nginx|postgres]"
echo "   - Restart service: docker compose -f docker-compose.prod.yml restart [api|nginx]"
echo "   - Check status: docker compose -f docker-compose.prod.yml ps"

