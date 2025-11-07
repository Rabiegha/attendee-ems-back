# Configuration macOS - Système de badges

## 🍎 Guide pour développeurs macOS

### Prérequis

- Node.js 20+
- npm ou yarn
- Homebrew (recommandé)

### Option 1 : Installation native (sans Docker)

#### 1. Installer Chrome

Si Chrome n'est pas déjà installé :

```bash
brew install --cask google-chrome
```

#### 2. Vérifier l'installation

```bash
ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

Si la commande affiche le chemin, Chrome est installé correctement.

#### 3. Installer les dépendances du projet

```bash
cd attendee-ems-back
npm install
```

#### 4. Configurer la base de données

```bash
# Copier le fichier d'environnement
cp .env.example .env

# Modifier les variables si nécessaire
nano .env
```

#### 5. Lancer le serveur

```bash
npm run start:dev
```

✅ Le backend détectera automatiquement Chrome et pourra générer des badges !

### Option 2 : Avec Chromium (alternative)

Si vous préférez Chromium à Chrome :

```bash
# Installer Chromium
brew install chromium

# Le backend détectera automatiquement Chromium
npm run start:dev
```

### Option 3 : Docker (Recommandé - Environnement identique à la production)

#### Avantages
- ✅ Environnement identique à Windows et Linux
- ✅ Pas besoin d'installer Chrome/Chromium
- ✅ Isolation complète
- ✅ Même configuration que la production

#### Installation

```bash
# Installer Docker Desktop pour Mac
# https://www.docker.com/products/docker-desktop

# Vérifier l'installation
docker --version
docker-compose --version
```

#### Lancement

```bash
cd attendee-ems-back

# Première fois (build + start)
docker-compose -f docker-compose.dev.yml up --build

# Les fois suivantes
docker-compose -f docker-compose.dev.yml up
```

Le serveur sera accessible sur `http://localhost:3000`

#### Commandes utiles

```bash
# Voir les logs
docker-compose -f docker-compose.dev.yml logs -f api

# Arrêter
docker-compose -f docker-compose.dev.yml down

# Rebuild complet (si problème)
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up --build
```

## 🧪 Tester la génération de badges

1. Lancer le frontend (dans un autre terminal) :
```bash
cd ../attendee-ems-front
npm run dev
```

2. Se connecter à l'application

3. Aller sur un événement → Paramètres

4. Sélectionner un template de badge

5. Aller dans Inscriptions

6. Cliquer sur l'icône badge d'un participant

Si vous voyez l'aperçu du badge, **tout fonctionne** ! 🎉

## 🐛 Troubleshooting

### Erreur "Could not find a suitable browser executable"

**Solution 1** : Installer Chrome
```bash
brew install --cask google-chrome
```

**Solution 2** : Utiliser Docker
```bash
docker-compose -f docker-compose.dev.yml up --build
```

### Le badge ne s'affiche pas

1. Vérifier que le backend est lancé
2. Vérifier les logs dans la console
3. Vérifier qu'un template de badge est sélectionné dans l'événement

### Port 3000 déjà utilisé

```bash
# Trouver le processus
lsof -i :3000

# Tuer le processus
kill -9 <PID>

# Ou changer le port dans .env
PORT=3001
```

## 📚 Ressources

- [Documentation badges](./DEPLOYMENT_BADGES.md)
- [Installation Chromium](./CHROMIUM_SETUP.md)
- [Docker Desktop pour Mac](https://www.docker.com/products/docker-desktop)

## 🆘 Support

Si vous rencontrez un problème :

1. Vérifier les logs : `npm run start:dev` (mode natif) ou `docker-compose logs api` (mode Docker)
2. Vérifier que Chrome est installé : `ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
3. Essayer avec Docker : `docker-compose -f docker-compose.dev.yml up --build`
