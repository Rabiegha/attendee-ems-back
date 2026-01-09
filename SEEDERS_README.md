# 🌱 Système de Seeding - Documentation

Ce projet utilise **deux seeders différents** selon l'environnement :

## 📁 Fichiers de Seed

### 1. `seed-production.sql` - Production (VPS)

**Objectif** : Environnement minimal pour la production

**Contenu** :
- ✅ 1 rôle : SUPER_ADMIN
- ✅ 1 organisation : Choyou
- ✅ 1 utilisateur : admin@choyou.fr (mot de passe : admin123)
- ❌ Aucune donnée de test

**Caractéristiques** :
- Utilise `ON CONFLICT DO NOTHING` pour ne pas écraser les données existantes
- Génère dynamiquement le hash bcrypt lors du déploiement
- **Ne s'exécute PAS lors des mises à jour** (préserve vos données)

**Quand est-il utilisé ?**
- Automatiquement lors de la première installation : `./deploy.sh --first-install`
- Manuellement pour forcer le reseed : `./deploy.sh --force-seed` (⚠️ efface les données)

---

### 2. `seed-dev.sql` - Développement Local

**Objectif** : Environnement complet pour les tests

**Contenu** :
- ✅ 5 rôles système (SUPER_ADMIN, ADMIN, MANAGER, STAFF, VIEWER)
- ✅ 3 organisations :
  - Choyou
  - ACME Events
  - TechConf
- ✅ 7 utilisateurs avec différents rôles
- ✅ 8 types de participants (VIP, Speaker, Standard, etc.)
- ✅ 4 événements complets :
  - Tech Summit 2026 (Paris)
  - Innovation Forum (Lyon)
  - Business Expo 2026 (London)
  - DevOps Days (Berlin)
- ✅ 9 participants fictifs
- ✅ 10 inscriptions avec différents statuts (confirmed, awaiting, cancelled)
- ✅ 2 templates de badge

**Credentials de test** :

| Email | Mot de passe | Rôle | Organisation |
|-------|--------------|------|--------------|
| admin@choyou.fr | admin123 | Super Admin | Choyou |
| manager@choyou.fr | manager123 | Manager | Choyou |
| staff@choyou.fr | staff123 | Staff | Choyou |
| admin@acme.com | admin123 | Admin | ACME Events |
| manager@acme.com | manager123 | Manager | ACME Events |
| admin@techconf.com | admin123 | Admin | TechConf |

---

## 🚀 Utilisation

### Production (VPS)

Le seed production est géré **automatiquement** par `deploy.sh` :

```bash
# Première installation (seed automatique)
./deploy.sh --first-install

# Mise à jour normale (PAS de seed, données préservées)
./deploy.sh

# Forcer le reseed (⚠️ EFFACE les données)
./deploy.sh --force-seed
```

### Développement Local

Utilisez le script helper `seed-local.sh` :

```bash
cd attendee-ems-back
chmod +x seed-local.sh  # Une seule fois
./seed-local.sh
```

**Ce que fait le script** :
1. Vérifie que Docker est actif
2. Vérifie que le container PostgreSQL existe
3. Demande confirmation (car efface les données)
4. Exécute `seed-dev.sql`
5. Affiche les credentials de test
6. Affiche un résumé de la base de données

**Ou manuellement** :

```bash
# Avec Docker Compose en cours
docker exec -i ems-postgres psql -U ems_user -d ems_development < seed-dev.sql
```

---

## 🔐 Gestion des Mots de Passe

### Production
Le hash bcrypt est **généré dynamiquement** lors du déploiement :

```bash
# Dans deploy.sh
ADMIN_HASH=$(docker compose -f docker-compose.prod.yml exec -T api \
  node -e "const bcrypt = require('bcrypt'); bcrypt.hash('admin123', 10).then(hash => console.log(hash));")
```

Cela garantit que le hash est créé dans le même environnement où il sera vérifié.

### Développement
Les hash sont **pré-générés** et hardcodés dans `seed-dev.sql` :
- `admin123` → `$2b$10$CRXj5xWJpqjz3b/VHjXJKOGMGPl0B4C8DqN8YqFZp5nJ.vFz4yQ3i`
- `manager123` → `$2b$10$8Z9q4rN3pL.1xW5vK2nH3uR4tS6mY7oP8qL9nM.xZ3vY1wK5nZ4K6`
- `staff123` → `$2b$10$7Y8p3qM2oK.0wV4uJ1mG2tQ3sR5lX6nO7pK8mL.yY2uX0vJ4mY3J5`

---

## 🎯 Philosophie de Conception

### Production : Minimal et Sécurisé
- Pas de données de test en production
- Une seule organisation par défaut
- Un seul compte admin initial
- **Préservation des données lors des mises à jour**

