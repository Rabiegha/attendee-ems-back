# Guide de Test Manuel - Phase 1 Core

## 🔐 Authentification

### 1. Obtenir un token JWT

**Login avec un utilisateur seed** :
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane.smith@acme.com",
    "password": "admin123"
  }'
```

**Utilisateurs disponibles** (après seed) :
- **SUPER_ADMIN** : `john.doe@system.com` / `admin123`
- **ADMIN** : `jane.smith@acme.com` / `admin123`
- **MANAGER** : `bob.johnson@acme.com` / `manager123`
- **VIEWER** : `alice.wilson@acme.com` / `viewer123`
- **PARTNER** : `charlie.brown@acme.com` / `sales123`

**Réponse** :
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

**Utiliser le token** :
```bash
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 📅 Scénario 1 : Créer et Publier un Événement

### Étape 1 : Créer un événement (ADMIN)
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "CONF2024",
    "name": "Tech Conference 2024",
    "start_at": "2024-12-15T09:00:00Z",
    "end_at": "2024-12-15T18:00:00Z",
    "timezone": "Europe/Paris",
    "status": "draft",
    "capacity": 100,
    "location_type": "physical",
    "description": "Annual tech conference for developers",
    "address_city": "Paris",
    "address_country": "France",
    "registration_auto_approve": false
  }'
```

**Vérifier la réponse** :
- ✅ Event créé avec `id`
- ✅ `settings.public_token` présent (16 caractères alphanumériques)
- ✅ `status` = "draft"

**Sauvegarder** :
```bash
export EVENT_ID="<id_from_response>"
export PUBLIC_TOKEN="<public_token_from_response>"
```

### Étape 2 : Publier l'événement
```bash
curl -X PUT http://localhost:3000/api/events/$EVENT_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "published"}'
```

**Vérifier** : `status` = "published"

---

## 🌐 Scénario 2 : Inscription Publique

### Étape 1 : Consulter l'événement (sans auth)
```bash
curl -X GET http://localhost:3000/api/public/events/$PUBLIC_TOKEN
```

**Vérifier** :
- ✅ Pas d'erreur 401 (pas d'auth requise)
- ✅ Champs safe uniquement (pas d'IDs internes)
- ✅ `registration_fields` présent

### Étape 2 : S'inscrire (sans auth)
```bash
curl -X POST http://localhost:3000/api/public/events/$PUBLIC_TOKEN/register \
  -H "Content-Type: application/json" \
  -d '{
    "attendee": {
      "email": "corentin@example.com",
      "first_name": "Corentin",
      "last_name": "Kistler",
      "phone": "+33601020304",
      "company": "MyCompany",
      "job_title": "CTO",
      "country": "FR"
    },
    "attendance_type": "onsite",
    "answers": {
      "dietary": "vegetarian",
      "tshirt_size": "L"
    }
  }'
```

**Vérifier** :
- ✅ Registration créée
- ✅ `status` = "awaiting" (car `registration_auto_approve` = false)
- ✅ `attendee` créé avec email

**Sauvegarder** :
```bash
export REGISTRATION_ID="<id_from_response>"
```

### Étape 3 : Tester doublon (même email)
```bash
curl -X POST http://localhost:3000/api/public/events/$PUBLIC_TOKEN/register \
  -H "Content-Type: application/json" \
  -d '{
    "attendee": {
      "email": "corentin@example.com",
      "first_name": "Corentin",
      "last_name": "Kistler"
    },
    "attendance_type": "onsite"
  }'
```

**Vérifier** : 409 Conflict "already registered"

---

## 📝 Scénario 3 : Gestion des Inscriptions

### Étape 1 : Lister les inscriptions (ADMIN)
```bash
curl -X GET "http://localhost:3000/api/events/$EVENT_ID/registrations?page=1&limit=20&sortBy=created_at&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN"
```

**Vérifier** :
- ✅ Liste paginée
- ✅ Données attendee complètes (email, company, etc.)
- ✅ `meta` avec pagination

### Étape 2 : Filtrer par company
```bash
curl -X GET "http://localhost:3000/api/events/$EVENT_ID/registrations?company=MyCompany" \
  -H "Authorization: Bearer $TOKEN"
```

**Vérifier** : Seules les inscriptions de "MyCompany"

### Étape 3 : Rechercher par nom/email
```bash
curl -X GET "http://localhost:3000/api/events/$EVENT_ID/registrations?search=corentin" \
  -H "Authorization: Bearer $TOKEN"
```

**Vérifier** : Résultats filtrés

### Étape 4 : Approuver une inscription (ADMIN)
```bash
curl -X PUT http://localhost:3000/api/registrations/$REGISTRATION_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
```

**Vérifier** :
- ✅ `status` = "approved"
- ✅ `confirmed_at` automatiquement set

---

## 🚫 Scénario 4 : Règle HOSTESS

### Étape 1 : Login en tant que HOSTESS
```bash
# Créer d'abord un user HOSTESS via seed ou API
# Puis login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "hostess@acme.com",
    "password": "hostess123"
  }'

export HOSTESS_TOKEN="<token>"
```

### Étape 2 : Lire les inscriptions (OK)
```bash
curl -X GET "http://localhost:3000/api/events/$EVENT_ID/registrations" \
  -H "Authorization: Bearer $HOSTESS_TOKEN"
```

**Vérifier** : ✅ Données complètes visibles (pas de masking)

### Étape 3 : Tenter de changer le statut (FORBIDDEN)
```bash
curl -X PUT http://localhost:3000/api/registrations/$REGISTRATION_ID/status \
  -H "Authorization: Bearer $HOSTESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
