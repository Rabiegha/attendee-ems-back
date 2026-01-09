# 🚨 DÉPLOIEMENT ONE-SHOT - MODE STRESS

## 🎯 Commandes à exécuter DANS L'ORDRE

### 1️⃣ Se connecter au VPS
```bash
ssh debian@51.75.252.74
```

### 2️⃣ Vérifier que le script existe
```bash
ls -la ~/deploy.sh
```

**Si le script n'existe pas** :
```bash
cd ~
wget https://raw.githubusercontent.com/Rabiegha/attendee-ems-back/main/deploy.sh
chmod +x deploy.sh
```

### 3️⃣ Télécharger la dernière version du script
```bash
cd ~
rm deploy.sh
wget https://raw.githubusercontent.com/Rabiegha/attendee-ems-back/main/deploy.sh
chmod +x deploy.sh
```

### 4️⃣ EXÉCUTER LE DÉPLOIEMENT
```bash
./deploy.sh
```

**C'EST TOUT !** Le script fait TOUT automatiquement.

---

## 🔍 Ce que le script fait

1. ✅ Pull git (backend + frontend)
2. ✅ Gestion des secrets (réutilise les existants)
3. ✅ Build du frontend
4. ✅ Détection mode UPDATE vs FIRST_INSTALL
5. ✅ Redémarrage des services Docker
6. ✅ Migrations Prisma
7. ✅ **SKIP le seed** (garde tes données)
8. ✅ Vérification SSL
9. ✅ Messages de fin avec status

---

## ⚠️ SI ERREUR

### Erreur : "seed-production.sql not found"
Le script devrait télécharger automatiquement, mais si problème :
```bash
cd /opt/ems-attendee/backend
git pull origin main
cd ~
./deploy.sh
```

### Erreur : "Failed to generate password hash"
Le container API n'est pas démarré. Attends 10 secondes et réessaie :
```bash
cd /opt/ems-attendee/backend
docker compose -f docker-compose.prod.yml restart api
sleep 10
cd ~
./deploy.sh
```

### Erreur : "Database connection failed"
```bash
cd /opt/ems-attendee/backend
docker compose -f docker-compose.prod.yml logs -f postgres
```
Ctrl+C pour sortir, puis :
```bash
docker compose -f docker-compose.prod.yml restart postgres
sleep 5
cd ~
./deploy.sh
```

### Erreur : "Permission denied"
```bash
chmod +x ~/deploy.sh
./deploy.sh
```

### Les services ne démarrent pas
```bash
cd /opt/ems-attendee/backend
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

---

## 🎓 APRÈS LE DÉPLOIEMENT

### Vérifier que tout fonctionne
```bash
# API Health
curl https://api.attendee.fr/health

# Frontend
curl https://attendee.fr

# Voir les logs
cd /opt/ems-attendee/backend
docker compose -f docker-compose.prod.yml logs -f api
```

### Tester le login
Ouvre https://attendee.fr dans ton navigateur :
- Email : `admin@choyou.fr`
- Mot de passe : `admin123`

---

## 🆘 DERNIER RECOURS

Si vraiment RIEN ne marche, repartir de zéro :

```bash
cd ~
./deploy.sh --force-seed
```

⚠️ **ATTENTION** : Ça EFFACE toutes tes données !

---

## 📝 Notes

- Le script détecte automatiquement si c'est une mise à jour ou une première installation
- Lors d'une mise à jour, **AUCUNE DONNÉE n'est perdue**
- Le script est maintenant **robuste** avec gestion d'erreurs complète
- Tous les chemins sont vérifiés avant utilisation
- Les erreurs sont loggées dans `/tmp/` si besoin

---

**Script commit** : `83cc588`
**Date** : 2026-01-09
**Testé** : ✅ Prêt pour production
