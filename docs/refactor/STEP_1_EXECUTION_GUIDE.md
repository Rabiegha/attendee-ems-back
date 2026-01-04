# Guide d'Exécution - STEP 1 Multi-tenant Refactor

## 📋 Prérequis

- PostgreSQL 14+ installé et en cours d'exécution
- Node.js 18+ et npm/yarn
- Backup de votre base de données actuelle
- Accès aux variables d'environnement (`DATABASE_URL`)

---

## ⚠️ IMPORTANT - Backup

**AVANT toute opération, faire un backup complet de la base de données !**

```bash
# Backup PostgreSQL
pg_dump -U postgres -d attendee_ems > backup_before_step1_$(date +%Y%m%d_%H%M%S).sql

# Ou via Docker si vous utilisez docker-compose
docker-compose exec postgres pg_dump -U postgres attendee_ems > backup_before_step1_$(date +%Y%m%d_%H%M%S).sql
```

---

## 🚀 Étapes d'Exécution

### 1. Vérifier le schéma Prisma

```bash
# Vérifier que le schéma est valide
npx prisma validate
```

### 2. Générer le client Prisma

```bash
# Générer le nouveau client avec les nouveaux modèles
npx prisma generate
```

### 3. Créer et appliquer la migration

```bash
# Créer la migration (si pas déjà créée)
npx prisma migrate dev --name step1_multitenant_refactor --create-only

# OU appliquer la migration existante
npx prisma migrate deploy
```

**Alternative : Exécution manuelle du SQL**

Si vous préférez exécuter manuellement le SQL :

```bash
# Connexion à PostgreSQL
psql -U postgres -d attendee_ems

# Exécuter le fichier SQL
\i prisma/migrations/STEP1_MULTITENANT_REFACTOR/migration.sql
```

### 4. Exécuter le seed idempotent

```bash
# Exécuter le seed pour créer les rôles par défaut
npx ts-node prisma/seeds/step1-multitenant.seed.ts

# OU via npm script (à ajouter dans package.json)
npm run seed:step1
```

### 5. Valider la migration

```bash
# Vérifier l'état de la base de données
npx prisma migrate status

# Vérifier que le client Prisma fonctionne
npx prisma studio
```

---

## 🔍 Validation Post-Migration

### Vérifier les tables créées

```sql
-- Vérifier que les nouvelles tables existent
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'org_users', 
    'tenant_user_roles', 
    'platform_user_roles', 
    'platform_user_org_access'
  );
```

### Vérifier les contraintes

```sql
-- Vérifier les contraintes UNIQUE
SELECT conname, contype, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid IN (
  'org_users'::regclass,
  'tenant_user_roles'::regclass,
  'platform_user_roles'::regclass
);
```

### Vérifier les triggers

```sql
-- Vérifier que les triggers sont créés
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name IN (
  'trigger_check_platform_role',
  'trigger_check_tenant_role'
);
```

### Vérifier les données migrées

```sql
-- Vérifier que tous les users ont un membership
SELECT 
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(DISTINCT user_id) FROM org_users) as users_with_membership,
  (SELECT COUNT(*) FROM users) - (SELECT COUNT(DISTINCT user_id) FROM org_users) as orphan_users;

-- Vérifier que tous les users ont un rôle tenant
SELECT 
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(DISTINCT user_id) FROM tenant_user_roles) as users_with_tenant_role;
```

---

## 🔧 Ajouter le Script Seed au package.json

Ajoutez cette ligne dans votre `package.json` :

```json
{
  "scripts": {
    "seed:step1": "ts-node prisma/seeds/step1-multitenant.seed.ts"
  }
}
```

---

## 🧪 Tests à Exécuter

### Test 1 : Créer un user multi-tenant

```typescript
// Test: un user peut appartenir à 2 orgs avec des rôles différents
const user = await prisma.user.create({
  data: {
    email: 'test@example.com',
    password_hash: 'hashed',
  },
});

// Membership org 1
await prisma.orgUser.create({
  data: {
    user_id: user.id,
    org_id: 'org-1-id',
  },
});

// Rôle tenant org 1
await prisma.tenantUserRole.create({
  data: {
    user_id: user.id,
    org_id: 'org-1-id',
    role_id: 'role-admin-org1',
  },
});

// Membership org 2
await prisma.orgUser.create({
  data: {
    user_id: user.id,
    org_id: 'org-2-id',
  },
});

// Rôle tenant org 2
await prisma.tenantUserRole.create({
  data: {
    user_id: user.id,
    org_id: 'org-2-id',
    role_id: 'role-viewer-org2',
  },
});

// ✅ Le user est maintenant Admin dans org-1 et Viewer dans org-2
```

