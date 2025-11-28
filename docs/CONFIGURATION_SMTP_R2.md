# 📧 Guide de Configuration SMTP et Cloudflare R2

Ce guide détaillé vous explique comment configurer les services externes utilisés par Attendee EMS.

---

## 📧 Configuration SMTP (Email)

Le système utilise SMTP pour envoyer des emails d'invitation et de notification. Voici comment configurer différents fournisseurs :

### Option 1 : Gmail (Développement)

```env
EMAIL_PROVIDER=smtp
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@gmail.com
SMTP_PASSWORD=votre-mot-de-passe-application
SMTP_FROM=votre-email@gmail.com
SMTP_FROM_NAME=Event Management System
```

**📝 Obtenir le mot de passe d'application Gmail** :
1. Activer la validation en 2 étapes sur votre compte Google
2. Aller sur https://myaccount.google.com/apppasswords
3. Créer un mot de passe d'application pour "Mail"
4. Copier le mot de passe généré (16 caractères) dans `SMTP_PASSWORD`

---

### Option 2 : OVH Mail

```env
SMTP_HOST=ssl0.ovh.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@votredomaine.com
SMTP_PASSWORD=votre-mot-de-passe
SMTP_FROM=noreply@votredomaine.com
SMTP_FROM_NAME=Your Company Events
```

