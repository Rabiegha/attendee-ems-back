# 🔧 Configuration Cloudflare R2

## Étape 1 : Remplir le fichier `.env`

Ouvre le fichier `.env` et remplace les valeurs par celles de ton compte Cloudflare :

```bash
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=ton_account_id                    # Exemple: a1b2c3d4e5f6
R2_ACCESS_KEY_ID=ta_access_key                  # Exemple: 1234567890abcdef
R2_SECRET_ACCESS_KEY=ta_secret_key              # Exemple: abcdefghijklmnopqrstuvwxyz123456
R2_BUCKET_NAME=ems-badges                       # Le nom de ton bucket R2
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev          # URL publique de ton bucket
```

### Comment trouver ces valeurs ?

#### 1. R2_ACCOUNT_ID
- Va sur https://dash.cloudflare.com
- Dans l'URL, tu verras : `https://dash.cloudflare.com/XXXXXXX/...`
- `XXXXXXX` = ton Account ID

#### 2. R2_ACCESS_KEY_ID et R2_SECRET_ACCESS_KEY
- Va dans **R2** → **Manage R2 API Tokens**
- Utilise le token que tu as créé
- Si tu l'as perdu, crée-en un nouveau

#### 3. R2_PUBLIC_URL (URL publique)
- Va dans **R2** → clique sur ton bucket `ems-badges`
- Onglet **Settings**
- Section **Public Access**
- Clique sur **"Allow Access"** ou **"Connect Domain"**
- Tu obtiendras une URL comme : `https://pub-123abc.r2.dev`

**IMPORTANT** : Sans cette URL publique, les PDFs ne seront pas accessibles depuis le mobile !

---

## Étape 2 : Tester la connexion

Une fois le `.env` rempli, redémarre l'API :

```bash
docker compose -f docker-compose.dev.yml restart api
```

Puis teste l'upload avec cURL :

```bash
# Créer un fichier de test
echo "Test PDF" > test.txt

# Tester l'upload
curl -X POST http://localhost:3000/storage/test-upload \
  -F "file=@test.txt" \
  -H "Authorization: Bearer TON_TOKEN"
```

Tu devrais recevoir :
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "url": "https://pub-xxxxx.r2.dev/test/1699999999-test.txt",
  "filename": "test.txt",
  "size": 9,
  "mimetype": "text/plain"
}
```

---

## Étape 3 : Tester la génération de badge

```bash
curl http://localhost:3000/storage/test-badge/12345 \
  -H "Authorization: Bearer TON_TOKEN"
```

Réponse attendue :
```json
{
  "success": true,
  "message": "Test badge PDF generated and uploaded",
  "registrationId": "12345",
  "url": "https://pub-xxxxx.r2.dev/badges/12345/badge.pdf"
}
```

Ouvre l'URL dans ton navigateur pour vérifier que le PDF est bien accessible ! 🎉

---

## 🔒 Sécurité

⚠️ **NE JAMAIS commit le fichier `.env` dans Git !**

Le `.gitignore` devrait déjà contenir `.env`, mais vérifie :

```bash
# Vérifier que .env est ignoré
cat .gitignore | grep ".env"
```

---

## 📚 Endpoints disponibles

Une fois configuré, tu as accès à :

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/storage/test-upload` | POST | Upload un fichier de test |
| `/storage/test-badge/:id` | GET | Génère un PDF de test |
| `/storage/signed-url/:key` | GET | Obtenir une URL signée pour upload direct |

---

## ✅ Checklist

- [ ] J'ai copié mes credentials Cloudflare dans `.env`
- [ ] J'ai activé **Public Access** sur mon bucket R2
- [ ] J'ai redémarré l'API avec `docker compose restart api`
- [ ] J'ai testé l'upload avec cURL et ça fonctionne
- [ ] J'ai vérifié que l'URL publique est accessible dans mon navigateur

---

## 🆘 Problèmes courants

### Erreur : "Failed to upload file"
- Vérifie que tes credentials sont corrects
- Vérifie que le bucket existe bien
- Vérifie que l'Account ID est correct

### Erreur : "Cannot access URL"
- Active le **Public Access** sur ton bucket R2
- Vérifie que `R2_PUBLIC_URL` est bien configuré

### L'URL retournée ne fonctionne pas
- Va dans R2 → Settings → Public Access
- Clique sur "Allow Access"
- Copie l'URL publique dans `R2_PUBLIC_URL`

---

## 🚀 Prochaine étape

Une fois que tout fonctionne, on passera à la **Phase 2 : Template Editor** ! 🎨
