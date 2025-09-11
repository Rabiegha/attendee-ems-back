# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++ bash
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache bash
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# Pour exécuter migrations/seeders en prod si besoin
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/seeders ./seeders
COPY --from=builder /app/infra/db/sequelize.config.js ./infra/db/sequelize.config.js
COPY scripts/entrypoint.sh ./scripts/entrypoint.sh
RUN chmod +x ./scripts/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./scripts/entrypoint.sh"]
CMD ["node", "dist/main.js"]
