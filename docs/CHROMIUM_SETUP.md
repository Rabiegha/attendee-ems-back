# Installation de Chromium pour la génération de badges

Le système de génération de badges utilise Puppeteer qui nécessite Chrome ou Chromium pour générer les PDF et images.

## Installation selon l'OS

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y chromium-browser chromium-chromedriver
```

### CentOS/RHEL
```bash
sudo yum install -y chromium chromium-headless
```

### Alpine Linux (Docker)
```dockerfile
# Dans votre Dockerfile
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### macOS
```bash
brew install --cask chromium
```

### Windows
Télécharger Chrome depuis : https://www.google.com/chrome/

## Vérification de l'installation

Après l'installation, vérifiez que Chromium est accessible :

```bash
# Ubuntu/Debian
which chromium-browser

# CentOS/Alpine
which chromium

# macOS
which chromium
```

## Configuration Docker (Recommandé)

Si vous utilisez Docker, ajoutez ces lignes à votre `Dockerfile` :

```dockerfile
# Installer Chromium et ses dépendances
RUN apt-get update && apt-get install -y \
    chromium-browser \
    fonts-liberation \
    fonts-noto-color-emoji \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Variables d'environnement pour Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

## Permissions

Assurez-vous que l'utilisateur qui exécute l'application Node.js a les permissions nécessaires pour exécuter Chromium.

## Test

Une fois installé, redémarrez votre application NestJS et essayez de générer un badge depuis l'interface.

## Troubleshooting

### Erreur "Could not find a suitable browser executable"
- Vérifiez que Chromium est installé : `which chromium` ou `which chromium-browser`
- Vérifiez les permissions d'exécution
- Redémarrez l'application

### Erreur "Failed to launch the browser process"
- Installez les dépendances manquantes (voir liste ci-dessus)
- Vérifiez que vous n'êtes pas en mode root dans Docker (utilisez `--no-sandbox`)

### Le badge ne s'affiche pas correctement
- Vérifiez que les polices sont installées sur le serveur
- Vérifiez que le template de badge est bien configuré dans l'événement
