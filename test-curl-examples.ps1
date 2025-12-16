# Script de test avec CURL pour les API Attendee Types
# Assurez-vous que le serveur est en cours d'exécution sur http://localhost:3000

# Variables
$BASE_URL="http://localhost:3000"

echo "=== Test des API Attendee Types avec CURL ==="
echo ""

# 1. Test de santé
echo "1. Test de santé du serveur..."
curl -X GET $BASE_URL/health
echo ""

# 2. Connexion (remplacez par vos identifiants)
echo "2. Connexion..."
$LOGIN_RESPONSE = curl -X POST $BASE_URL/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@org1.com","password":"Password123!"}' `
  2>$null

# Extraire le token (vous devrez peut-être ajuster selon votre shell)
# Pour PowerShell, utilisez plutôt le script test-attendee-types-api.ps1
echo $LOGIN_RESPONSE | ConvertFrom-Json | Select-Object -ExpandProperty access_token

echo ""
echo "Pour une utilisation plus simple, exécutez:"
echo "  .\test-attendee-types-api.ps1"
echo ""
echo "Ou utilisez ces commandes CURL directement (remplacez TOKEN et ORG_ID):"
echo ""
echo "# Lister les attendee types"
echo 'curl -X GET http://localhost:3000/orgs/ORG_ID/attendee-types \'
echo '  -H "Authorization: Bearer TOKEN"'
echo ""
echo "# Créer un attendee type"
echo 'curl -X POST http://localhost:3000/orgs/ORG_ID/attendee-types \'
echo '  -H "Authorization: Bearer TOKEN" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d "{\"code\":\"vip\",\"name\":\"VIP\",\"color_hex\":\"#FFD700\",\"text_color_hex\":\"#000000\",\"icon\":\"star\"}"'
echo ""
echo "# Mettre à jour un attendee type"
echo 'curl -X PATCH http://localhost:3000/orgs/ORG_ID/attendee-types/TYPE_ID \'
echo '  -H "Authorization: Bearer TOKEN" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d "{\"name\":\"VIP Premium\",\"color_hex\":\"#FF6B35\"}"'
echo ""
echo "# Lister les types d'un événement"
echo 'curl -X GET http://localhost:3000/orgs/ORG_ID/events/EVENT_ID/attendee-types \'
echo '  -H "Authorization: Bearer TOKEN"'
echo ""
echo "# Ajouter un type à un événement"
echo 'curl -X POST http://localhost:3000/orgs/ORG_ID/events/EVENT_ID/attendee-types \'
echo '  -H "Authorization: Bearer TOKEN" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d "{\"attendeeTypeId\":\"TYPE_ID\"}"'
echo ""
echo "# Mettre à jour la config d'un type pour un événement"
echo 'curl -X PUT http://localhost:3000/orgs/ORG_ID/events/EVENT_ID/attendee-types/EVENT_TYPE_ID \'
echo '  -H "Authorization: Bearer TOKEN" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d "{\"capacity\":50,\"color_hex\":\"#9B59B6\",\"text_color_hex\":\"#FFFFFF\"}"'
echo ""
echo "# Supprimer un type d'un événement"
echo 'curl -X DELETE http://localhost:3000/orgs/ORG_ID/events/EVENT_ID/attendee-types/EVENT_TYPE_ID \'
echo '  -H "Authorization: Bearer TOKEN"'
echo ""
