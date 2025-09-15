# Guide de Déploiement - API Attendee

Ce guide vous explique comment déployer votre API NestJS avec nginx et SSL sur un VPS.

## 🚀 Configuration Automatique

### Prérequis
- VPS avec Docker et Docker Compose installés
- Domaine `api.attendee.fr` pointant vers l'IP de votre VPS
- Ports 80 et 443 ouverts sur votre VPS

### Déploiement en une commande

1. **Modifiez l'email dans le script de déploiement :**
   ```bash
   # Éditez scripts/deploy.sh et remplacez :
   EMAIL="votre-email@example.com"  # Par votre vraie adresse email
   ```

2. **Lancez le déploiement :**
   ```bash
   chmod +x scripts/deploy.sh
   ./scripts/deploy.sh
   ```

Le script va automatiquement :
- ✅ Vérifier les prérequis
- ✅ Créer les répertoires nécessaires
- ✅ Démarrer nginx temporairement
- ✅ Obtenir le certificat SSL Let's Encrypt
- ✅ Redéployer avec HTTPS activé
- ✅ Configurer le renouvellement automatique

## 🔧 Configuration Manuelle

Si vous préférez déployer manuellement :

### 1. Préparer l'environnement
```bash
# Créer les répertoires
mkdir -p certbot/www certbot/conf nginx/logs

# Copier le fichier .env
cp .env.example .env
# Éditez .env avec vos vraies valeurs
```

### 2. Premier déploiement (sans SSL)
```bash
# Démarrer sans SSL pour obtenir le certificat
docker-compose -f docker-compose.prod.yml up -d db api

# Démarrer nginx avec configuration basique
docker run -d --name temp-nginx -p 80:80 \
  -v $(pwd)/certbot/www:/var/www/certbot \
  nginx:alpine
```

### 3. Obtenir le certificat SSL
```bash
docker run --rm \
  -v $(pwd)/certbot/www:/var/www/certbot \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  certbot/certbot \
  certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email votre-email@example.com \
  --agree-tos --no-eff-email \
  -d api.attendee.fr
```

### 4. Déploiement final
```bash
# Arrêter nginx temporaire
docker stop temp-nginx && docker rm temp-nginx

# Démarrer avec la configuration complète
docker-compose -f docker-compose.prod.yml up -d
```

## 🔒 Fonctionnalités de Sécurité

### Rate Limiting
- **API générale :** 30 requêtes/minute par IP
- **Endpoints d'auth :** 5 requêtes/minute par IP
- **Connexions simultanées :** 20 par IP

### Headers de Sécurité
- `Strict-Transport-Security` (HSTS)
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy`
- `X-XSS-Protection`

### SSL/TLS
- TLS 1.2 et 1.3 uniquement
- Chiffrement moderne (ECDHE-RSA-AES256-GCM-SHA512)
- OCSP Stapling activé
- Session tickets désactivés

## 📊 Monitoring et Logs

### Consulter les logs
```bash
# Logs nginx
docker-compose logs nginx

# Logs API
docker-compose logs api

# Logs base de données
docker-compose logs db
```

### Vérifier le statut
```bash
# Statut des conteneurs
docker-compose ps

# Test de l'API
curl -k https://api.attendee.fr/health

# Vérifier le certificat SSL
openssl s_client -connect api.attendee.fr:443 -servername api.attendee.fr
```

## 🔄 Maintenance

### Renouvellement SSL automatique
Le script `renew-ssl.sh` est créé automatiquement. Ajoutez-le à votre crontab :

```bash
# Éditer crontab
crontab -e

# Ajouter cette ligne (renouvellement quotidien à 12h)
0 12 * * * cd /path/to/your/project && ./renew-ssl.sh
```

### Mise à jour de l'application
```bash
# Reconstruire et redéployer
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Sauvegarde de la base de données
```bash
# Créer une sauvegarde
docker-compose exec db pg_dump -U postgres ems > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurer une sauvegarde
docker-compose exec -T db psql -U postgres ems < backup_file.sql
```

## 🛠️ Dépannage

### Problèmes courants

**1. Certificat SSL non obtenu**
- Vérifiez que le domaine pointe vers votre serveur
- Vérifiez que les ports 80/443 sont ouverts
- Consultez les logs : `docker-compose logs certbot`

**2. API non accessible**
- Vérifiez les logs nginx : `docker-compose logs nginx`
- Testez la connectivité interne : `docker-compose exec nginx curl http://api:3000/health`

**3. Base de données non accessible**
- Vérifiez les logs : `docker-compose logs db`
- Vérifiez les variables d'environnement dans `.env`

### Commandes utiles
```bash
# Redémarrer nginx
docker-compose restart nginx

# Recharger la configuration nginx
docker-compose exec nginx nginx -s reload

# Vérifier la configuration nginx
docker-compose exec nginx nginx -t

# Accéder au conteneur API
docker-compose exec api bash
```

## 📋 Checklist de Déploiement

- [ ] Domaine configuré et pointant vers le VPS
- [ ] Docker et Docker Compose installés
- [ ] Ports 80 et 443 ouverts
- [ ] Fichier `.env` configuré
- [ ] Email modifié dans `scripts/deploy.sh`
- [ ] Script de déploiement exécuté
- [ ] Tests de connectivité effectués
- [ ] Crontab configuré pour le renouvellement SSL
- [ ] Monitoring mis en place

## 🔗 URLs de Test

Après déploiement, testez ces endpoints :

- **Health Check :** `https://api.attendee.fr/health`
- **API Documentation :** `https://api.attendee.fr/v1/docs` (si Swagger configuré)
- **Test SSL :** [SSL Labs](https://www.ssllabs.com/ssltest/analyze.html?d=api.attendee.fr)

---

**Support :** En cas de problème, consultez les logs et vérifiez la configuration étape par étape.