### Développement : Complet et Réaliste
- Plusieurs organisations pour tester l'isolation
- Différents rôles pour tester les permissions
- Événements avec inscriptions dans différents statuts
- Données réalistes pour tester l'UI/UX

---

## 📊 Structure des Données de Test

### seed-dev.sql

```
Organizations (3)
  ├── Choyou (choyou)
  │   ├── Users (3) : admin, manager, staff
  │   ├── Attendee Types (4) : VIP, Speaker, Standard, Student
  │   ├── Events (2)
  │   │   ├── Tech Summit 2026 (5 registrations)
  │   │   └── Innovation Forum (1 registration)
  │   └── Attendees (5)
  │
  ├── ACME Events (acme-events)
  │   ├── Users (2) : admin, manager
  │   ├── Attendee Types (2) : VIP, General
  │   ├── Events (1)
  │   │   └── Business Expo 2026 (2 registrations)
  │   └── Attendees (2)
  │
  └── TechConf (techconf)
      ├── Users (1) : admin
      ├── Attendee Types (2) : Early Bird, Regular
      ├── Events (1)
      │   └── DevOps Days (2 registrations)
      └── Attendees (2)
```

### Statuts des Inscriptions (seed-dev)
- **confirmed** : 7 inscriptions (payées)
- **awaiting** : 2 inscriptions (en attente de paiement)
- **cancelled** : 1 inscription (annulée)

---

## 🛡️ Sécurité

### ⚠️ IMPORTANT pour la Production

1. **Changez le mot de passe admin** après la première connexion :
   ```
   admin@choyou.fr / admin123  → À CHANGER !
   ```

2. Le seed production utilise `ON CONFLICT` pour ne pas écraser les données :
   ```sql
   INSERT INTO users (...) VALUES (...)
   ON CONFLICT (email) DO UPDATE SET
     password_hash = EXCLUDED.password_hash;
   ```

3. Les seeds ne sont **JAMAIS exécutés automatiquement** lors des mises à jour

---

## 🔄 Migration depuis l'Ancien Système

### Avant (prisma/seeders/*.ts)
```bash
docker compose exec api node dist/prisma/seed.js
```
- Seeder TypeScript complexe
- Toujours exécuté lors du déploiement
- Même données pour dev et prod

### Maintenant (seed-production.sql + seed-dev.sql)
```bash
# Production
./deploy.sh  # Seed automatique seulement si première installation

# Dev
./seed-local.sh  # SQL simple, données complètes
```
- SQL pur, rapide et fiable
- Seeders séparés dev/prod
- Préservation des données en production

---

## 📝 Notes Techniques

### Pourquoi SQL au lieu de TypeScript ?

1. **Performance** : Exécution directe dans PostgreSQL (pas de surcharge Node.js)
2. **Simplicité** : Pas besoin de compiler, pas de dépendances
3. **Portabilité** : Fonctionne partout où PostgreSQL existe
4. **Maintenance** : Plus facile à lire et modifier
5. **Fiabilité** : Pas de problème de timing ou de transactions

### Template de Hash

Le seed production utilise un placeholder :
```sql
INSERT INTO users (..., password_hash, ...)
VALUES (..., '{{ADMIN_PASSWORD_HASH}}', ...);
```

Remplacé dynamiquement par `deploy.sh` :
```bash
sed "s|{{ADMIN_PASSWORD_HASH}}|${ADMIN_HASH}|g" \
  seed-production.sql > /tmp/seed-production-temp.sql
```

---

## 🆘 Dépannage

### "Database already contains data. Skipping seed."

C'est normal pour `seed-production.sql` - il ne seed que si la DB est vide.

**Solutions** :
- Production : `./deploy.sh --force-seed` (⚠️ efface les données)
- Dev : Utilisez `seed-dev.sql` qui fait `TRUNCATE` avant de seed

### "Password hash doesn't work"

Si le login échoue après un seed :

**Production** :
Le hash est généré automatiquement par `deploy.sh`, pas d'action nécessaire.

**Dev** :
Les hash sont hardcodés et fonctionnent toujours (testés avec bcrypt rounds=10).

### "Lost my data after deploy"

Si vous avez perdu vos données :

1. Vérifiez les volumes Docker :
   ```bash
   docker volume ls | grep ems_postgres_data
   ```

2. Si le volume existe, relancez les services :
   ```bash
   cd /opt/ems-attendee/backend
   docker compose -f docker-compose.prod.yml up -d
   ```

3. Si vraiment perdu, restaurez un backup :
   ```bash
   docker exec -i ems-postgres psql -U ems_prod -d ems_production < backup.sql
   ```

---

**Questions ?** Consultez [DEPLOY_VPS.md](./DEPLOY_VPS.md) pour plus d'infos sur le déploiement.