**📝 Configuration OVH** :
1. Connectez-vous à votre [Manager OVH](https://www.ovh.com/manager/)
2. Allez dans **Web Cloud** → **E-mails**
3. Sélectionnez votre domaine
4. Cliquez sur **Comptes e-mail**
5. Utilisez l'adresse email et le mot de passe configurés

---

### Option 3 : SendGrid (Production recommandée)

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxx
SMTP_FROM=noreply@votredomaine.com
SMTP_FROM_NAME=Your Company Events
```

**📝 Obtenir la clé API SendGrid** :
1. Créer un compte sur https://sendgrid.com (100 emails/jour gratuits)
2. Aller dans **Settings** → **API Keys**
3. Cliquer **Create API Key**
4. Donner un nom (ex: "EMS Production")
5. Sélectionner **Full Access**
6. Copier la clé `SG.xxxxx` dans `SMTP_PASSWORD`
7. **Important** : Utiliser `apikey` comme `SMTP_USER` (c'est le username SendGrid)

**✅ Avantages SendGrid** :
- 100 emails/jour gratuits (suffisant pour petites organisations)
- Excellent délivrabilité
- Dashboard analytics (taux d'ouverture, clics, etc.)
- API REST disponible en complément

---

### Option 4 : Mailgun

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@mg.votredomaine.com
SMTP_PASSWORD=votre-api-key-mailgun
SMTP_FROM=noreply@votredomaine.com
SMTP_FROM_NAME=Your Company Events
```

**📝 Configuration Mailgun** :
1. Créer un compte sur https://www.mailgun.com (5000 emails/mois gratuits pendant 3 mois)
2. Ajouter et vérifier votre domaine
3. Aller dans **Sending** → **Domain settings**
4. Copier **SMTP Credentials** :
   - Username → `SMTP_USER`
   - Password → `SMTP_PASSWORD`

---

### Option 5 : AWS SES

```env
SMTP_HOST=email-smtp.eu-west-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-access-key-id
SMTP_PASSWORD=votre-secret-access-key
SMTP_FROM=verified-email@votredomaine.com
SMTP_FROM_NAME=Your Company Events
```

**📝 Configuration AWS SES** :
1. Aller sur AWS Console → **Amazon SES**
2. Vérifier votre domaine d'envoi (ou une adresse email pour test)
3. Aller dans **SMTP Settings**
4. Cliquer **Create SMTP Credentials**
5. Copier l'**Access Key ID** dans `SMTP_USER`
6. Copier la **Secret Access Key** dans `SMTP_PASSWORD`
7. **Important** : Choisir la région dans `SMTP_HOST` (ex: `eu-west-1`, `us-east-1`)

**⚠️ Mode Sandbox AWS SES** :
Par défaut, SES est en mode sandbox (limite de 200 emails/jour, uniquement vers emails vérifiés).
Pour production, demander la sortie du sandbox via support AWS.

---

### Option 6 : Brevo (ex-Sendinblue)

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre-email@example.com
SMTP_PASSWORD=votre-smtp-key
SMTP_FROM=noreply@votredomaine.com
SMTP_FROM_NAME=Your Company Events
```

**📝 Configuration Brevo** :
1. Créer un compte sur https://www.brevo.com (300 emails/jour gratuits)
2. Aller dans **SMTP & API** → **SMTP**
3. Copier vos credentials SMTP
4. **Login** → `SMTP_USER`
5. **Master Password** → `SMTP_PASSWORD`

---

### ✅ Tester votre configuration SMTP

#### Méthode 1 : Via l'API (recommandé)

```bash
# 1. Démarrer l'API
npm run start:dev

# 2. Se connecter pour obtenir un access token
ACCESS_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.com","password":"admin123"}' \
  | jq -r '.access_token')

# 3. Obtenir un ID de rôle disponible
ROLE_ID=$(curl -s http://localhost:3000/roles \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  | jq -r '.[0].id')

# 4. Envoyer une invitation de test
curl -X POST http://localhost:3000/invitations \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "roleId": "'$ROLE_ID'",
    "firstName": "Test",
    "lastName": "User"
  }'
```

#### Méthode 2 : Vérifier les logs

```bash
# Logs Docker
docker compose -f docker-compose.dev.yml logs -f api | grep -i smtp

# Logs locaux
npm run start:dev | grep -i smtp
```

**Messages attendus** :
- ✅ `SMTP connection established` → Configuration correcte
- ❌ `SMTP connection failed` → Vérifier host, port, credentials
- ❌ `Authentication failed` → Vérifier SMTP_USER et SMTP_PASSWORD
- ❌ `Connection timeout` → Vérifier firewall, port bloqué

---

### 📊 Comparatif des Fournisseurs SMTP

| Fournisseur | Gratuit | Limite Gratuite | Délivrabilité | Difficulté | Recommandé pour |
|-------------|---------|-----------------|---------------|------------|-----------------|
| **Gmail** | ✅ | 500/jour | ⭐⭐⭐ | Facile | Développement local |
| **SendGrid** | ✅ | 100/jour | ⭐⭐⭐⭐⭐ | Facile | Production (petite échelle) |
| **Brevo** | ✅ | 300/jour | ⭐⭐⭐⭐ | Facile | Petites organisations |
| **Mailgun** | ⚠️ (3 mois) | 5000/mois | ⭐⭐⭐⭐⭐ | Moyen | Production (moyenne échelle) |
| **AWS SES** | ⚠️ (sandbox) | 62000/mois* | ⭐⭐⭐⭐⭐ | Difficile | Grande échelle, infra AWS |
| **OVH Mail** | Payant | Selon abonnement | ⭐⭐⭐ | Facile | Clients OVH existants |

*Après sortie du sandbox : $0.10 pour 1000 emails

---

## ☁️ Configuration Cloudflare R2 (Stockage Badges)

Cloudflare R2 est utilisé pour stocker les badges PDF générés. C'est une alternative économique à AWS S3 (pas de frais d'egress).

### 1️⃣ Créer un compte Cloudflare R2

1. Créer un compte sur https://cloudflare.com (gratuit)
2. Dans le dashboard, cliquer sur **R2** dans le menu latéral
3. Cliquer **Purchase R2** (pas de carte bancaire requise pour le tier gratuit)
4. Activer R2

**💰 Tarification** :
- **Gratuit** : 10 GB de stockage + 1 million de requêtes Class A + 10 millions Class B par mois
- Largement suffisant pour la plupart des cas d'usage

---

### 2️⃣ Créer un bucket

1. Dans le dashboard R2, cliquer **Create bucket**
2. **Nom du bucket** : `ems-badges-production` (ou `ems-badges-dev` pour développement)
3. **Région** : Choisir **Automatic** (recommandé, optimisation automatique)
4. Cliquer **Create bucket**

**📝 Bonnes pratiques nommage** :
- Production : `ems-badges-prod`
- Staging : `ems-badges-staging`
- Développement : `ems-badges-dev`

---

### 3️⃣ Obtenir l'Account ID

1. Dans le dashboard Cloudflare, l'**Account ID** se trouve en haut à droite
2. Ou dans l'URL : `https://dash.cloudflare.com/{ACCOUNT_ID}/r2`
3. Copier cet ID (format : 32 caractères hexadécimaux)

```env
R2_ACCOUNT_ID=903ebe643d8b33f2884eb7ee633ed42b  # Exemple
```

---

### 4️⃣ Créer des API Tokens (clés d'accès)

1. Dans le dashboard R2, cliquer **Manage R2 API Tokens** (bouton en haut à droite)
2. Cliquer **Create API Token**
3. Configuration du token :
   - **Token name** : `EMS Production API Token`
   - **Permissions** : 
     - ✅ **Object Read & Write** (pour upload/download badges)
     - ❌ Ne pas activer **Edit** ou **Purge** (non nécessaire)
   - **TTL (Time to Live)** : Forever (ou durée personnalisée)
   - **Apply to specific buckets** (recommandé) : Sélectionner `ems-badges-production`
4. Cliquer **Create API Token**
5. **⚠️ IMPORTANT** : Copier immédiatement les credentials affichées :

```
Access Key ID: a1b2c3d4e5f6g7h8i9j0
Secret Access Key: k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0
```

**🔐 Sécurité** :
- Ces clés ne seront plus jamais affichées
- Conservez-les dans un gestionnaire de mots de passe sécurisé
- Ne les commitez JAMAIS dans Git

```env
R2_ACCESS_KEY_ID=a1b2c3d4e5f6g7h8i9j0
R2_SECRET_ACCESS_KEY=k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0
```

---

### 5️⃣ Configurer l'URL publique

Cloudflare R2 offre deux options pour accéder publiquement aux fichiers :

#### Option A : URL publique R2 directe (Développement)

1. Dans votre bucket, aller dans **Settings**
2. Scroller jusqu'à **Public Access**
3. Cliquer **Allow Access** (confirmer dans la popup)
4. Une URL publique sera générée : `https://pub-xxxxxxxxxxxxx.r2.dev`

```env
R2_PUBLIC_URL=https://pub-abc123def456.r2.dev
```

**⚠️ Limitations** :
- URL non personnalisable
- Pas de CDN Cloudflare (bande passante limitée)
- Recommandé uniquement pour développement/test

---

#### Option B : Domaine personnalisé avec CDN (Production recommandée)

1. Dans votre bucket → **Settings** → **Custom Domains**
2. Cliquer **Connect Domain**
3. Entrer votre sous-domaine : `badges.votredomaine.com`
4. Cloudflare vous donnera un record DNS à ajouter :
   ```
   Type: CNAME
   Name: badges
   Target: ems-badges-production.{account-id}.r2.cloudflarestorage.com
   Proxy: Enabled (orange cloud)
   ```
5. Ajouter ce record dans votre zone DNS Cloudflare
6. Attendre la propagation DNS (quelques minutes)
7. Cliquer **Verify** dans le dashboard R2

```env
R2_PUBLIC_URL=https://badges.votredomaine.com
```

**✅ Avantages domaine personnalisé** :
- CDN Cloudflare gratuit (cache global)
- Bande passante illimitée
- SSL/TLS automatique
- URL professionnelle
- Analytics disponibles

---

### 6️⃣ Configuration finale dans .env

```env
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=903ebe643d8b33f2884eb7ee633ed42b
R2_ACCESS_KEY_ID=a1b2c3d4e5f6g7h8i9j0
R2_SECRET_ACCESS_KEY=k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0
R2_BUCKET_NAME=ems-badges-production
R2_PUBLIC_URL=https://badges.votredomaine.com
```

**📝 Variables** :
- `R2_ACCOUNT_ID` : Votre Account ID Cloudflare (32 caractères hex)
- `R2_ACCESS_KEY_ID` : Access Key du token API (20 caractères)
- `R2_SECRET_ACCESS_KEY` : Secret Access Key du token API (40 caractères)
- `R2_BUCKET_NAME` : Nom exact du bucket créé (sensible à la casse)
- `R2_PUBLIC_URL` : URL publique ou domaine personnalisé (sans `/` à la fin)

---

### ✅ Tester votre configuration R2

#### Méthode 1 : Script de test dédié

Un script de test est fourni dans le projet :

```bash
# Option 1 : Via npm script
npm run test:r2

# Option 2 : Directement
node scripts/test-r2.sh
```

**Sortie attendue** :
```
✅ Connexion R2 établie
✅ Upload test réussi
✅ Fichier accessible publiquement : https://badges.votredomaine.com/test-badge.pdf
✅ Configuration R2 fonctionnelle !
```

---

#### Méthode 2 : Via l'API (génération de badge réel)

```bash
# 1. Démarrer l'API
npm run start:dev

# 2. Se connecter
ACCESS_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.com","password":"admin123"}' \
  | jq -r '.access_token')

# 3. Créer un événement
EVENT_ID=$(curl -s -X POST http://localhost:3000/events \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Event R2",
    "start_date": "2025-12-01T10:00:00Z",
    "capacity": 100
  }' | jq -r '.id')

# 4. Créer un participant
ATTENDEE_ID=$(curl -s -X POST http://localhost:3000/attendees \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "first_name": "John",
    "last_name": "Doe"
  }' | jq -r '.id')

# 5. Créer une inscription
REGISTRATION_ID=$(curl -s -X POST http://localhost:3000/registrations \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "'$EVENT_ID'",
    "attendee_id": "'$ATTENDEE_ID'"
  }' | jq -r '.id')

# 6. Générer le badge
curl -X POST http://localhost:3000/badges/generate \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "registrationId": "'$REGISTRATION_ID'"
  }'
```

**Réponse attendue** :
```json
{
  "id": "badge-uuid",
  "badge_url": "https://badges.votredomaine.com/badges/badge-uuid.pdf",
  "qr_code_data": "REG-XXX-XXX",
  "generated_at": "2025-11-28T12:00:00Z"
}
```

---

#### Méthode 3 : Vérifier les logs

```bash
# Logs Docker
docker compose -f docker-compose.dev.yml logs -f api | grep -i r2

# Logs locaux
npm run start:dev | grep -i r2
```

**Messages attendus** :
- ✅ `R2 client initialized successfully` → Configuration correcte
- ✅ `Badge uploaded to R2: badges/xxx.pdf` → Upload réussi
- ❌ `R2 connection failed` → Vérifier credentials
- ❌ `Bucket not found` → Vérifier `R2_BUCKET_NAME`
- ❌ `Access denied` → Vérifier permissions du token API

---

### 🔧 Dépannage R2

#### Erreur : "Bucket not found"
- ✅ Vérifier que `R2_BUCKET_NAME` correspond exactement au nom du bucket
- ✅ Le nom est sensible à la casse
- ✅ Pas d'espaces ou caractères spéciaux

#### Erreur : "Access denied"
- ✅ Vérifier que le token API a les permissions **Object Read & Write**
- ✅ Vérifier que le token est appliqué au bon bucket
- ✅ Régénérer un nouveau token si nécessaire

#### Erreur : "Invalid credentials"
- ✅ Copier/coller exactement `R2_ACCESS_KEY_ID` et `R2_SECRET_ACCESS_KEY`
- ✅ Pas d'espaces avant/après les clés
- ✅ Les clés ne contiennent que des caractères alphanumériques

#### Fichiers uploadés mais non accessibles publiquement
- ✅ Activer **Public Access** dans les settings du bucket
- ✅ Vérifier que `R2_PUBLIC_URL` est correct
- ✅ Tester l'URL manuellement dans le navigateur

#### Performance lente
- ✅ Utiliser un domaine personnalisé avec CDN Cloudflare
- ✅ Activer le proxy Cloudflare (orange cloud) dans DNS
- ✅ Configurer des règles de cache appropriées

---

## 🔐 Bonnes Pratiques de Sécurité

### Pour le Développement Local

- ✅ Utiliser `.env.example` comme template
- ✅ Ajouter `.env` à `.gitignore` (déjà fait)
- ✅ Utiliser Gmail avec mot de passe d'application pour SMTP
- ✅ Créer un bucket R2 de test séparé (`ems-badges-dev`)
- ✅ Ne jamais commiter de vraies clés, même "de test"

### Pour la Production

#### Gestionnaires de Secrets
- ✅ **AWS Secrets Manager** (si infra AWS)
- ✅ **HashiCorp Vault** (multi-cloud, enterprise)
- ✅ **Azure Key Vault** (si infra Azure)
- ✅ **Kubernetes Secrets** (si déploiement K8s)
- ✅ **Docker Secrets** (si Docker Swarm)
- ✅ Variables d'environnement chiffrées (CI/CD)

#### Meilleures Pratiques Email
- ✅ Utiliser des services professionnels (SendGrid, AWS SES, Mailgun)
- ✅ Configurer SPF, DKIM, DMARC pour votre domaine
- ✅ Monitorer les taux de bounce et spam
- ✅ Implémenter des templates email professionnels
- ✅ Logger tous les envois d'emails
- ✅ Rate limiting sur l'envoi d'emails

#### Meilleures Pratiques R2
- ✅ Limiter les permissions des tokens au strict minimum
- ✅ Créer un token par environnement (dev/staging/prod)
- ✅ Configurer un domaine personnalisé pour production
- ✅ Activer les logs d'audit Cloudflare
- ✅ Renouveler régulièrement les clés API (rotation tous les 90 jours)
- ✅ Implémenter une politique de rétention des fichiers
- ✅ Configurer des backups automatiques du bucket
- ✅ Monitorer l'utilisation du stockage et de la bande passante

#### Général
- ✅ Utiliser HTTPS partout (`AUTH_COOKIE_SECURE=true`)
- ✅ Ne JAMAIS logger les secrets dans l'application
- ✅ Scanner régulièrement le code pour secrets exposés (git-secrets, truffleHog)
- ✅ Implémenter une rotation automatique des secrets
- ✅ Auditer les accès aux services externes
- ✅ Configurer des alertes sur activités suspectes

---

## 📚 Ressources Complémentaires

### Documentation Officielle

- **SendGrid** : https://docs.sendgrid.com
- **AWS SES** : https://docs.aws.amazon.com/ses
- **Mailgun** : https://documentation.mailgun.com
- **Brevo** : https://developers.brevo.com
- **Cloudflare R2** : https://developers.cloudflare.com/r2

### Outils de Test

- **Mail Tester** : https://www.mail-tester.com (tester la délivrabilité)
- **MX Toolbox** : https://mxtoolbox.com (vérifier SPF/DKIM/DMARC)
- **AWS SES Simulator** : Tester sans envoyer de vrais emails
- **Cloudflare R2 Browser** : Interface web pour explorer le bucket

### Support

Pour toute question sur la configuration :
1. Consulter le [README principal](../README.md)
2. Vérifier les [issues GitHub](https://github.com/Rabiegha/attendee-ems-back/issues)
3. Créer une [nouvelle issue](https://github.com/Rabiegha/attendee-ems-back/issues/new) avec tag `configuration`

---

<div align="center">

**Configuration réussie ? Passez au [déploiement](../README.md#-docker--déploiement) !**

[⬆ Retour au README](../README.md)

</div>
