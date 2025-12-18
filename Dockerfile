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
RUN echo "Build content:" && ls -R dist

# Runtime
FROM node:20-alpine AS runner
WORKDIR /app
# Keep development mode for seed execution
ENV NODE_ENV=development

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
# Copy source files and Prisma for migrations/seeding in production
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# Copy all scripts for admin tasks and entrypoint
COPY --from=builder /app/scripts ./scripts
RUN chmod +x ./scripts/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./scripts/entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
