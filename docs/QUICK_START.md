# 🚀 Quick Start - Phase 1 Core

## ⚡ Démarrage en 3 Minutes (Local)

### 1. Démarrer l'environnement
```bash
cd attendee-ems-back
npm run docker:up
npm run docker:migrate
npm run docker:seed
```

## 🌐 Déploiement Production (VPS)

### Déploiement Frontend Rapide
```bash
ssh root@51.75.252.74
/opt/ems-attendee/deploy-front.sh
```

Ce script effectue automatiquement :
- Pull des dernières modifications Git
- Installation des dépendances (npm install)
- Build du projet (npm run build)
- Redémarrage de Nginx

**Frontend accessible sur :** https://attendee.fr  
**API accessible sur :** https://api.attendee.fr

### 2. Tester l'API
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane.smith@acme.com","password":"admin123"}' \
  | jq -r '.access_token'

# Sauvegarder le token
export TOKEN="<votre_token>"

# Créer un événement
curl -X POST http://localhost:3000/api/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code":"QUICK2024",
    "name":"Quick Start Event",
    "start_at":"2024-12-01T09:00:00Z",
    "end_at":"2024-12-01T18:00:00Z",
    "status":"published"
  }' | jq

# Sauvegarder le public_token
export PUBLIC_TOKEN="<public_token_from_response>"

# Inscription publique (sans auth)
curl -X POST http://localhost:3000/api/public/events/$PUBLIC_TOKEN/register \
  -H "Content-Type: application/json" \
  -d '{
    "attendee":{"email":"test@quick.com","first_name":"Test","last_name":"User"},
    "attendance_type":"onsite"
  }' | jq
```

### 3. Accéder à Swagger
```
http://localhost:3000/api-docs
```

---

## 📁 Fichiers Importants

| Fichier | Quand l'utiliser |
|---------|------------------|
| `README_PHASE1.md` | Démarrage et vue d'ensemble |
| `PHASE1_API.md` | Référence complète API |
| `TESTING_GUIDE.md` | Tests manuels détaillés |
| `DEPLOYMENT_CHECKLIST.md` | Déploiement production |
| `LIVRAISON_PHASE1.md` | Résumé exécutif |

---

## 🔑 Utilisateurs de Test

```
ADMIN    : jane.smith@acme.com / admin123
MANAGER  : bob.johnson@acme.com / manager123
VIEWER   : alice.wilson@acme.com / viewer123
```

---

## 🎯 Endpoints Principaux

### Events (Auth)
```bash
POST   /api/events                    # Créer
GET    /api/events                    # Lister
GET    /api/events/:id                # Détail
PUT    /api/events/:id                # Modifier
DELETE /api/events/:id                # Supprimer
PUT    /api/events/:id/status         # Changer statut
```

### Public (No Auth)
```bash
GET    /api/public/events/:token              # Info event
POST   /api/public/events/:token/register     # S'inscrire
```

### Registrations (Auth)
```bash
GET    /api/events/:id/registrations          # Lister
PUT    /api/registrations/:id/status          # Changer statut
POST   /api/events/:id/registrations          # Créer
```

---

## 🛠️ Commandes Utiles

```bash
# Docker
npm run docker:up              # Démarrer
npm run docker:down            # Arrêter
npm run docker:logs            # Logs

# Prisma
npm run docker:migrate         # Migrations
npm run docker:seed            # Seed
npm run docker:generate        # Générer client
npm run docker:studio          # Prisma Studio

# Dev
npm run start:dev              # Dev mode
```

---

## ✅ Checklist Rapide

- [ ] Docker démarré (`npm run docker:up`)
- [ ] Migrations appliquées (`npm run docker:migrate`)
- [ ] Seed exécuté (`npm run docker:seed`)
- [ ] Login fonctionne (obtenir token)
- [ ] Création event fonctionne (obtenir public_token)
- [ ] Inscription publique fonctionne
- [ ] Swagger accessible (http://localhost:3000/api-docs)

---

## 🚨 Troubleshooting

### Erreur: "Cannot connect to database"
```bash
docker ps  # Vérifier que les containers tournent
npm run docker:up  # Redémarrer si nécessaire
```

### Erreur: "Prisma Client not found"
```bash
npm run docker:generate
```

### Erreur: "Permission denied"
```bash
# Vérifier que vous utilisez le bon token
echo $TOKEN
```

---

## 📚 Documentation Complète

Pour plus de détails, consultez :
- **API** : `PHASE1_API.md`
- **Tests** : `TESTING_GUIDE.md`
- **Déploiement** : `DEPLOYMENT_CHECKLIST.md`

---

**Phase 1 Core** - Prêt à l'emploi en 3 minutes ⚡
