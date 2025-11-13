# ☁️ Configuration Cloudflare Tunnel pour EMS

## 🎯 Avantages vs ngrok

| Caractéristique | Cloudflare Tunnel | ngrok (gratuit) |
|----------------|-------------------|-----------------|
| **Requêtes/min** | ♾️ Illimité | 360/min ⚠️ |
| **URL fixe** | ✅ Oui | ❌ Change à chaque fois |
| **Vitesse** | ⚡ Très rapide | 🐌 Moyen |
| **Prix** | 💰 Gratuit | 💰 Gratuit |
| **Setup** | 5 min | 5 min |

---

## 📦 Installation (Déjà fait ✅)

```powershell
winget install Cloudflare.cloudflared
```

**⚠️ Important** : Après l'installation, **redémarrez votre terminal PowerShell** !

---

## 🔐 Étape 1 : Authentification

Ouvrez un **nouveau terminal PowerShell** et exécutez :

```powershell
cloudflared tunnel login
```

✨ **Une page web s'ouvre** → Connectez-vous avec votre compte Cloudflare (gratuit)  
✅ Acceptez l'autorisation

---

## 🚀 Étape 2 : Lancer le tunnel (Mode Quick)

### Option A : Tunnel temporaire (pour tester rapidement)

```powershell
cloudflared tunnel --url http://localhost:8080
```

✅ Vous obtenez une URL comme : `https://random-word-1234.trycloudflare.com`

⚠️ **Cette URL change à chaque redémarrage** (comme ngrok gratuit)

---

### Option B : Tunnel permanent (RECOMMANDÉ)

#### 1. Créer un tunnel nommé

```powershell
cloudflared tunnel create ems-demo
```

✨ Cloudflare crée un tunnel et vous donne un **UUID**

#### 2. Créer le fichier de configuration

Créez `C:\Users\Corentin\.cloudflared\config.yml` :

```yaml
tunnel: ems-demo
credentials-file: C:\Users\Corentin\.cloudflared\<UUID>.json

ingress:
  - hostname: ems-demo.votredomaine.com  # Ou subdomain Cloudflare gratuit
    service: http://localhost:8080
  - service: http_status:404
```

#### 3. Router le tunnel vers un domaine

```powershell
cloudflared tunnel route dns ems-demo ems-demo.votredomaine.com
```

#### 4. Lancer le tunnel

```powershell
cloudflared tunnel run ems-demo
```

✅ **URL fixe et permanente !** `https://ems-demo.votredomaine.com`

---

## 🔄 Architecture avec Cloudflare Tunnel

```
Client Internet
    ↓
https://ems-demo.trycloudflare.com (URL Cloudflare)
    ↓
Cloudflare Network (CDN global)
    ↓
cloudflared (votre machine)
    ↓
http://localhost:8080 (Reverse Proxy)
    ├─→ Backend (port 3000)
    └─→ Frontend (port 5173)
```

---

## 📋 Workflow de Démo Complet

### 1. Démarrer le reverse proxy

```powershell
cd C:\Users\Corentin\Documents\EMS\attendee-ems-back\ngrok-demo
node reverse-proxy.js
```

### 2. Démarrer Docker (Backend + PostgreSQL)

```powershell
cd C:\Users\Corentin\Documents\EMS\attendee-ems-back
docker-compose -f docker-compose.dev.yml up -d
```

### 3. Démarrer le Frontend

```powershell
cd C:\Users\Corentin\Documents\EMS\attendee-ems-front
npm run dev
```

### 4. Démarrer Cloudflare Tunnel

**Option Quick (URL temporaire)** :
```powershell
cloudflared tunnel --url http://localhost:8080
```

**Ou Option Permanente** :
```powershell
cloudflared tunnel run ems-demo
```

### 5. Partager l'URL

✅ Copiez l'URL affichée dans le terminal  
✅ Partagez-la au client  
✅ **Aucune limite de requêtes !**

---

## 🛑 Arrêter la démo

```powershell
# 1. Arrêter Cloudflare Tunnel
Ctrl+C dans le terminal cloudflared

# 2. Arrêter le reverse proxy
Ctrl+C dans le terminal Node.js

# 3. Arrêter Docker
cd C:\Users\Corentin\Documents\EMS\attendee-ems-back
docker-compose -f docker-compose.dev.yml down

# 4. Arrêter le frontend (optionnel)
Ctrl+C dans le terminal npm
```

---

## 🎨 Scripts d'automatisation (À créer)

### `start-demo-cloudflare.ps1`

```powershell
# Démarre tout automatiquement avec Cloudflare Tunnel
Write-Host "🚀 Démarrage EMS avec Cloudflare Tunnel..." -ForegroundColor Cyan

# 1. Docker
cd C:\Users\Corentin\Documents\EMS\attendee-ems-back
docker-compose -f docker-compose.dev.yml up -d

# 2. Reverse Proxy
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\Users\Corentin\Documents\EMS\attendee-ems-back\ngrok-demo; node reverse-proxy.js"

# 3. Cloudflare Tunnel
Start-Sleep -Seconds 5
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cloudflared tunnel --url http://localhost:8080"

Write-Host "✅ Démo prête !" -ForegroundColor Green
Write-Host "📝 L'URL Cloudflare s'affiche dans la fenêtre cloudflared" -ForegroundColor Yellow
```

---

## ⚙️ Configuration CORS

Le backend doit accepter les domaines Cloudflare. Ajoutez dans `main.ts` :

```typescript
// ✅ AUTO-ACCEPT: Cloudflare Tunnel domains
if (origin.includes('.trycloudflare.com') || 
    origin.includes('votredomaine.com')) {
  console.log(`[CORS] Auto-accepting Cloudflare domain: ${origin}`);
  return callback(null, true);
}
```

---

## 📊 Comparaison des modes

| Mode | URL | Stabilité | Setup |
|------|-----|-----------|-------|
| **Quick** (`--url`) | Temporaire | Change chaque fois | 1 commande |
| **Permanent** (`run`) | Fixe | Jamais | 4 commandes (une fois) |

---

## 🎯 Recommandation

- **Pour tester** : Mode Quick
- **Pour démos clients** : Mode Permanent avec domaine fixe

---

## 📚 Documentation officielle

https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/

---

**Créé le** : 13 novembre 2025  
**Remplacement de** : ngrok (limite 360 req/min)
