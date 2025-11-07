# Configuration Linux - Système de badges

## 🐧 Guide pour développeurs Linux

### Option 1 : Installation native

#### Ubuntu/Debian

```bash
# 1. Installer Chromium et dépendances
sudo apt-get update
sudo apt-get install -y \
  chromium-browser \
  fonts-liberation \
  fonts-noto-color-emoji \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxkbcommon0 \
  libgbm1 \
  libasound2

# 2. Installer Node.js 20 (si pas déjà fait)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Cloner et installer le projet
cd attendee-ems-back
npm install

# 4. Configurer l'environnement
cp .env.example .env
nano .env

# 5. Lancer le serveur
npm run start:dev
```

#### Fedora/CentOS/RHEL

```bash
# 1. Installer Chromium
sudo dnf install -y chromium chromium-headless

# 2. Installer Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# 3. Suite identique à Ubuntu
cd attendee-ems-back
npm install
cp .env.example .env
npm run start:dev
```

#### Arch Linux

```bash
# Installer Chromium
sudo pacman -S chromium

# Installer Node.js
sudo pacman -S nodejs npm

# Suite du projet
cd attendee-ems-back
npm install
npm run start:dev
```

### Option 2 : Docker (Recommandé)

```bash
# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Installer Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Ajouter votre utilisateur au groupe docker
sudo usermod -aG docker $USER
newgrp docker

# Lancer le projet
cd attendee-ems-back
docker-compose -f docker-compose.dev.yml up --build
```

## 🔍 Vérification

### Vérifier que Chromium est installé

```bash
which chromium-browser
# ou
which chromium
```

### Tester Puppeteer

```bash
node -e "const puppeteer = require('puppeteer'); puppeteer.launch().then(b => { console.log('✅ OK'); b.close(); });"
```

## 🐛 Troubleshooting Linux

### Erreur : libgobject-2.0.so.0

```bash
sudo apt-get install -y libglib2.0-0
```

### Erreur : libatk-1.0.so.0

```bash
sudo apt-get install -y libatk1.0-0 libatk-bridge2.0-0
```

### Chromium ne se lance pas (sandboxing)

Si vous exécutez en tant que root ou dans un conteneur restrictif :

```bash
# Ajouter ces flags dans badge-generation.service.ts (déjà présent)
--no-sandbox
--disable-setuid-sandbox
```

### Problème de polices (caractères □)

```bash
# Installer les polices
sudo apt-get install -y \
  fonts-liberation \
  fonts-noto-color-emoji \
  fonts-noto-cjk \
  ttf-mscorefonts-installer
```

## 📝 Notes WSL (Windows Subsystem for Linux)

Si vous utilisez WSL2 :

1. Docker fonctionne nativement avec WSL2
2. Chromium nécessite X11 pour l'affichage (mais en mode headless ça fonctionne)
3. Recommandation : **Utiliser Docker** dans WSL2

```bash
# Dans WSL2
cd /mnt/c/Users/VotreNom/Documents/EMS/attendee-ems-back
docker-compose -f docker-compose.dev.yml up --build
```

## 🎯 Résumé

| Méthode | Avantages | Inconvénients |
|---------|-----------|---------------|
| **Docker** | ✅ Facile<br>✅ Identique prod<br>✅ Isolation | ❌ Plus lourd |
| **Natif** | ✅ Rapide<br>✅ Léger | ❌ Dépendances manuelles |

**Recommandation** : Docker pour uniformité avec l'équipe
