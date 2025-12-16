# API Attendee Types - Guide de Test

## Prérequis

1. Le serveur doit être en cours d'exécution : `npm run start:dev`
2. La base de données doit être migrée : `npm run db:migrate`
3. Vous devez avoir un utilisateur avec les permissions appropriées

## Exécuter les tests

### Option 1 : Script PowerShell automatique (Recommandé)

```powershell
.\test-attendee-types-api.ps1
```

Ce script va :
- Vérifier que le serveur est actif
- Se connecter automatiquement
- Créer plusieurs types d'attendees (VIP, Speaker, Participant)
- Tester les mises à jour
- Configurer les types pour un événement
- Afficher tous les résultats avec des couleurs

### Option 2 : Commandes CURL manuelles

#### 1. Se connecter et obtenir un token

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@org1.com","password":"Password123!"}'
```

Récupérez le `access_token` et l'`org_id` de la réponse.

#### 2. Lister les attendee types d'une organisation

```bash
curl -X GET http://localhost:3000/orgs/{ORG_ID}/attendee-types \
  -H "Authorization: Bearer {TOKEN}"
```

#### 3. Créer un nouveau attendee type

```bash
curl -X POST http://localhost:3000/orgs/{ORG_ID}/attendee-types \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "vip",
    "name": "VIP",
    "color_hex": "#FFD700",
    "text_color_hex": "#000000",
    "icon": "star",
    "sort_order": 1
  }'
```

#### 4. Mettre à jour un attendee type

```bash
curl -X PATCH http://localhost:3000/orgs/{ORG_ID}/attendee-types/{TYPE_ID} \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "VIP Premium",
    "color_hex": "#FF6B35"
  }'
```

#### 5. Récupérer un attendee type spécifique

```bash
curl -X GET http://localhost:3000/orgs/{ORG_ID}/attendee-types/{TYPE_ID} \
  -H "Authorization: Bearer {TOKEN}"
```

#### 6. Supprimer un attendee type

```bash
curl -X DELETE http://localhost:3000/orgs/{ORG_ID}/attendee-types/{TYPE_ID} \
  -H "Authorization: Bearer {TOKEN}"
```

## Configuration par Événement

#### 1. Lister les types configurés pour un événement

```bash
curl -X GET http://localhost:3000/orgs/{ORG_ID}/events/{EVENT_ID}/attendee-types \
  -H "Authorization: Bearer {TOKEN}"
```

#### 2. Ajouter un type à un événement

```bash
curl -X POST http://localhost:3000/orgs/{ORG_ID}/events/{EVENT_ID}/attendee-types \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "attendeeTypeId": "{TYPE_ID}"
  }'
```

#### 3. Mettre à jour la configuration d'un type pour un événement

```bash
curl -X PUT http://localhost:3000/orgs/{ORG_ID}/events/{EVENT_ID}/attendee-types/{EVENT_TYPE_ID} \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "capacity": 50,
    "color_hex": "#9B59B6",
    "text_color_hex": "#FFFFFF"
  }'
```

Cette requête permet de :
- Définir une capacité spécifique pour ce type dans cet événement
- Surcharger la couleur par défaut du type (sans modifier le type global)

#### 4. Retirer un type d'un événement

```bash
curl -X DELETE http://localhost:3000/orgs/{ORG_ID}/events/{EVENT_ID}/attendee-types/{EVENT_TYPE_ID} \
  -H "Authorization: Bearer {TOKEN}"
```

## Endpoints disponibles

### Gestion des Attendee Types (Organisation)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/orgs/:orgId/attendee-types` | Liste tous les types de l'organisation |
| POST | `/orgs/:orgId/attendee-types` | Crée un nouveau type |
| GET | `/orgs/:orgId/attendee-types/:id` | Récupère un type spécifique |
| PATCH | `/orgs/:orgId/attendee-types/:id` | Met à jour un type |
| DELETE | `/orgs/:orgId/attendee-types/:id` | Supprime un type |

