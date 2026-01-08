# 🚀 STEP 1 - Guide Rapide

## ⚡ Commandes Essentielles

### Setup Initial Complet
```bash
# Tout en une commande (première utilisation)
npm run step1:setup
```

### Seeds
```bash
# Créer les rôles platform et tenant
npm run docker:seed:step1

# Créer les utilisateurs de test
npm run docker:seed:step1-data
```

### Tests
```bash
# Exécuter les tests STEP 1
npm run test:step1
```

### Vérifications Rapides
```bash
# Voir les rôles tenant
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d ems -c \
  "SELECT code, name FROM roles WHERE org_id IS NOT NULL ORDER BY code;"

# Voir les rôles platform
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d ems -c \
  "SELECT code, name, is_root FROM roles WHERE org_id IS NULL;"

# Voir les users
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d ems -c \
  "SELECT email FROM users ORDER BY email;"
```

---

## 👥 Comptes de Test

| Email | Mot de passe | Type |
|-------|--------------|------|
| `multi@test.com` | `password123` | Multi-tenant (Manager @ Acme, Staff @ System) |
| `admin-org1@test.com` | `password123` | Admin @ Acme Corp |
| `admin-org2@test.com` | `password123` | Admin @ System |
| `support@test.com` | `password123` | Platform Support (assigned to Acme) |
| `root@test.com` | `password123` | Platform Root (all orgs) |

---

## 🔧 Dépannage

### Problème : Tests échouent avec "Can't reach database"
```bash
# Vérifier que Docker est démarré
docker compose -f docker-compose.dev.yml ps

# Redémarrer si nécessaire
docker compose -f docker-compose.dev.yml restart db
```

### Problème : Rôles manquants
```bash
# Supprimer les anciens rôles obsolètes
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d ems -c \
  "DELETE FROM roles WHERE code IN ('HOSTESS', 'PARTNER', 'SUPER_ADMIN');"

# Recréer les bons rôles
npm run docker:seed:step1
```

### Problème : Reset complet
```bash
# Reset la DB et tout recréer
docker compose -f docker-compose.dev.yml down -v
npm run step1:setup
```

---

## ✅ Validation Rapide

```bash
# Vérifier que tout est OK
echo "=== Rôles Platform ==="
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d ems -c \
  "SELECT COUNT(*) FROM roles WHERE org_id IS NULL;"

echo "=== Rôles Tenant ==="
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d ems -c \
  "SELECT COUNT(*) FROM roles WHERE org_id IS NOT NULL;"

echo "=== Users ==="
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d ems -c \
  "SELECT COUNT(*) FROM users;"

echo "=== Memberships ==="
docker compose -f docker-compose.dev.yml exec db psql -U postgres -d ems -c \
  "SELECT COUNT(*) FROM org_users;"

echo "=== Tests ==="
npm run test:step1 2>&1 | grep "Tests:"
```

**Résultats attendus :**
- Rôles Platform: 2
- Rôles Tenant: 8 (4 par org)
- Users: 5
- Memberships: 6
- Tests: 22 passed

---

## 📝 Prochaine Étape

Une fois la STEP 1 validée, passez à **STEP 2 : JWT Multi-org + Switch Context**

```bash
# Ouvrir la doc STEP 2
code attendee-ems-back/docs/refactor/STEP_2_JWT_MULTI_ORG.md
```
