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
BRANCH="vps"

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

# Step 4: Generate production secrets
echo -e "\n${YELLOW}[4/8] Generating production secrets...${NC}"
JWT_ACCESS_SECRET=$(openssl rand -base64 64 | tr -d '\n')
JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9')

# Step 5: Create .env.production for backend
echo -e "\n${YELLOW}[5/8] Creating backend .env.production...${NC}"
cat > "$DEPLOY_DIR/backend/.env.production" <<EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://ems_prod:${POSTGRES_PASSWORD}@postgres:5432/ems_production

# JWT Configuration - PRODUCTION SECRETS
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

# Legacy (keep for backward compatibility)
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=900s

# Auth Cookie Configuration
AUTH_COOKIE_NAME=refresh_token
AUTH_COOKIE_DOMAIN=.attendee.fr
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=strict

# CORS Configuration
API_CORS_ORIGIN=https://attendee.fr

RUN_MIGRATIONS=true
RUN_SEEDERS=false

POSTGRES_USER=ems_prod
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=ems_production

# Configuration Email (OVH SMTP)
EMAIL_PROVIDER=smtp
EMAIL_ENABLED=true
SMTP_HOST=ssl0.ovh.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=attendee@choyou.fr
SMTP_PASSWORD=CK&b!nsnJLM\$fZdbAa0lnNA@2Kar?fbe
SMTP_FROM=attendee@choyou.fr
SMTP_FROM_NAME=EMS Attendee System

# Cloudflare R2 Configuration
R2_ACCOUNT_ID=903ebe643d8b33f2884eb7ee633ed42b
R2_ACCESS_KEY_ID=a8744bb675979c64c2fc47d0be52f1af
R2_SECRET_ACCESS_KEY=28d3cd680b6ec588aa0907974e585e650e9acec0eea6816668badd68d5d00bd8
R2_BUCKET_NAME=ems-badges
R2_PUBLIC_URL=https://pub-c032093f80904689bbbd94229f3e15e8.r2.dev

# Production URLs
API_URL=https://api.attendee.fr
FRONTEND_URL=https://attendee.fr
EOF

echo -e "${GREEN}✓ Backend .env.production created with secure secrets${NC}"

# Step 6: Build frontend
echo -e "\n${YELLOW}[6/8] Building frontend for production...${NC}"
cd "$DEPLOY_DIR/frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

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
