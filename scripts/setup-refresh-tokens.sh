#!/bin/bash

# Script de déploiement pour le système de refresh tokens
# Usage: ./scripts/setup-refresh-tokens.sh

set -e

echo "🚀 Configuration du système de refresh tokens..."

# Vérifier que Docker est en cours d'exécution
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker n'est pas en cours d'exécution. Veuillez démarrer Docker."
    exit 1
fi

# Démarrer les services Docker
echo "📦 Démarrage des services Docker..."
npm run docker:up

# Attendre que la base de données soit prête
echo "⏳ Attente de la base de données..."
sleep 10

# Exécuter les migrations Prisma
echo "🗄️ Exécution des migrations Prisma..."
npm run docker:migrate:deploy

# Régénérer le client Prisma
echo "🔄 Régénération du client Prisma..."
npm run docker:generate

# Exécuter les seeders
echo "🌱 Exécution des seeders..."
npm run docker:seed

# Vérifier que tout fonctionne
echo "✅ Vérification de l'installation..."

# Test de connexion à la base
if npm run docker:db:status > /dev/null 2>&1; then
    echo "✅ Base de données : OK"
else
    echo "❌ Base de données : Erreur"
    exit 1
fi

# Vérifier que la table refresh_tokens existe
if docker-compose -f docker-compose.dev.yml exec -T db psql -U postgres -d ems -c "\dt refresh_tokens" > /dev/null 2>&1; then
    echo "✅ Table refresh_tokens : OK"
else
    echo "❌ Table refresh_tokens : Non trouvée"
    exit 1
fi

echo ""
echo "🎉 Configuration terminée avec succès !"
echo ""
echo "📋 Prochaines étapes :"
echo "1. Vérifiez votre fichier .env avec les nouvelles variables"
echo "2. Installez les dépendances : npm install"
echo "3. Testez les endpoints : npm run test:e2e -- --testNamePattern=\"Auth Refresh\""
echo "4. Démarrez l'application : npm run start:dev"
echo ""
echo "📚 Documentation : docs/AUTH_REFRESH_TOKENS.md"
echo "🔧 Variables d'environnement requises :"
echo "   - JWT_ACCESS_SECRET"
echo "   - JWT_REFRESH_SECRET"
echo "   - JWT_ACCESS_TTL"
echo "   - JWT_REFRESH_TTL"
echo "   - AUTH_COOKIE_NAME"
echo "   - AUTH_COOKIE_SECURE"
echo "   - AUTH_COOKIE_SAMESITE"
echo "   - API_CORS_ORIGIN"
