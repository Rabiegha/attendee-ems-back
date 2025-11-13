# 🚀 Guide de Démarrage Rapide - Démo Cloudflare

## Prérequis
- Docker Desktop installé et lancé
- Node.js installé
- Cloudflared installé (déjà fait via `winget install Cloudflare.cloudflared`)

---

## 📋 Commandes à exécuter (dans l'ordre)

### 1️⃣ Démarrer Docker (Backend + PostgreSQL)
```powershell
cd C:\Users\Corentin\Documents\EMS\attendee-ems-back
docker-compose -f docker-compose.dev.yml up -d
```
✅ Attendre 5-10 secondes que le backend démarre complètement

---

### 2️⃣ Démarrer le Reverse Proxy (Port 8080)
**Ouvrir un NOUVEAU terminal PowerShell** et exécuter :
```powershell
cd C:\Users\Corentin\Documents\EMS\attendee-ems-back\cloudflare-demo
node reverse-proxy.js
```
✅ Laisser ce terminal ouvert (il affichera les logs)

---

### 3️⃣ Démarrer le Frontend (Port 5173)
**Ouvrir un NOUVEAU terminal PowerShell** et exécuter :
```powershell
cd C:\Users\Corentin\Documents\EMS\attendee-ems-front
npm run dev
```
✅ Laisser ce terminal ouvert

---

### 4️⃣ Démarrer Cloudflare Tunnel
**Ouvrir un NOUVEAU terminal PowerShell** et exécuter :
```powershell
# Rafraîchir le PATH (si besoin)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Lancer le tunnel
cloudflared tunnel --url http://localhost:8080
```

✅ **Copier l'URL qui s'affiche** (exemple : `https://xxxxx-xxxxx-xxxxx.trycloudflare.com`)

---

## 🎉 C'est prêt !

Partage l'URL Cloudflare à tes clients/collègues :
```
https://xxxxx-xxxxx-xxxxx.trycloudflare.com
```

---

## 🛑 Arrêter la démo

### Méthode 1 : Fermer les terminaux
- Ferme les 3 terminaux PowerShell (Reverse Proxy, Frontend, Cloudflare)
- Arrête Docker :
```powershell
cd C:\Users\Corentin\Documents\EMS\attendee-ems-back
docker-compose -f docker-compose.dev.yml down
```

### Méthode 2 : Script d'arrêt
```powershell
cd C:\Users\Corentin\Documents\EMS\attendee-ems-back\cloudflare-demo
.\stop-demo.ps1
```

---

## ⚡ Script d'automatisation (optionnel)

Si tu veux lancer tout en une commande :
```powershell
cd C:\Users\Corentin\Documents\EMS\attendee-ems-back\cloudflare-demo
.\start-demo.ps1
```
⚠️ Note : Tu devras quand même lancer le **frontend manuellement** dans un terminal séparé :
```powershell
cd C:\Users\Corentin\Documents\EMS\attendee-ems-front
npm run dev
```

---

## 🔧 Vérifications en cas de problème

### Vérifier que Docker tourne :
```powershell
docker ps
```
Tu dois voir `ems_api` et `ems_db`

### Vérifier que le port 8080 est ouvert :
```powershell
Test-NetConnection localhost -Port 8080
```
Doit retourner `TcpTestSucceeded : True`

### Vérifier que le port 5173 est ouvert :
```powershell
Test-NetConnection localhost -Port 5173
```
Doit retourner `TcpTestSucceeded : True`

### Logs du backend Docker :
```powershell
docker logs ems_api --tail 50
```

---

## 📊 Architecture

```
Internet → Cloudflare Tunnel
              ↓
         Reverse Proxy (port 8080)
              ↓
         ┌────┴────┐
         ↓         ↓
    Backend    Frontend
   (port 3000) (port 5173)
```

**Routing du Reverse Proxy :**
- `/api`, `/auth`, `/events`, `/users`, `/organizations`, `/attendees`, `/badges`, `/uploads`, `/public` → Backend
- Tout le reste → Frontend

---

## ✨ Avantages Cloudflare vs ngrok

| Fonctionnalité | Cloudflare Tunnel | ngrok (gratuit) |
|----------------|-------------------|-----------------|
| Limite requêtes| ♾️ Illimitée       | ❌ 360/min       |
| Vitesse        | ⚡ Très rapide    | ⚡ Rapide        |
| HTTPS          | ✅ Automatique    | ✅ Automatique   |
| URL fixe       | ⚠️ Changée à chaque lancement (mode Quick) | ⚠️ Changée à chaque lancement |
| Prix           | 🆓 Gratuit        | 🆓 Gratuit       |

---

## 🎯 Configuration Permanente (URL fixe)

Si tu veux une URL fixe qui ne change pas :

1. **Authentifier Cloudflare** (une seule fois) :
```powershell
cloudflared tunnel login
```

2. **Créer un tunnel nommé** :
```powershell
cloudflared tunnel create ems-demo
```

3. **Configurer le tunnel** :
Créer `C:\Users\Corentin\.cloudflared\config.yml` :
```yaml
tunnel: ems-demo
credentials-file: C:\Users\Corentin\.cloudflared\<UUID>.json

ingress:
  - hostname: ems-demo.votredomaine.com
    service: http://localhost:8080
  - service: http_status:404
```

4. **Router le DNS** :
```powershell
cloudflared tunnel route dns ems-demo ems-demo.votredomaine.com
```

5. **Lancer avec le tunnel nommé** :
```powershell
cloudflared tunnel run ems-demo
```

Plus d'infos : `CLOUDFLARE_TUNNEL_GUIDE.md`

---

## 📝 Notes importantes

- ✅ **CORS** : Le backend accepte automatiquement tous les domaines `.trycloudflare.com`
- ✅ **URLs relatives** : Le frontend utilise des URLs relatives (pas de `localhost:3000`)
- ✅ **Reverse Proxy** : Routes automatiquement `/public` vers le backend
- ⚠️ L'URL Cloudflare change à chaque lancement (mode Quick)
- ⚠️ Garde les 3 terminaux ouverts pendant toute la démo

---

## 🆘 Problèmes courants

### "Bad Gateway" :
- Vérifie que le frontend tourne sur port 5173
- Vérifie que le reverse proxy tourne sur port 8080
- Vérifie les logs du reverse proxy

### "CORS error" :
- Redémarre le backend Docker
- Vérifie que `main.ts` contient l'auto-accept pour `.trycloudflare.com`

### "cloudflared not found" :
- Rafraîchis le PATH ou redémarre le terminal
- Ou exécute :
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

### Frontend affiche "localhost:3000" :
- Vérifie que `.env` : `VITE_API_BASE_URL=` (vide)
- Vérifie que `rootApi.ts` : `baseUrl: import.meta.env.VITE_API_BASE_URL || ''`
- Redémarre le frontend

---

**Bon déploiement ! 🚀**