### Configuration par Événement

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/orgs/:orgId/events/:eventId/attendee-types` | Liste les types configurés pour l'événement |
| POST | `/orgs/:orgId/events/:eventId/attendee-types` | Ajoute un type à l'événement |
| PUT | `/orgs/:orgId/events/:eventId/attendee-types/:typeId` | Met à jour la config du type (capacité, couleurs) |
| DELETE | `/orgs/:orgId/events/:eventId/attendee-types/:typeId` | Retire le type de l'événement |

## Modèle de données

### CreateAttendeeTypeDto
```json
{
  "code": "string (requis, lowercase, underscores uniquement)",
  "name": "string (requis)",
  "color_hex": "string (optionnel, format #RRGGBB)",
  "text_color_hex": "string (optionnel, format #RRGGBB)",
  "icon": "string (optionnel)",
  "sort_order": "number (optionnel, défaut: 0)"
}
```

### UpdateAttendeeTypeDto
```json
{
  "code": "string (optionnel)",
  "name": "string (optionnel)",
  "color_hex": "string (optionnel)",
  "text_color_hex": "string (optionnel)",
  "icon": "string (optionnel)",
  "sort_order": "number (optionnel)",
  "is_active": "boolean (optionnel)"
}
```

### UpdateEventAttendeeTypeDto
```json
{
  "capacity": "number (optionnel)",
  "color_hex": "string (optionnel, surcharge la couleur du type)",
  "text_color_hex": "string (optionnel, surcharge la couleur du texte)"
}
```

## Permissions requises

- `org.read` : Pour lire les types
- `org.settings.manage` : Pour créer/modifier/supprimer des types
- `events.read` : Pour lire la configuration des événements
- `events.settings.manage` : Pour configurer les types par événement

## Notes importantes

1. **Unicité du code** : Le code d'un attendee type doit être unique au sein d'une organisation
2. **Couleurs personnalisées** : Les couleurs définies au niveau de l'événement écrasent celles du type global
3. **Capacité** : La capacité peut être définie uniquement au niveau de l'événement
4. **Soft delete** : Les types ne sont jamais vraiment supprimés si des inscriptions y sont liées

## Exemples de cas d'usage

### Cas 1 : Événement avec VIP et participants normaux

```bash
# 1. Créer les types au niveau organisation
POST /orgs/{orgId}/attendee-types
{
  "code": "vip",
  "name": "VIP",
  "color_hex": "#FFD700"
}

POST /orgs/{orgId}/attendee-types
{
  "code": "standard",
  "name": "Participant Standard",
  "color_hex": "#3498DB"
}

# 2. Configurer pour l'événement
POST /orgs/{orgId}/events/{eventId}/attendee-types
{
  "attendeeTypeId": "{vip_type_id}"
}

PUT /orgs/{orgId}/events/{eventId}/attendee-types/{event_type_id}
{
  "capacity": 20,
  "color_hex": "#FF6B35"
}
```

### Cas 2 : Conférence avec speakers et participants

```bash
# Créer le type speaker
POST /orgs/{orgId}/attendee-types
{
  "code": "speaker",
  "name": "Conférencier",
  "color_hex": "#E74C3C",
  "icon": "microphone"
}

# L'ajouter à l'événement sans limite de capacité
POST /orgs/{orgId}/events/{eventId}/attendee-types
{
  "attendeeTypeId": "{speaker_type_id}"
}
```

## Résolution de problèmes

### Erreur 401 Unauthorized
- Vérifiez que votre token est valide
- Vérifiez que le header Authorization est bien formaté : `Bearer {token}`

### Erreur 403 Forbidden
- Vérifiez que votre utilisateur a les permissions nécessaires
- Un ADMIN ou MANAGER devrait avoir accès à ces endpoints

### Erreur 409 Conflict
- Le code existe déjà : choisissez un code unique
- Le type est déjà ajouté à l'événement : utilisez PUT pour mettre à jour

### Erreur 404 Not Found
- Vérifiez que l'ID de l'organisation, de l'événement ou du type est correct
- Vérifiez que la ressource appartient bien à votre organisation