```

**Vérifier** : ❌ 403 Forbidden "HOSTESS role cannot update registration status"

---

## 🔄 Scénario 5 : Création Authentifiée avec Upsert

### Étape 1 : Créer une inscription (ADMIN)
```bash
curl -X POST http://localhost:3000/api/events/$EVENT_ID/registrations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "attendee": {
      "email": "alice@example.com",
      "first_name": "Alice",
      "last_name": "Smith",
      "company": "ACME Corp",
      "job_title": "Developer"
    },
    "attendance_type": "hybrid",
    "answers": {
      "workshop": "AI & ML"
    }
  }'
```

**Vérifier** :
- ✅ Attendee créé ou mis à jour
- ✅ Registration créée

### Étape 2 : Créer une autre inscription pour le même attendee
```bash
# Créer un autre événement d'abord
curl -X POST http://localhost:3000/api/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "WORKSHOP2024",
    "name": "AI Workshop",
    "start_at": "2024-12-20T14:00:00Z",
    "end_at": "2024-12-20T17:00:00Z",
    "status": "published"
  }'

export EVENT_ID_2="<new_event_id>"

# Inscrire le même attendee
curl -X POST http://localhost:3000/api/events/$EVENT_ID_2/registrations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "attendee": {
      "email": "alice@example.com",
      "company": "ACME Corp Updated"
    },
    "attendance_type": "online"
  }'
```

**Vérifier** :
- ✅ Attendee mis à jour (company updated)
- ✅ Nouvelle registration créée pour le 2ème événement

---

## 🎯 Scénario 6 : Vérification Capacité

### Étape 1 : Créer un événement avec capacité limitée
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "SMALL2024",
    "name": "Small Event",
    "start_at": "2024-12-25T10:00:00Z",
    "end_at": "2024-12-25T12:00:00Z",
    "status": "published",
    "capacity": 2
  }'

export SMALL_EVENT_TOKEN="<public_token>"
```

### Étape 2 : Remplir la capacité
```bash
# Inscription 1
curl -X POST http://localhost:3000/api/public/events/$SMALL_EVENT_TOKEN/register \
  -H "Content-Type: application/json" \
  -d '{
    "attendee": {"email": "user1@test.com", "first_name": "User", "last_name": "One"},
    "attendance_type": "onsite"
  }'

# Inscription 2
curl -X POST http://localhost:3000/api/public/events/$SMALL_EVENT_TOKEN/register \
  -H "Content-Type: application/json" \
  -d '{
    "attendee": {"email": "user2@test.com", "first_name": "User", "last_name": "Two"},
    "attendance_type": "onsite"
  }'
```

### Étape 3 : Tenter une 3ème inscription
```bash
curl -X POST http://localhost:3000/api/public/events/$SMALL_EVENT_TOKEN/register \
  -H "Content-Type: application/json" \
  -d '{
    "attendee": {"email": "user3@test.com", "first_name": "User", "last_name": "Three"},
    "attendance_type": "onsite"
  }'
```

**Vérifier** : ❌ 409 Conflict "Event is full"

---

## 📊 Scénario 7 : Tri et Pagination

### Trier par company
```bash
curl -X GET "http://localhost:3000/api/events/$EVENT_ID/registrations?sortBy=company&sortOrder=asc" \
  -H "Authorization: Bearer $TOKEN"
```

### Trier par date de création
```bash
curl -X GET "http://localhost:3000/api/events/$EVENT_ID/registrations?sortBy=created_at&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN"
```

### Pagination
```bash
# Page 1
curl -X GET "http://localhost:3000/api/events/$EVENT_ID/registrations?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Page 2
curl -X GET "http://localhost:3000/api/events/$EVENT_ID/registrations?page=2&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

---

## ✅ Checklist de Validation

### Events Module
- [ ] POST /api/events crée event + settings avec public_token unique
- [ ] GET /api/events retourne liste paginée
- [ ] GET /api/events/:id retourne event avec settings
- [ ] PUT /api/events/:id met à jour event
- [ ] DELETE /api/events/:id échoue si registrations existent
- [ ] PUT /api/events/:id/status change le statut

### Public Module
- [ ] GET /api/public/events/:token fonctionne sans auth
- [ ] POST /api/public/events/:token/register crée registration
- [ ] Upsert attendee fonctionne (update si existe)
- [ ] Doublon awaiting/approved → 409
- [ ] Doublon refused → 403
- [ ] Capacité atteinte → 409
- [ ] Auto-approve fonctionne si activé

### Registrations Module
- [ ] GET /api/events/:id/registrations liste avec filtres
- [ ] Filtres fonctionnent (status, company, search)
- [ ] Tri fonctionne (created_at, company, etc.)
- [ ] Pagination fonctionne
- [ ] PUT /api/registrations/:id/status met à jour
- [ ] confirmed_at set automatiquement sur approval
- [ ] HOSTESS peut lire mais pas update (403)
- [ ] POST /api/events/:id/registrations crée avec upsert

### Multi-tenant & Permissions
- [ ] Tous endpoints vérifient org_id
- [ ] PermissionsGuard bloque accès non autorisé
- [ ] ADMIN voit seulement son org
- [ ] SUPER_ADMIN peut agir cross-org

---

## 🐛 Debugging

### Voir les logs
```bash
npm run docker:logs
```

### Shell dans le container
```bash
npm run docker:shell
```

### Vérifier la DB
```bash
npm run docker:shell:db
# Puis dans psql:
\dt                           # Lister les tables
SELECT * FROM events;         # Voir les événements
SELECT * FROM registrations;  # Voir les inscriptions
```

### Régénérer Prisma client
```bash
npm run docker:generate
```

---

## 📝 Notes

- Tous les tokens JWT expirent après 15 minutes (configurable)
- Les public_tokens sont permanents (pas d'expiration)
- Les emails sont case-insensitive (citext)
- Les codes événements sont uniques par organisation
