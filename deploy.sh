#!/bin/bash

# ========================================
# Script de déploiement EMS Production
# VPS: 51.75.252.74
# Domaines: attendee.fr, api.attendee.fr
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

# Step 4: Load .env.vps configuration first
echo -e "\n${YELLOW}[4/8] Loading backend configuration from .env.vps...${NC}"

# Check if .env.vps exists
if [ ! -f "$DEPLOY_DIR/backend/.env.vps" ]; then
    echo -e "${RED}ERROR: .env.vps not found in $DEPLOY_DIR/backend/${NC}"
    echo "Please create .env.vps with all required configuration"
    exit 1
fi

# Copy .env.vps to .env.production
cp "$DEPLOY_DIR/backend/.env.vps" "$DEPLOY_DIR/backend/.env.production"

# Step 5: Generate or preserve JWT secrets
echo -e "\n${YELLOW}[5/8] Managing JWT secrets...${NC}"

# Read POSTGRES_PASSWORD from .env.vps (this is the source of truth)
POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" "$DEPLOY_DIR/backend/.env.vps" | cut -d'=' -f2-)

# Check if JWT secrets already exist to avoid rotating them
if [ -f "$DEPLOY_DIR/backend/.env.production" ]; then
    EXISTING_JWT_ACCESS=$(grep "^JWT_ACCESS_SECRET=" "$DEPLOY_DIR/backend/.env.production" | cut -d'=' -f2-)
    EXISTING_JWT_REFRESH=$(grep "^JWT_REFRESH_SECRET=" "$DEPLOY_DIR/backend/.env.production" | cut -d'=' -f2-)
    EXISTING_JWT=$(grep "^JWT_SECRET=" "$DEPLOY_DIR/backend/.env.production" | cut -d'=' -f2-)
    
    # Only generate new secrets if they don't exist or are placeholders
    if [ -z "$EXISTING_JWT_ACCESS" ] || [ "$EXISTING_JWT_ACCESS" = "placeholder" ]; then
        echo "Generating new JWT secrets..."
        JWT_ACCESS_SECRET=$(openssl rand -base64 64 | tr -d '\n')
        JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')
        JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    else
        echo "Preserving existing JWT secrets..."
        JWT_ACCESS_SECRET=$EXISTING_JWT_ACCESS
        JWT_REFRESH_SECRET=$EXISTING_JWT_REFRESH
        JWT_SECRET=$EXISTING_JWT
    fi
else
    echo "Generating new JWT secrets..."
    JWT_ACCESS_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
fi

# Update .env.production with JWT secrets (keep POSTGRES_PASSWORD from .env.vps)
sed -i "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}|" "$DEPLOY_DIR/backend/.env.production"
sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}|" "$DEPLOY_DIR/backend/.env.production"
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" "$DEPLOY_DIR/backend/.env.production"

# Ensure DATABASE_URL uses the password from .env.vps
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://ems_prod:${POSTGRES_PASSWORD}@postgres:5432/ems_production|" "$DEPLOY_DIR/backend/.env.production"

echo -e "${GREEN}✓ Configuration loaded from .env.vps${NC}"

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

# Step 8: Start Docker services
echo -e "\n${YELLOW}[8/8] Starting Docker services...${NC}"
cd "$DEPLOY_DIR/backend"

# Stop existing containers if any
docker compose -f docker-compose.prod.yml down 2>/dev/null || true

# Start services
docker compose -f docker-compose.prod.yml up -d --build

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}   Deployment completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Configure DNS records at OVH:"
echo "   - A record: attendee.fr → 51.75.252.74"
echo "   - A record: api.attendee.fr → 51.75.252.74"
echo ""
echo "2. Once DNS is propagated (check with: dig attendee.fr), run:"
echo "   sudo certbot --nginx -d attendee.fr -d www.attendee.fr -d api.attendee.fr"
echo ""
echo "3. Check service status:"
echo "   docker ps"
echo "   docker logs ems-api"
echo "   docker logs ems-nginx"
echo ""
echo -e "${GREEN}Your application will be available at:${NC}"
echo "   - Frontend: https://attendee.fr"
echo "   - API: https://api.attendee.fr"
