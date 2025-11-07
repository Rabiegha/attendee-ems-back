# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++ bash openssl
COPY package*.json ./
RUN npm ci
COPY . .
# Generate Prisma client
RUN npx prisma generate
RUN npm run build

# Runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Installer les dépendances système de base
RUN apk add --no-cache bash openssl

# Installer Chromium et ses dépendances pour la génération de badges
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
    font-noto-emoji

# Variables d'environnement pour Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# Copy Prisma files for migrations/seeding in production
COPY --from=builder /app/prisma ./prisma
COPY scripts/entrypoint.sh ./scripts/entrypoint.sh
RUN chmod +x ./scripts/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./scripts/entrypoint.sh"]
CMD ["node", "dist/main.js"]
