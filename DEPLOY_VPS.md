# 🚀 Guide de Déploiement VPS Production

## 📋 Prérequis

- VPS OVH: `51.75.252.74`
- Domaines configurés chez OVH:
  - `attendee.fr` → 51.75.252.74
  - `api.attendee.fr` → 51.75.252.74
- Docker & Docker Compose installés
- Git installé
- Certificats SSL (Let's Encrypt via Certbot)

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

## 📦 Déploiement Automatique

### 1. Se connecter au VPS

```bash
ssh debian@51.75.252.74
```

### 2. Télécharger le script de déploiement

```bash
# Depuis le VPS
cd ~
wget https://raw.githubusercontent.com/Rabiegha/attendee-ems-back/vps/deploy.sh
chmod +x deploy.sh
```

### 3. Lancer le déploiement

```bash
./deploy.sh
```

Le script va automatiquement :
- ✅ Cloner les repos (branche `vps`)
- ✅ Générer des secrets JWT sécurisés
- ✅ Créer le fichier `.env.production`
- ✅ Builder le frontend
- ✅ Démarrer les services Docker

### 4. Configurer SSL avec Certbot

Une fois le DNS propagé et les containers lancés :

```bash
# Installer Certbot si nécessaire
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# Obtenir les certificats SSL
sudo certbot --nginx -d attendee.fr -d www.attendee.fr -d api.attendee.fr

# Suivre les instructions (email, accepter TOS, etc.)
```

### 5. Recharger Nginx

```bash
cd /opt/ems-attendee/backend
docker compose -f docker-compose.prod.yml restart nginx
```

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

## 🔄 Mise à jour du code

Pour déployer des nouvelles versions :

```bash
cd /opt/ems-attendee/backend
git pull origin vps
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

## 🛠️ Commandes utiles

### Redémarrer les services

```bash
cd /opt/ems-attendee/backend
docker compose -f docker-compose.prod.yml restart
```

### Voir les logs

```bash
# Tous les services
docker compose -f docker-compose.prod.yml logs -f

# Service spécifique
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs -f postgres
```

### Accéder à la base de données

```bash
docker exec -it ems-postgres psql -U ems_prod -d ems_production
```

### Nettoyer Docker

```bash
# Supprimer les images inutilisées
docker system prune -a

# Supprimer tous les containers arrêtés
docker container prune
```

## 🔒 Sécurité

- ✅ JWT Secrets générés aléatoirement (64 bytes)
- ✅ Mots de passe PostgreSQL sécurisés
- ✅ HTTPS/TLS 1.2+ uniquement
- ✅ CORS configuré pour `attendee.fr` seulement
- ✅ Cookies sécurisés (SameSite=Strict, Secure=true)
- ✅ Headers de sécurité (HSTS, X-Frame-Options, etc.)

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
# Vérifier les logs
docker compose -f docker-compose.prod.yml logs

# Vérifier la configuration
docker compose -f docker-compose.prod.yml config

# Reconstruire les images
docker compose -f docker-compose.prod.yml up -d --build --force-recreate
```

### Erreur SSL

```bash
# Renouveler les certificats manuellement
sudo certbot renew --force-renewal

# Recharger Nginx
docker compose -f docker-compose.prod.yml restart nginx
```

### Problème de base de données

```bash
# Se connecter à PostgreSQL
docker exec -it ems-postgres psql -U ems_prod -d ems_production

# Vérifier les tables
\dt

# Lancer les migrations manuellement
docker exec -it ems-api npm run migration:run
```

## 🌐 URLs de Production

- **Frontend**: https://attendee.fr
- **Backend API**: https://api.attendee.fr
- **Santé API**: https://api.attendee.fr/health

## 📞 Support

En cas de problème :
1. Vérifier les logs Docker
2. Vérifier la propagation DNS
3. Vérifier les certificats SSL
4. Vérifier les variables d'environnement dans `.env.production`

---

**Dernière mise à jour**: 2025-12-05
