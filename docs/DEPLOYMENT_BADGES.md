# Guide de déploiement - Système de badges

## 📋 Prérequis pour la génération de badges

Le système de génération de badges utilise **Puppeteer** qui nécessite Chromium pour générer les PDF et images.

## 🐳 Déploiement avec Docker (RECOMMANDÉ)

### Configuration déjà en place

Les `Dockerfile` et `Dockerfile.dev` sont déjà configurés avec Chromium. Aucune configuration supplémentaire n'est nécessaire !

```bash
# Build et lancement
docker-compose up --build

# ou en production
docker-compose -f docker-compose.prod.yml up --build
```

### Variables d'environnement (déjà configurées dans Docker)

```env
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

## 🚀 Déploiement sans Docker

### Ubuntu/Debian

```bash
# Installer Chromium
sudo apt-get update
sudo apt-get install -y chromium-browser fonts-liberation

# Vérifier l'installation
which chromium-browser

# Démarrer l'application
npm run build
npm run start:prod
```

### CentOS/RHEL

```bash
sudo yum install -y chromium chromium-headless
npm run start:prod
```

### Alpine Linux

```bash
apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
npm run start:prod
```

## ☁️ Déploiement sur services cloud

### Heroku

Ajouter le buildpack Chromium :

```bash
heroku buildpacks:add heroku/nodejs
heroku buildpacks:add jontewks/puppeteer

# Ou dans app.json
{
  "buildpacks": [
    {
      "url": "heroku/nodejs"
    },
    {
      "url": "jontewks/puppeteer"
    }
  ]
}
```

### AWS Elastic Beanstalk

Créer `.ebextensions/chromium.config` :

```yaml
packages:
  yum:
    chromium: []
    
option_settings:
  aws:elasticbeanstalk:container:nodejs:
    NodeCommand: "npm run start:prod"
```

### Vercel / Netlify

⚠️ **Non recommandé** : Vercel et Netlify ont des limitations sur les binaires système.

**Alternative** : Utiliser un service externe comme :
- [Browserless](https://www.browserless.io/)
- [Gotenberg](https://gotenberg.dev/)

## 🔍 Vérification du déploiement

### 1. Vérifier que Chromium est installé

```bash
# Dans le conteneur Docker ou sur le serveur
which chromium-browser
# ou
which chromium
```

### 2. Tester la génération de badge

Depuis l'interface :
1. Aller sur un événement
2. Onglet "Paramètres"
3. Sélectionner un template de badge
4. Sauvegarder
5. Aller dans "Inscriptions"
6. Cliquer sur l'icône badge d'un participant

Les logs devraient afficher :
```
[BadgeGenerationService] Initializing Puppeteer browser...
[BadgeGenerationService] ✅ Browser launched successfully
```

### 3. Vérifier les logs

```bash
# Docker
docker-compose logs -f backend

# Logs backend
tail -f /var/log/app.log
```

## ⚙️ Configuration avancée

### Optimisation des performances

Pour éviter de relancer Chromium à chaque badge :

```typescript
// Le service badge-generation utilise déjà un singleton
// Le browser reste ouvert entre les requêtes
```

### Gestion de la mémoire

Chromium peut consommer beaucoup de mémoire. Recommandations :

- **Minimum** : 512 MB RAM
- **Recommandé** : 1 GB RAM
- **Production** : 2 GB RAM

Dans Docker Compose :

```yaml
services:
  backend:
    mem_limit: 2g
    mem_reservation: 1g
```

### Limiter les processus Chromium

Si vous générez beaucoup de badges simultanément, limiter les instances :

```typescript
// Dans badge-generation.service.ts
// Le singleton garantit qu'une seule instance de Chromium tourne
```

## 🐛 Troubleshooting

### Erreur : "Could not find a suitable browser executable"

**Solution** :
1. Vérifier que Chromium est installé
2. Vérifier les variables d'environnement
3. Rebuild le conteneur Docker

### Erreur : "Failed to launch the browser process"

**Causes possibles** :
- Manque de dépendances système
- Permissions insuffisantes
- Manque de mémoire

**Solutions** :
```bash
# Installer les dépendances manquantes (Ubuntu)
sudo apt-get install -y \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxkbcommon0 \
  libgbm1 \
  libasound2

# Augmenter la mémoire Docker
# Dans docker-compose.yml
mem_limit: 2g
```

### Les badges sont vides ou mal formatés

**Vérifications** :
1. Le template de badge est bien sélectionné dans l'événement
2. Les polices sont installées sur le serveur
3. Les variables du template sont correctes

## 📊 Monitoring

### Métriques à surveiller

- **Mémoire** : Chromium peut prendre 200-500 MB par instance
- **CPU** : Pics lors de la génération de badges
- **Temps de génération** : Devrait être < 5 secondes par badge

### Logs importants

```bash
# Succès
[BadgeGenerationService] ✅ Badge generated successfully

# Erreurs
[BadgeGenerationService] ❌ Failed to generate badge
```

## 🔒 Sécurité

### Sandboxing

Chromium s'exécute avec `--no-sandbox` dans Docker. C'est nécessaire mais :

- ✅ Sûr dans un conteneur Docker isolé
- ⚠️ Éviter sur serveur partagé sans isolation

### Limitations

Pour éviter les abus, implémenter un rate limiting :

```typescript
// TODO: Ajouter rate limiting sur l'endpoint de génération
// Maximum 100 badges par heure par utilisateur
```

## 📝 Checklist de déploiement

- [ ] Chromium installé (ou Docker configuré)
- [ ] Variables d'environnement configurées
- [ ] Minimum 1 GB RAM alloué
- [ ] Tests de génération effectués
- [ ] Monitoring configuré
- [ ] Logs vérifiés
- [ ] Backup des templates de badges configuré

## 🆘 Support

Si vous rencontrez des problèmes :

1. Vérifier les logs : `docker-compose logs backend`
2. Tester manuellement : `node test-puppeteer.js`
3. Vérifier la documentation : `CHROMIUM_SETUP.md`
