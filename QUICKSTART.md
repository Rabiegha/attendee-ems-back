# 🎯 GUIDE ULTRA-RAPIDE - Déploiement VPS

## 📌 Ce que tu dois retenir

### ✅ Mise à jour normale (99% du temps)

**Sur ta machine locale** :
```powershell
cd C:\Users\Corentin\Documents\EMS\attendee-ems-back
git add .
git commit -m "Description des changements"
git push
```

**Sur le VPS** :
```bash
ssh debian@51.75.252.74
./deploy.sh
```

**C'EST TOUT !** 🎉
- ✅ Pull automatique
- ✅ Build frontend automatique
- ✅ Redémarrage services automatique
- ✅ **TES DONNÉES SONT GARDÉES**

---

## 🔄 Workflows Spéciaux

### 🆕 Première installation sur nouveau VPS

```bash
ssh debian@51.75.252.74
cd ~
wget https://raw.githubusercontent.com/Rabiegha/attendee-ems-back/main/deploy.sh
chmod +x deploy.sh
./deploy.sh --first-install
```

**Résultat** :
- Organisation : Choyou
- Admin : admin@choyou.fr / admin123

---

### 🗑️ Repartir de zéro (efface tout)

```bash
ssh debian@51.75.252.74
./deploy.sh --force-seed
```

⚠️ **ATTENTION** : Efface TOUTES les données !

---

### 💻 Tester en local avec fake data

```bash
cd C:\Users\Corentin\Documents\EMS\attendee-ems-back
bash seed-local.sh
```

**Résultat** :
- 3 organisations
- 7 utilisateurs
- 4 événements
- Plein d'inscriptions

**Credentials de test** :
- admin@choyou.fr / admin123
- manager@choyou.fr / manager123
- staff@choyou.fr / staff123

---

## 🚨 Dépannage Rapide

### Problème de connexion DB

```bash
ssh debian@51.75.252.74
cd /opt/ems-attendee/backend
docker compose -f docker-compose.prod.yml logs -f api
```

### Voir les logs

```bash
docker compose -f docker-compose.prod.yml logs -f api     # Backend
docker compose -f docker-compose.prod.yml logs -f nginx   # Frontend
docker compose -f docker-compose.prod.yml logs -f postgres # Database
```

### Redémarrer un service

```bash
cd /opt/ems-attendee/backend
docker compose -f docker-compose.prod.yml restart api
```

### Vérifier la DB

```bash
docker exec -it ems-postgres psql -U ems_prod -d ems_production
```

Puis dans psql :
```sql
SELECT email, first_name, last_name FROM users;
\q
```

---

## 📱 Build APK Mobile

Une fois le VPS à jour :

```powershell
cd C:\Users\Corentin\Documents\EMS\attendee-ems-mobile
npx eas build --platform android --profile preview
```

L'APK pointera automatiquement vers `https://api.attendee.fr` ✅

---

## 🎓 Les Principes Clés

1. **Mises à jour = PAS de reseed** → Tes données sont gardées
2. **Première install = Seed auto** → Choyou + admin créés
3. **Secrets réutilisés** → Pas de problème de connexion DB
4. **Git auto-stash** → Plus de conflits manuels à résoudre

---

## 📞 Aide

- Documentation complète : `DEPLOY_VPS.md`
- Système de seed : `SEEDERS_README.md`
- En cas de doute : `./deploy.sh` (sans options)

**URL Production** :
- Frontend : https://attendee.fr
- API : https://api.attendee.fr
- Health : https://api.attendee.fr/health
