# Quick Reference - STEP 1 Multi-tenant

## 📦 Fichiers Créés

```
attendee-ems-back/
├── prisma/
│   ├── schema.prisma                                    # ✅ Modifié
│   ├── migrations/
│   │   └── STEP1_MULTITENANT_REFACTOR/
│   │       └── migration.sql                            # ✅ Nouveau
│   └── seeds/
│       └── step1-multitenant.seed.ts                    # ✅ Nouveau
├── scripts/
│   └── validate-step1-migration.ts                      # ✅ Nouveau
├── test/
│   └── step1-multitenant.spec.ts                        # ✅ Nouveau
├── docs/
│   └── refactor/
│       ├── README.md                                    # ✅ Nouveau
│       ├── STEP_1_MULTITENANT.md                        # ✅ Nouveau
│       ├── STEP_1_EXECUTION_GUIDE.md                    # ✅ Nouveau
│       └── STEP_1_DIAGRAMS.md                           # ✅ Nouveau
└── package.json                                         # ✅ Modifié
```

---

## 🚀 Commandes Rapides

### 1. Backup (OBLIGATOIRE)
```bash
# Backup PostgreSQL
pg_dump -U postgres -d attendee_ems > backup_step1_$(date +%Y%m%d_%H%M%S).sql

# OU via Docker
docker-compose exec postgres pg_dump -U postgres attendee_ems > backup_step1_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Valider le Schéma
```bash
npx prisma validate
```

### 3. Générer le Client Prisma
```bash
npx prisma generate
```

### 4. Appliquer la Migration
```bash
npx prisma migrate deploy

# OU créer une nouvelle migration
npx prisma migrate dev --name step1_multitenant_refactor
```

### 5. Exécuter le Seed
```bash
npm run db:seed:step1
```

### 6. Valider la Migration
```bash
npm run db:validate:step1
```

### 7. Exécuter les Tests
```bash
npm test -- step1-multitenant.spec.ts
```

### 8. Ouvrir Prisma Studio
```bash
npx prisma studio
```

---

## 🐳 Avec Docker

```bash
# 1. Backup
docker-compose exec db pg_dump -U postgres ems > backup.sql

# 2. Générer le client
docker-compose exec api npx prisma generate

# 3. Migration
docker-compose exec api npx prisma migrate deploy

# 4. Seed
docker-compose exec api npm run db:seed:step1

# 5. Validation
docker-compose exec api npm run db:validate:step1

# 6. Tests
docker-compose exec api npm test -- step1-multitenant.spec.ts
```

---

## 📊 Vérifications Manuelles

### Vérifier les tables créées
```sql
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
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'tenant_user_roles'::regclass;
```

### Vérifier les triggers
```sql
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE 'trigger_check_%';
```

### Vérifier les données migrées
```sql
-- Tous les users ont un membership ?
SELECT 
  (SELECT COUNT(*) FROM users) as total_users,
  (SELECT COUNT(DISTINCT user_id) FROM org_users) as users_with_membership;

-- Tous les memberships ont un rôle ?
SELECT 
  (SELECT COUNT(*) FROM org_users) as total_memberships,
  (SELECT COUNT(*) FROM tenant_user_roles) as memberships_with_role;
```

---

## 🔥 Rollback (si problème)

### Option 1 : Restaurer le backup
```bash
# Arrêter l'application
pm2 stop all  # ou docker-compose down

# Restaurer le backup
psql -U postgres -d attendee_ems < backup_step1_YYYYMMDD_HHMMSS.sql

# Redémarrer
pm2 start all  # ou docker-compose up -d
```

### Option 2 : Reset Prisma
```bash
# Marquer comme rolled back
npx prisma migrate resolve --rolled-back STEP1_MULTITENANT_REFACTOR

# Reset complet (⚠️ ATTENTION : supprime toutes les données)
npx prisma migrate reset
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [README.md](./README.md) | Vue d'ensemble du refactor |
| [STEP_1_MULTITENANT.md](./STEP_1_MULTITENANT.md) | Documentation complète du modèle |
| [STEP_1_EXECUTION_GUIDE.md](./STEP_1_EXECUTION_GUIDE.md) | Guide d'exécution détaillé |
| [STEP_1_DIAGRAMS.md](./STEP_1_DIAGRAMS.md) | Diagrammes et schémas |

---

## ✅ Checklist Finale

- [ ] Backup effectué
- [ ] Schéma validé (`npx prisma validate`)
- [ ] Client généré (`npx prisma generate`)
- [ ] Migration appliquée (`npx prisma migrate deploy`)
- [ ] Seed exécuté (`npm run db:seed:step1`)
- [ ] Validation réussie (`npm run db:validate:step1`)
- [ ] Tests passent (`npm test -- step1-multitenant.spec.ts`)
- [ ] Prisma Studio fonctionne (`npx prisma studio`)
- [ ] Application redémarrée
- [ ] Aucune régression constatée

---

## 🆘 En Cas de Problème

### Erreur : "relation does not exist"
```bash
npx prisma generate
```

### Erreur : "column does not exist"
```bash
npx prisma migrate status
npx prisma migrate deploy
```

### Erreur : "duplicate key value"
Nettoyer les doublons :
```sql
-- Voir les doublons
SELECT user_id, org_id, COUNT(*) 
FROM org_users 
GROUP BY user_id, org_id 
HAVING COUNT(*) > 1;

-- Supprimer les doublons (garder le plus récent)
DELETE FROM org_users a
USING org_users b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.org_id = b.org_id;
```

### Base de données corrompue
```bash
# Restaurer le backup
psql -U postgres -d attendee_ems < backup.sql
```

---

## 📞 Contact & Support

Pour toute question ou problème :
1. Consulter la documentation complète
2. Exécuter le script de validation
3. Vérifier les logs (`docker-compose logs -f api`)
4. Ouvrir un ticket avec les logs d'erreur

---

**Dernière mise à jour** : 4 Janvier 2026  
**Version** : 1.0
