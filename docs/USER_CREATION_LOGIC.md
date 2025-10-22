# Logique de Création d'Utilisateurs et Invitations

## 🎯 Principe Fondamental

**Dans ce système, créer un utilisateur = envoyer une invitation.**

Il n'y a pas de création directe d'utilisateur. Tous les nouveaux utilisateurs passent par le système d'invitation :

1. Un utilisateur avec `users.create` peut **inviter** de nouveaux utilisateurs
2. L'invitation envoie un email avec un lien
3. Le destinataire clique sur le lien et crée son compte
4. Une fois le compte créé, l'utilisateur peut se connecter

## 🔗 Permissions Liées

### Règle de Cohérence

**Si un rôle a `users.create`, il DOIT avoir `invitations.create`**

Cette règle est implémentée dans le mapping des permissions :

```typescript
// permissions.seeder.ts

'ADMIN': [
  // ...
  'users.create',        // Créer un user = envoyer une invitation
  'invitations.create',  // ⚠️ Obligatoire pour users.create (logique métier)
  'invitations.read',
  'invitations.cancel',
  // ...
],

'MANAGER': [
  // ...
  'users.create',        // Créer un user = envoyer une invitation
  'invitations.create',  // ⚠️ Obligatoire pour users.create (logique métier)
  'invitations.read',
  // ...
],
```

### Permissions Invitation

| Permission | Description | Qui l'a ? |
|------------|-------------|-----------|
| `invitations.create` | Envoyer des invitations | SUPER_ADMIN, ADMIN, MANAGER |
| `invitations.read` | Voir les invitations | SUPER_ADMIN, ADMIN, MANAGER, VIEWER |
| `invitations.cancel` | Annuler une invitation | SUPER_ADMIN, ADMIN |

## 📋 Matrice Permissions par Rôle

### Création d'Utilisateurs

| Rôle | users.create | invitations.create | Peut inviter |
|------|--------------|-------------------|--------------|
| SUPER_ADMIN | ✅ | ✅ | Tous les rôles |
| ADMIN | ✅ | ✅ | Admin → Hostess |
| MANAGER | ✅ | ✅ | Manager → Hostess |
| PARTNER | ❌ | ❌ | Personne |
| VIEWER | ❌ | ❌ | Personne |
| HOSTESS | ❌ | ❌ | Personne |

**Note** : La hiérarchie s'applique ! Voir [ROLE_HIERARCHY_FIX.md](./ROLE_HIERARCHY_FIX.md)

## 🎨 Interface Utilisateur

### Page Invitations

**Route** : `/invitations`  
**Guard** : `<GuardedRoute action="create" subject="Invitation">`

**Fonctionnalités** :
- Formulaire pour inviter un nouvel utilisateur
- Sélection du rôle (filtré selon la hiérarchie)
- Envoi d'email automatique
- Liste des invitations en attente
- Possibilité d'annuler une invitation (ADMIN uniquement)

**Accès** :
- ✅ SUPER_ADMIN
- ✅ ADMIN (Acme Corp)
- ✅ MANAGER (Acme Corp)
- ❌ PARTNER (pas de permission)
- ❌ VIEWER (pas de permission)
- ❌ HOSTESS (pas de permission)

### Dropdown Rôles

Le dropdown de sélection de rôle est **automatiquement filtré** selon :

1. **Permission** : L'utilisateur doit avoir `invitations.create`
2. **Hiérarchie** : Ne peut inviter que des rôles ≤ son niveau

**Exemple pour MANAGER (level 2)** :
```typescript
const roles = rolesDataRaw?.filter((role) => 
  role.level >= currentUserRoleLevel  // 2, 3, 4, 5
) || [];

// Affiche : Manager, Partner, Viewer, Hostess
// Cache : Super Administrator, Administrator
```

## 🔐 Validation Backend

### Endpoint Invitation

**POST** `/api/v1/invitations`

**Vérifications** :
1. ✅ Utilisateur authentifié
2. ✅ Permission `invitations.create`
3. ✅ Hiérarchie respectée (targetRole.level >= inviterRole.level)
4. ✅ Email valide et non déjà utilisé
5. ✅ Organisation valide

