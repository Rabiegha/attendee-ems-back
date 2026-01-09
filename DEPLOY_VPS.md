# 🚀 Guide de Déploiement VPS Production

## 📋 Prérequis

- VPS OVH: `51.75.252.74`
- Domaines configurés chez OVH:
  - `attendee.fr` → 51.75.252.74
  - `api.attendee.fr` → 51.75.252.74
- Docker & Docker Compose installés
- Git installé
- Certificats SSL (Let's Encrypt via Certbot - **automatique**)

## 🎯 Utilisation Rapide

### Première installation

```bash
ssh debian@51.75.252.74
cd ~
wget https://raw.githubusercontent.com/Rabiegha/attendee-ems-back/main/deploy.sh
chmod +x deploy.sh
./deploy.sh --first-install
```

### Mise à jour (GARDE vos données)

```bash
ssh debian@51.75.252.74
cd ~
./deploy.sh
```

### Forcer le reseed (⚠️ EFFACE les données)

```bash
./deploy.sh --force-seed
```

## ✨ Ce que fait le script automatiquement

Le script `deploy.sh` gère **TOUT** pour vous :

- ✅ **Git pull** automatique (backend + frontend)
- ✅ **Gestion intelligente des données** :
  - Première installation → Seed avec Choyou + admin@choyou.fr
  - Mises à jour → **GARDE vos données** (pas de reseed)
  - Option --force-seed → Efface et recrée les données
- ✅ **Secrets sécurisés** :
  - Première installation → Génération de nouveaux secrets
  - Mises à jour → Réutilise les secrets existants (pas de perte de connexion DB)
- ✅ **Build automatique** du frontend
- ✅ **Migrations Prisma** automatiques
- ✅ **SSL/HTTPS** automatique (Let's Encrypt)
- ✅ **Zéro downtime** lors des mises à jour

## 🔐 Credentials Production

Après la première installation :

- **Email** : admin@choyou.fr
- **Mot de passe** : admin123
- **Organisation** : Choyou

⚠️ **IMPORTANT** : Changez le mot de passe après la première connexion !

## 🔧 Configuration DNS chez OVH

1. Connectez-vous à l'espace client OVH
2. Allez dans **Web Cloud** > **Noms de domaine** > `attendee.fr`
3. Cliquez sur l'onglet **Zone DNS**
4. Ajoutez/Modifiez les enregistrements suivants :

```
Type  | Sous-domaine | TTL  | Cible
------|--------------|------|---------------
A     | @            | 3600 | 51.75.252.74
A     | www          | 3600 | 51.75.252.74
A     | api          | 3600 | 51.75.252.74
```

5. Attendez la propagation DNS (5-30 minutes)
6. Vérifiez avec : `dig attendee.fr` et `dig api.attendee.fr`

## � Workflow de Mise à Jour

### Développement Local → Production

1. **Sur votre machine locale** :
   ```bash
   cd C:\Users\Corentin\Documents\EMS\attendee-ems-back
   git add .
   git commit -m "Description des changements"
   git push origin main
   ```

2. **Sur le VPS** :
   ```bash
   ssh debian@51.75.252.74
   cd ~
   ./deploy.sh
   ```

**C'est tout !** Le script fait tout le reste :
- Pull du code
- Build du frontend
- Redémarrage des services
- **Vos données sont préservées** ✅

## 🗂️ Système de Seed

### Production (VPS)
Le fichier `seed-production.sql` crée un environnement minimal :
- 1 organisation : **Choyou**
- 1 compte admin : **admin@choyou.fr** / admin123
- Aucune donnée de test

**Quand est-il exécuté ?**
- Automatiquement lors de la première installation
- Manuellement avec `./deploy.sh --force-seed` (⚠️ efface les données)

### Développement Local
Le fichier `seed-dev.sql` crée un environnement de test complet :
- 3 organisations : Choyou, ACME Events, TechConf
- 7 utilisateurs avec différents rôles
- 4 événements avec inscriptions
- Plusieurs participants et inscriptions

**Comment l'utiliser ?**
```bash
cd C:\Users\Corentin\Documents\EMS\attendee-ems-back
chmod +x seed-local.sh  # Une seule fois
./seed-local.sh
```

**Credentials de test :**
- admin@choyou.fr / admin123
- manager@choyou.fr / manager123
- staff@choyou.fr / staff123
- admin@acme.com / admin123
- admin@techconf.com / admin123

## 🔍 Vérification

### Vérifier les services

```bash
# Voir les containers en cours
docker ps

# Logs du backend API
docker logs ems-api -f

# Logs de Nginx
docker logs ems-nginx -f

# Logs de PostgreSQL
docker logs ems-postgres -f

# Santé de la base de données
docker exec -it ems-postgres pg_isready -U ems_prod
```

### Tester les endpoints

```bash
# API Health check
curl https://api.attendee.fr/health

# Frontend
curl https://attendee.fr

# Vérifier SSL
curl -I https://attendee.fr
curl -I https://api.attendee.fr
```

## �️ Commandes Utiles

### Consulter les logs

```bash
cd /opt/ems-attendee/backend

# Tous les services
docker compose -f docker-compose.prod.yml logs -f

# Service spécifique
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f postgres
```

### Redémarrer un service

```bash
cd /opt/ems-attendee/backend
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml restart nginx
```

### Accéder à la base de données

```bash
docker exec -it ems-postgres psql -U ems_prod -d ems_production

# Voir les utilisateurs
SELECT email, first_name, last_name, is_active FROM users;

# Voir les organisations
SELECT name, slug FROM organizations;

# Quitter
\q
```

### Vérifier l'état des services

```bash
cd /opt/ems-attendee/backend
docker compose -f docker-compose.prod.yml ps
```

## 🔒 Sécurité

- ✅ JWT Secrets générés aléatoirement (64 bytes)
- ✅ Mots de passe PostgreSQL sécurisés
- ✅ HTTPS/TLS 1.2+ uniquement
- ✅ CORS configuré pour `attendee.fr` seulement
- ✅ Cookies sécurisés (SameSite=Strict, Secure=true)
- ✅ Headers de sécurité (HSTS, X-Frame-Options, etc.)
- ✅ **Secrets réutilisés lors des mises à jour** (pas de regénération)

## 📊 Monitoring

### Vérifier l'utilisation des ressources

```bash
# CPU et mémoire par container
docker stats

# Espace disque
df -h

# Logs système
journalctl -u docker -f
```

## ❗ Dépannage

### Les containers ne démarrent pas

```bash
cd /opt/ems-attendee/backend

# Vérifier les logs
docker compose -f docker-compose.prod.yml logs

# Vérifier la configuration
docker compose -f docker-compose.prod.yml config

# Reconstruire les images
docker compose -f docker-compose.prod.yml up -d --build --force-recreate
```

### Erreur de connexion base de données

```bash
# Vérifier que PostgreSQL est accessible
docker exec -it ems-postgres pg_isready -U ems_prod

# Vérifier les credentials dans .env.production
cat /opt/ems-attendee/backend/.env.production | grep DATABASE_URL

# Si problème de mot de passe, forcer la réinitialisation
cd /opt/ems-attendee/backend
docker compose -f docker-compose.prod.yml down -v  # ⚠️ Efface les données
./deploy.sh --first-install
```

### Erreur SSL

Le script gère SSL automatiquement, mais si problème :

```bash
cd /opt/ems-attendee/backend

# Vérifier les certificats
docker compose -f docker-compose.prod.yml exec certbot ls -la /etc/letsencrypt/live/

# Renouveler manuellement si nécessaire
docker compose -f docker-compose.prod.yml exec certbot certbot renew --force-renewal

# Recharger Nginx
docker compose -f docker-compose.prod.yml restart nginx
```

### "J'ai perdu mes données !"

Si vous avez accidentellement effacé les données :

1. **Ne paniquez pas** - Les volumes Docker peuvent encore exister
2. Vérifier les volumes :
   ```bash
   docker volume ls | grep ems
   ```
3. Si le volume `ems_postgres_data` existe, vos données sont là
4. Redémarrer les services :
   ```bash
   cd /opt/ems-attendee/backend
   docker compose -f docker-compose.prod.yml up -d
   ```

### Besoin de reseed après une erreur

Si vous voulez repartir de zéro :

```bash
cd ~
./deploy.sh --force-seed
```

Cela va :
- Garder les services actifs
- Réinitialiser la base de données
- Recréer l'organisation Choyou et admin@choyou.fr

## 🌐 URLs de Production

- **Frontend**: https://attendee.fr
- **Backend API**: https://api.attendee.fr
- **Santé API**: https://api.attendee.fr/health

## 🎓 Bonnes Pratiques

### Workflow de Développement Recommandé

1. **Développer en local** avec `seed-dev.sql` (données de test)
2. **Tester** les changements localement
3. **Commit + Push** vers GitHub
4. **Déployer** sur le VPS avec `./deploy.sh`
5. **Vérifier** que tout fonctionne en production

### Sauvegarde des Données

Il est recommandé de faire des backups réguliers :

```bash
# Sur le VPS
docker exec ems-postgres pg_dump -U ems_prod ems_production > backup_$(date +%Y%m%d).sql

# Télécharger le backup sur votre machine
scp debian@51.75.252.74:~/backup_*.sql ./backups/
```

### Restaurer un Backup

```bash
# Sur le VPS
docker exec -i ems-postgres psql -U ems_prod -d ems_production < backup_20260109.sql
```

## 📞 Support

En cas de problème :
1. ✅ Vérifier les logs Docker : `docker compose logs -f`
2. ✅ Vérifier la propagation DNS : `dig attendee.fr`
3. ✅ Vérifier les certificats SSL : `curl -I https://attendee.fr`
4. ✅ Vérifier les variables d'environnement : `cat /opt/ems-attendee/backend/.env.production`
5. ✅ Consulter cette documentation

## 📝 Changelog du Script deploy.sh

### Version 2.0 (Janvier 2026)
- ✨ **Gestion intelligente des données** : ne reseed plus lors des mises à jour
- ✨ **Réutilisation des secrets** : pas de regénération lors des updates
- ✨ **Git auto-stash** : résout automatiquement les conflits locaux
- ✨ **Seed production automatique** : génération dynamique du hash bcrypt
- ✨ **Options** : `--first-install` et `--force-seed`
- ✨ **SSL automatique** : gestion complète de Let's Encrypt
- 🎯 **Zéro downtime** lors des mises à jour
- 📝 **Messages clairs** : feedback détaillé à chaque étape

### Version 1.0 (Décembre 2025)
- 🚀 Version initiale du script de déploiement

---

**Dernière mise à jour**: 2026-01-09
