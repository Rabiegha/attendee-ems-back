# Phase 1 Core - Checklist de Déploiement

## ✅ Pré-Déploiement

### Base de Données
- [ ] PostgreSQL 14+ installé et accessible
- [ ] Extension `citext` activée
- [ ] Variables d'environnement configurées :
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN`
  - `REFRESH_TOKEN_SECRET`
  - `REFRESH_TOKEN_EXPIRES_IN`

### Migrations
```bash
# Appliquer les migrations
npx prisma migrate deploy

# Vérifier le statut
npx prisma migrate status

# Générer le client Prisma
npx prisma generate
```

### Seed Initial
```bash
# Seed permissions et rôles système
npx prisma db seed

# Vérifier dans la DB
psql $DATABASE_URL -c "SELECT COUNT(*) FROM permissions;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM roles WHERE is_system_role = true;"
```

## 🔐 Sécurité

### Variables d'Environnement Requises
```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# JWT
JWT_SECRET=<strong-random-secret-min-32-chars>
JWT_EXPIRES_IN=15m

# Refresh Token
REFRESH_TOKEN_SECRET=<different-strong-random-secret>
REFRESH_TOKEN_EXPIRES_IN=7d

# Application
NODE_ENV=production
PORT=3000

# CORS (si nécessaire)
CORS_ORIGIN=https://your-frontend-domain.com
```

### Génération de Secrets
```bash
# Générer des secrets forts
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🚀 Déploiement

### Build Production
```bash
# Installer les dépendances
npm ci --only=production

# Build l'application
npm run build

# Vérifier le build
ls -la dist/
```

### Démarrage
```bash
# Mode production
npm run start:prod

# Avec PM2 (recommandé)
pm2 start dist/main.js --name ems-api
pm2 save
pm2 startup
```

## 🧪 Tests Post-Déploiement

### 1. Health Check
```bash
curl http://localhost:3000/api/health
# Devrait retourner 200 OK
```

### 2. Authentification
```bash
# Login avec user seed
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "jane.smith@acme.com", "password": "admin123"}'

# Devrait retourner access_token
```

### 3. Créer un Événement
```bash
export TOKEN="<access_token_from_login>"

curl -X POST http://localhost:3000/api/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "DEPLOY_TEST",
    "name": "Deployment Test Event",
    "start_at": "2024-12-01T09:00:00Z",
    "end_at": "2024-12-01T18:00:00Z",
    "status": "published"
  }'

# Devrait retourner 201 avec event + settings.public_token
```

### 4. Inscription Publique
```bash
export PUBLIC_TOKEN="<public_token_from_event>"

curl -X POST http://localhost:3000/api/public/events/$PUBLIC_TOKEN/register \
  -H "Content-Type: application/json" \
  -d '{
    "attendee": {
      "email": "test@deployment.com",
      "first_name": "Test",
      "last_name": "Deploy"
    },
    "attendance_type": "onsite"
  }'

# Devrait retourner 201 avec registration
```

### 5. Lister les Inscriptions
```bash
curl -X GET "http://localhost:3000/api/events/<event_id>/registrations" \
  -H "Authorization: Bearer $TOKEN"

# Devrait retourner liste avec meta pagination
```

## 📊 Monitoring

### Logs à Surveiller
```bash
# Avec PM2
pm2 logs ems-api

# Erreurs critiques à surveiller
grep -i "error" logs/application.log
grep -i "prisma" logs/application.log
grep -i "unauthorized" logs/application.log
```

### Métriques Importantes
- Temps de réponse API (< 200ms pour GET, < 500ms pour POST)
- Taux d'erreur (< 1%)
- Connexions DB actives
- Utilisation mémoire
- CPU usage

### Endpoints de Santé
```bash
# API health
GET /api/health

# Database health
GET /api/health/db

# Prisma client status
GET /api/health/prisma
```

## 🔄 Rollback

### En cas de problème

1. **Rollback code** :
```bash
pm2 stop ems-api
git checkout <previous-commit>
npm ci
npm run build
pm2 restart ems-api
```

2. **Rollback migrations** :
```bash
# Voir les migrations appliquées
npx prisma migrate status

# Rollback (si nécessaire)
# Note: Prisma ne supporte pas le rollback automatique
# Il faut créer une migration inverse manuelle
```

3. **Restaurer backup DB** :
```bash
# Restaurer depuis backup
pg_restore -d ems_production backup.dump
```

## 📝 Post-Déploiement

### Documentation
- [ ] Mettre à jour la documentation API (Swagger)
- [ ] Notifier l'équipe frontend des nouveaux endpoints
- [ ] Documenter les changements de schéma DB

### Monitoring Initial (24h)
- [ ] Vérifier les logs toutes les heures
- [ ] Surveiller les métriques de performance
- [ ] Tester les scénarios critiques
- [ ] Vérifier les emails de notification (si activés)

### Création Utilisateurs Production
```bash
# Se connecter à l'API
# Créer les utilisateurs réels via endpoints d'invitation
# NE PAS utiliser les users de seed en production
```

## 🚨 Troubleshooting

### Erreur: "Cannot connect to database"
```bash
# Vérifier la connexion
psql $DATABASE_URL -c "SELECT 1;"

# Vérifier les variables d'env
echo $DATABASE_URL

# Vérifier le firewall
telnet db-host 5432
```

### Erreur: "Prisma Client not found"
```bash
# Régénérer le client
npx prisma generate

# Rebuild l'app
npm run build
```

### Erreur: "JWT token invalid"
```bash
# Vérifier JWT_SECRET
echo $JWT_SECRET

# Vérifier l'expiration
# Les tokens expirent après JWT_EXPIRES_IN (default: 15m)
```

### Erreur: "Permission denied"
```bash
# Vérifier les permissions RBAC
psql $DATABASE_URL -c "SELECT * FROM permissions WHERE code LIKE 'events%';"

# Vérifier les role_permissions
psql $DATABASE_URL -c "SELECT r.code, p.code FROM roles r JOIN role_permissions rp ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id WHERE r.code = 'ADMIN';"
```

## 📦 Backup

### Backup Base de Données
```bash
# Backup complet
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup avec compression
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Automatiser avec cron
0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/ems_$(date +\%Y\%m\%d).sql.gz
```

### Backup Code
```bash
# Tag la version
git tag -a v1.0.0-phase1 -m "Phase 1 Core deployment"
git push origin v1.0.0-phase1
```

## ✅ Checklist Finale

### Avant le Déploiement
- [ ] Migrations testées en staging
- [ ] Variables d'environnement configurées
- [ ] Secrets générés et sécurisés
- [ ] Backup DB effectué
- [ ] Code tagué dans Git
- [ ] Documentation à jour

### Pendant le Déploiement
- [ ] Build réussi
- [ ] Migrations appliquées
- [ ] Seed exécuté (si première fois)
- [ ] Application démarrée
- [ ] Health checks passent

### Après le Déploiement
- [ ] Tests post-déploiement réussis
- [ ] Logs vérifiés (pas d'erreurs)
- [ ] Métriques normales
- [ ] Équipe notifiée
- [ ] Documentation mise à jour

## 📞 Contacts d'Urgence

- **DevOps** : [contact]
- **DBA** : [contact]
- **Lead Dev** : [contact]
- **On-call** : [contact]

---

**Déploiement Phase 1 Core** - Checklist complète ✅