**Code** :
```typescript
// invitation.service.ts (ligne 73-95)

if (!isSuperAdmin) {
  const inviterRoleLevel = invitingUser.role.level;
  const targetRoleLevel = role.level;
  
  if (targetRoleLevel < inviterRoleLevel) {
    throw new BadRequestException(
      `You cannot invite users with role '${role.name}' (level ${targetRoleLevel}). ` +
      `Your role level is ${inviterRoleLevel}...`
    );
  }
}
```

### Endpoint Création Utilisateur

**POST** `/api/v1/users`

**Note** : Cet endpoint n'est **PAS utilisé directement** pour créer des comptes.  
Il est appelé **automatiquement** quand un utilisateur invité finalise son inscription via le lien d'invitation.

Le processus complet :
1. ADMIN appelle `POST /invitations` → Token créé
2. Email envoyé avec lien : `https://app.com/register?token=...`
3. Utilisateur clique et remplit le formulaire
4. Frontend appelle `POST /users` avec le token
5. Backend valide le token et crée le compte

## 🚨 Cas d'Erreur

### "Erreur de chargement" sur la page Invitations

**Symptôme** : Dropdown "Rôle" affiche "Erreur de chargement"

**Causes possibles** :
1. ❌ API `/roles` ne retourne pas `level` dans la réponse
2. ❌ Utilisateur n'a pas la permission `roles.read`
3. ❌ Token expiré ou invalide

**Solution** :
- Vérifier que `roles.controller.ts` inclut `level: role.level` dans le mapping
- Vérifier les permissions : `roles.read` est nécessaire pour charger le dropdown
- Relancer le seed pour réinitialiser les permissions

### PARTNER voit toutes les permissions

**Symptôme** : PARTNER a accès à la page Invitations ou peut créer des users

**Diagnostic** :
```powershell
# Vérifier les permissions actuelles
$partnerToken = (Invoke-RestMethod -Uri "http://localhost:3000/auth/login" `
  -Method POST -Body '{"email":"charlie.brown@acme.com","password":"sales123"}' `
  -ContentType "application/json").access_token

$policy = Invoke-RestMethod -Uri "http://localhost:3000/auth/policy" `
  -Method GET -Headers @{Authorization="Bearer $partnerToken"}

$policy.rules.Count  # Devrait être 4 pour PARTNER
```

**Solution** :
1. Vérifier la base de données : `SELECT role_id FROM users WHERE email = 'charlie.brown@acme.com'`
2. Vérifier le nombre de permissions du rôle : `SELECT COUNT(*) FROM role_permissions WHERE role_id = '...'`
3. Si incorrect : Reseeder la base avec `npm run db:seed`
4. Réassigner l'utilisateur au bon rôle si nécessaire

## 📊 Résumé

### ✅ Validé

- [x] Lien logique : `users.create` ⟺ `invitations.create`
- [x] ADMIN et MANAGER ont les deux permissions
- [x] PARTNER n'a NI `users.create` NI `invitations.create`
- [x] Page Invitations protégée par `<GuardedRoute>`
- [x] Dropdown rôles filtré par hiérarchie
- [x] Backend valide la hiérarchie même si permissions modifiées

### 🎯 Points Clés

1. **Pas de création directe** : Toujours passer par invitation
2. **Double permission** : `users.create` + `invitations.create` obligatoires
3. **Hiérarchie appliquée** : Ne peut inviter que des rôles ≤ son niveau
4. **Guards multiples** : Frontend (UX) + Backend (Sécurité)
5. **Permissions modifiables** : Templates par défaut mais customisables

---

**Date de documentation** : 22 octobre 2025  
**Fichiers liés** :
- `attendee-ems-back/prisma/seeders/permissions.seeder.ts`
- `attendee-ems-back/src/modules/invitation/invitation.service.ts`
- `attendee-ems-front/src/app/routes/index.tsx`
- `attendee-ems-front/src/pages/Invitations/index.tsx`
