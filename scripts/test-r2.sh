#!/bin/bash

# Script de test pour vérifier la connexion Cloudflare R2

echo "🧪 Test de connexion Cloudflare R2"
echo "=================================="
echo ""

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier si le fichier .env existe
if [ ! -f .env ]; then
    echo -e "${RED}❌ Fichier .env introuvable${NC}"
    exit 1
fi

# Charger les variables d'environnement
source .env

# Vérifier que les variables sont définies
echo "📋 Vérification des variables d'environnement..."
echo ""

if [ -z "$R2_ACCOUNT_ID" ] || [ "$R2_ACCOUNT_ID" = "your_account_id_here" ]; then
    echo -e "${RED}❌ R2_ACCOUNT_ID non configuré${NC}"
    exit 1
else
    echo -e "${GREEN}✅ R2_ACCOUNT_ID: ${R2_ACCOUNT_ID:0:8}...${NC}"
fi

if [ -z "$R2_ACCESS_KEY_ID" ] || [ "$R2_ACCESS_KEY_ID" = "your_access_key_here" ]; then
    echo -e "${RED}❌ R2_ACCESS_KEY_ID non configuré${NC}"
    exit 1
else
    echo -e "${GREEN}✅ R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID:0:8}...${NC}"
fi

if [ -z "$R2_SECRET_ACCESS_KEY" ] || [ "$R2_SECRET_ACCESS_KEY" = "your_secret_key_here" ]; then
    echo -e "${RED}❌ R2_SECRET_ACCESS_KEY non configuré${NC}"
    exit 1
else
    echo -e "${GREEN}✅ R2_SECRET_ACCESS_KEY: ***********${NC}"
fi

if [ -z "$R2_BUCKET_NAME" ]; then
    echo -e "${YELLOW}⚠️  R2_BUCKET_NAME non configuré (utilisation du défaut: ems-badges)${NC}"
else
    echo -e "${GREEN}✅ R2_BUCKET_NAME: ${R2_BUCKET_NAME}${NC}"
fi

if [ -z "$R2_PUBLIC_URL" ] || [ "$R2_PUBLIC_URL" = "https://pub-xxxxx.r2.dev" ]; then
    echo -e "${YELLOW}⚠️  R2_PUBLIC_URL non configuré${NC}"
    echo -e "${YELLOW}   Les URLs générées utiliseront le format par défaut${NC}"
else
    echo -e "${GREEN}✅ R2_PUBLIC_URL: ${R2_PUBLIC_URL}${NC}"
fi

echo ""
echo "🚀 Lancement du test d'upload..."
echo ""

# Créer un fichier de test
TEST_FILE="test-r2-$(date +%s).txt"
echo "Test Cloudflare R2 - $(date)" > "$TEST_FILE"

# Obtenir un token (remplace par ta méthode d'authentification)
echo "🔑 Authentification..."
# Pour le test, on assume que l'API est en dev mode sans auth stricte
# Sinon, ajoute ton token ici

# Tester l'upload
echo "📤 Upload du fichier de test..."
RESPONSE=$(curl -s -X POST http://localhost:3000/storage/test-upload \
  -F "file=@$TEST_FILE")

# Vérifier la réponse
if echo "$RESPONSE" | grep -q "success.*true"; then
    echo -e "${GREEN}✅ Upload réussi !${NC}"
    echo ""
    echo "📄 Réponse:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    
    # Extraire l'URL
    URL=$(echo "$RESPONSE" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
    
    if [ ! -z "$URL" ]; then
        echo ""
        echo "🌐 URL du fichier: $URL"
        echo ""
        echo "🧪 Test d'accès à l'URL..."
        
        # Tester l'accès à l'URL
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
        
        if [ "$HTTP_CODE" = "200" ]; then
            echo -e "${GREEN}✅ Fichier accessible publiquement !${NC}"
        else
            echo -e "${RED}❌ Fichier non accessible (HTTP $HTTP_CODE)${NC}"
            echo -e "${YELLOW}⚠️  Vérifie que Public Access est activé sur ton bucket R2${NC}"
        fi
    fi
else
    echo -e "${RED}❌ Upload échoué${NC}"
    echo ""
    echo "📄 Réponse:"
    echo "$RESPONSE"
fi

# Nettoyer le fichier de test
rm -f "$TEST_FILE"

echo ""
echo "=================================="
echo "✅ Test terminé"