### Test 2 : Créer un user platform

```typescript
// Test: un user avec rôle support et accès à 2 orgs
const supportUser = await prisma.user.create({
  data: {
    email: 'support@example.com',
    password_hash: 'hashed',
  },
});

// Rôle platform
await prisma.platformUserRole.create({
  data: {
    user_id: supportUser.id,
    role_id: 'role-support',
    scope: 'assigned',
  },
});

// Accès à 2 orgs spécifiques
await prisma.platformUserOrgAccess.createMany({
  data: [
    { user_id: supportUser.id, org_id: 'org-1-id' },
    { user_id: supportUser.id, org_id: 'org-2-id' },
  ],
});

// ✅ Le user peut accéder aux orgs 1 et 2 uniquement
```

### Test 3 : Vérifier les contraintes

```typescript
// Test: impossible d'assigner 2 rôles tenant pour la même org
try {
  await prisma.tenantUserRole.create({
    data: {
      user_id: user.id,
      org_id: 'org-1-id',
      role_id: 'role-manager-org1', // Différent rôle
    },
  });
  // ❌ Devrait échouer (UNIQUE constraint)
} catch (error) {
  // ✅ Erreur attendue : duplicate key value violates unique constraint
}

// Test: impossible d'assigner un rôle sans membership
try {
  await prisma.tenantUserRole.create({
    data: {
      user_id: user.id,
      org_id: 'org-3-id', // Pas de membership dans org-3
      role_id: 'role-admin-org3',
    },
  });
  // ❌ Devrait échouer (FK constraint)
} catch (error) {
  // ✅ Erreur attendue : foreign key constraint
}
```

---

## 🐛 Troubleshooting

### Erreur : "relation does not exist"

```bash
# Solution : recréer le client Prisma
npx prisma generate
```

### Erreur : "column does not exist"

```bash
# Solution : vérifier que la migration a bien été appliquée
npx prisma migrate status

# Si nécessaire, réappliquer
npx prisma migrate deploy
```

### Erreur : "duplicate key value violates unique constraint"

- Vérifier que les données existantes ne violent pas les nouvelles contraintes
- Nettoyer les doublons avant de relancer la migration

### Données orphelines après migration

```sql
-- Nettoyer les users sans membership
DELETE FROM users 
WHERE id NOT IN (SELECT DISTINCT user_id FROM org_users);

-- OU créer un membership par défaut
INSERT INTO org_users (user_id, org_id, joined_at, created_at, updated_at)
SELECT u.id, 'default-org-id', NOW(), NOW(), NOW()
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM org_users ou WHERE ou.user_id = u.id
);
```

---

## 🔄 Rollback (si nécessaire)

**En cas de problème critique, restaurer le backup :**

```bash
# Arrêter l'application
pm2 stop all  # ou docker-compose down

# Restaurer le backup
psql -U postgres -d attendee_ems < backup_before_step1_YYYYMMDD_HHMMSS.sql

# Redémarrer l'application
pm2 start all  # ou docker-compose up -d
```

**OU utiliser la commande Prisma :**

```bash
# Revenir à la migration précédente
npx prisma migrate resolve --rolled-back STEP1_MULTITENANT_REFACTOR

# Appliquer la migration précédente
npx prisma migrate deploy
```

---

## 📚 Documentation Complète

- [STEP_1_MULTITENANT.md](./STEP_1_MULTITENANT.md) : Documentation détaillée du modèle
- [schema.prisma](../../prisma/schema.prisma) : Schéma Prisma complet
- [migration.sql](../../prisma/migrations/STEP1_MULTITENANT_REFACTOR/migration.sql) : Migration SQL
- [step1-multitenant.seed.ts](../../prisma/seeds/step1-multitenant.seed.ts) : Seed idempotent

---

## ✅ Checklist Finale

- [ ] Backup de la base de données effectué
- [ ] Schéma Prisma validé (`npx prisma validate`)
- [ ] Client Prisma généré (`npx prisma generate`)
- [ ] Migration appliquée (`npx prisma migrate deploy`)
- [ ] Seed exécuté (`npm run seed:step1`)
- [ ] Tables créées vérifiées
- [ ] Contraintes vérifiées
- [ ] Triggers vérifiés
- [ ] Données migrées vérifiées
- [ ] Tests unitaires passent
- [ ] Tests d'intégration passent
- [ ] Application redémarrée et fonctionnelle
- [ ] Aucune régression constatée

---

**Besoin d'aide ?**  
Consultez la documentation complète dans [STEP_1_MULTITENANT.md](./STEP_1_MULTITENANT.md)
