# 🔧 Troubleshooting - Phase 1 Core

## Problèmes Courants et Solutions

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
