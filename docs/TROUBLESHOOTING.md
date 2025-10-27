# 🔧 Guide de Dépannage - EMS

## 📅 Problème 1: Date d'inscription affichée "null"

### Symptôme
Dans le tableau des inscriptions, la colonne "Date d'inscription" affiche "null" ou "--".

### Cause
Le frontend cherchait un champ `registered_at` qui n'existe pas dans l'API. Le backend utilise `created_at` comme date d'inscription.

### ✅ Solution (Corrigée)
Les mappers frontend ont été mis à jour pour utiliser `created_at` du backend. Les dates d'inscription s'affichent maintenant correctement.

---

## 📞 Problème 2: Champ téléphone non enregistré

### Symptôme
Quand vous ajoutez un champ "Téléphone" dans le formulaire d'inscription, les données ne sont pas enregistrées dans la colonne `phone` de la base de données.

### Cause Probable
Le champ n'est pas configuré correctement dans le FormBuilder.

### ✅ Solution

1. **Aller dans l'onglet "Formulaire" de votre événement**

2. **Ajouter le champ téléphone avec les bons paramètres :**
   - **Nom du champ**: `phone` (exactement, sensible à la casse)
   - **Type**: `Téléphone` (ou `tel`)
   - **Label**: "Téléphone" (ce qui s'affiche)
   - **Requis**: Selon votre besoin

3. **Vérification dans la liste des champs :**
   ```
   ✅ Correct:
   - id: phone
   - name: phone  
   - type: tel
   - label: Téléphone
   
   ❌ Incorrect:
   - name: telephone (mauvais nom)
   - name: Phone (majuscule)
   - name: tel (trop court)
   ```

4. **Test d'inscription :**
   - Activer le "Mode Test" 
   - Remplir le formulaire avec un numéro de téléphone
   - Vérifier dans la base de données que la colonne `phone` est remplie

### Mapping des champs standards

Le système reconnaît automatiquement ces noms de champs :

| Nom du champ | Colonne DB | Description |
|--------------|------------|-------------|
| `firstName` | `first_name` | Prénom |
| `lastName` | `last_name` | Nom |
| `email` | `email` | Email (requis) |
| `phone` | `phone` | Téléphone |
| `company` | `company` | Entreprise |
| `jobTitle` | `job_title` | Fonction |
| `country` | `country` | Pays |

**Important :** Tous les autres noms de champs sont stockés dans la colonne `answers` (JSONB).

---

## 🔍 Vérification en base de données

Pour vérifier que les données sont bien enregistrées :

```sql
-- Voir les inscriptions avec les détails attendee
SELECT 
  r.id,
  r.created_at as date_inscription,
  a.email,
  a.first_name,
  a.last_name,
  a.phone,  -- ← Doit contenir le numéro
  a.company,
  r.answers  -- ← Champs personnalisés
FROM registrations r
JOIN attendees a ON r.attendee_id = a.id
WHERE r.event_id = 'votre-event-id'
ORDER BY r.created_at DESC;
```

---

## 🚨 Problèmes courants

### Le champ phone reste null
- ✅ Vérifiez que le nom du champ est exactement `phone`
- ✅ Testez avec le mode test activé
- ✅ Vérifiez que le type de champ est `tel` ou `text`

### Les données vont dans answers au lieu des colonnes
- ✅ Le nom du champ ne correspond pas aux noms standards
- ✅ Utilisez les noms exacts du tableau ci-dessus

### La date d'inscription est null
- ✅ Problème corrigé dans les mappers frontend 
- ✅ Redémarrez le frontend si nécessaire

---

## 📊 Architecture des données

```
📊 BASE DE DONNÉES
│
├── 👥 attendees (informations personnelles)
│   ├── email (requis)
│   ├── first_name 
│   ├── last_name
│   ├── phone ← Stocké ici
│   ├── company
│   ├── job_title
│   └── country
│
└── 📝 registrations (inscription à l'événement)
    ├── created_at ← Date d'inscription
    ├── status (awaiting/approved/refused)
    ├── attendance_type (onsite/online/hybrid)
    └── answers (JSONB) ← Champs personnalisés
```

---

## 🛠️ Tests recommandés

1. **Test complet d'inscription :**
   ```
   1. Ajouter le champ "phone" au formulaire
   2. Activer le mode test
   3. Remplir : email, prénom, nom, téléphone
   4. Soumettre le formulaire
   5. Vérifier dans la liste des inscriptions
   6. Contrôler en base de données
   ```

2. **Test des champs personnalisés :**
   ```
   1. Ajouter un champ "allergies" 
   2. Le remplir lors de l'inscription
   3. Vérifier qu'il apparaît dans answers
   ```

---

## Problèmes Techniques Courants et Solutions

### ❌ Erreur: "Cannot find module 'nanoid'"

**Symptôme** :
```
error TS2307: Cannot find module 'nanoid' or its corresponding type declarations.
```

**Cause** : Le package `nanoid` a été installé dans le container Docker mais pas localement.

**Solution** :
```bash
npm install nanoid
```

---

### ❌ Erreur: Prisma Client types manquants

**Symptôme** :
```
error: Cannot find module '@prisma/client' or its corresponding type declarations
error: Property 'event' does not exist on type 'PrismaService'
error: Property 'registration' does not exist on type 'PrismaService'
```

**Cause** : Le client Prisma local n'est pas synchronisé avec le schéma après la migration.

**Solution** :
```bash
# Régénérer le client Prisma localement
npx prisma generate

# Ou dans Docker
npm run docker:generate
```

**Explication** : Le client Prisma doit être régénéré après chaque modification du schéma pour que TypeScript reconnaisse les nouveaux modèles.

---

### ❌ Erreur: "Argument of type 'string[]' is not assignable to parameter of type 'string'"

**Symptôme** :
```
error TS2345: Argument of type 'string[]' is not assignable to parameter of type 'string'.
@Permissions(['events.create'])
```

**Cause** : Le decorator `@Permissions` attend un spread de strings, pas un array.

**Solution** : Utiliser le spread au lieu d'un array :
```typescript
// ❌ Incorrect
@Permissions(['events.create'])
@Permissions(['events.read:any', 'events.read:own'])

// ✅ Correct
@Permissions('events.create')
@Permissions('events.read:any', 'events.read:own')
```

**Explication** : Le decorator est défini comme :
```typescript
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
```
Il utilise le rest parameter (`...permissions`), donc il faut passer les strings directement, pas dans un array.

---

### ❌ Erreur: "Spread types may only be created from object types"

**Symptôme** :
```
error TS2698: Spread types may only be created from object types.
where.start_at = { ...where.start_at, gte: new Date(dto.startAfter) };
```

**Cause** : TypeScript ne peut pas spread une propriété qui peut être `undefined`.

**Solution** : Initialiser l'objet avant d'ajouter les propriétés :
```typescript
// ❌ Incorrect
if (dto.startAfter) {
  where.start_at = { ...where.start_at, gte: new Date(dto.startAfter) };
}

// ✅ Correct
if (dto.startAfter || dto.startBefore) {
  where.start_at = {};
  if (dto.startAfter) {
    where.start_at.gte = new Date(dto.startAfter);
  }
  if (dto.startBefore) {
    where.start_at.lte = new Date(dto.startBefore);
  }
}
```

---

### ❌ Erreur: "Cannot connect to database"

**Symptôme** :
```
Error: P1001: Can't reach database server at `ems_db:5432`
```

**Cause** : Docker n'est pas démarré ou la base de données n'est pas prête.

**Solution** :
```bash
# Vérifier que Docker tourne
docker ps

# Démarrer les containers
npm run docker:up

# Attendre quelques secondes que la DB soit prête
sleep 5

# Vérifier la connexion
npm run docker:shell:db
```

---

### ❌ Erreur: "Migration failed"

**Symptôme** :
```
Error: Migration failed to apply
```

**Cause** : Conflit avec l'état actuel de la base de données.

**Solution** :
```bash
# Option 1: Reset complet (DEV ONLY)
npm run docker:migrate:reset

# Option 2: Vérifier le statut
npm run docker:db:status

# Option 3: Appliquer manuellement
npm run docker:migrate
```

**⚠️ Attention** : `migrate:reset` supprime toutes les données. À utiliser uniquement en développement.

---

### ❌ Erreur: "Permission denied" sur les endpoints

**Symptôme** :
```
403 Forbidden: Insufficient permissions
```

**Cause** : L'utilisateur n'a pas la permission requise ou le token est invalide.

**Solution** :
```bash
# 1. Vérifier que le seed a été exécuté
npm run docker:seed

# 2. Vérifier les permissions de l'utilisateur
# Se connecter à la DB
npm run docker:shell:db

# Dans psql
SELECT r.code, p.code 
FROM users u 
JOIN roles r ON u.role_id = r.id 
JOIN role_permissions rp ON r.id = rp.role_id 
JOIN permissions p ON p.id = rp.permission_id 
WHERE u.email = 'jane.smith@acme.com';

# 3. Obtenir un nouveau token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane.smith@acme.com","password":"admin123"}'
```

---

### ❌ Erreur: "Event is full" (409)

**Symptôme** :
```
409 Conflict: Event is full
```

**Cause** : La capacité de l'événement est atteinte.

**Solution** :
```bash
# Option 1: Augmenter la capacité
curl -X PUT http://localhost:3000/api/events/:id \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"capacity": 200}'

# Option 2: Annuler des inscriptions
curl -X PUT http://localhost:3000/api/registrations/:id/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "cancelled"}'
```

---

### ❌ Erreur: "Already registered" (409)

**Symptôme** :
```
409 Conflict: You are already registered for this event
```

**Cause** : L'attendee (par email) est déjà inscrit à cet événement.

**Solution** : C'est le comportement attendu. Pour réinscrire :
1. Annuler l'inscription existante (status = 'cancelled')
2. Créer une nouvelle inscription

---

### ❌ Erreur: "HOSTESS role cannot update registration status" (403)

**Symptôme** :
```
403 Forbidden: HOSTESS role cannot update registration status
```

**Cause** : C'est le comportement attendu. Le rôle HOSTESS ne peut pas modifier le statut des inscriptions.

**Solution** : Utiliser un compte ADMIN ou MANAGER pour modifier les statuts.

---

## 🔄 Procédure de Reset Complet (DEV)

Si tout est cassé et que vous voulez repartir de zéro :

```bash
# 1. Arrêter Docker
npm run docker:down

# 2. Supprimer les volumes (⚠️ SUPPRIME LES DONNÉES)
docker volume prune -f

# 3. Redémarrer
npm run docker:up

# 4. Attendre que la DB soit prête
sleep 10

# 5. Appliquer les migrations
npm run docker:migrate

# 6. Seed les données
npm run docker:seed

# 7. Régénérer le client Prisma local
npx prisma generate

# 8. Redémarrer l'IDE TypeScript server
```

---

## 🐛 Debug Mode

### Activer les logs Prisma

Modifier `.env` :
```env
DATABASE_URL="postgresql://..."
DEBUG="prisma:*"
```

### Voir les requêtes SQL

Dans le code :
```typescript
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

### Logs Docker

```bash
# Logs API
npm run docker:logs

# Logs DB
npm run docker:logs:db

# Suivre en temps réel
npm run docker:logs -- -f
```

---

## 📞 Besoin d'Aide ?

1. **Vérifier la documentation** :
   - [QUICK_START.md](QUICK_START.md)
   - [TESTING_GUIDE.md](TESTING_GUIDE.md)
   - [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)

2. **Vérifier les logs** :
   ```bash
   npm run docker:logs
   ```

3. **Vérifier l'état de la DB** :
   ```bash
   npm run docker:db:status
   ```

4. **Reset complet** (dernier recours) :
   Voir "Procédure de Reset Complet" ci-dessus

---

**Troubleshooting Phase 1 Core** - Solutions aux problèmes courants
