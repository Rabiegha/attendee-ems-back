# 🛡️ Système RBAC - Structure Améliorée

**Date de mise à jour**: 22 octobre 2025  
**Version**: 2.0

---

## 📋 Vue d'ensemble

Système de contrôle d'accès basé sur les rôles (RBAC) simplifié et robuste pour l'EMS.

### Principe Simple

- **1 utilisateur = 1 rôle**
- **SUPER_ADMIN** : Accès total cross-tenant (développeurs uniquement)
- **ADMIN** : Accès total dans son organisation, **SAUF ne peut pas modifier son propre rôle**
- **Autres rôles** : Permissions fixes, ne peuvent PAS modifier les permissions

---

## 👥 Rôles et Hiérarchie

### 🔴 SUPER_ADMIN (Niveau 100)
**Public**: Développeurs de l'application uniquement  
**Portée**: Cross-tenant (toutes les organisations)  
**Restrictions**: Aucune

**Capacités**:
- ✅ Accès à TOUTES les organisations
- ✅ Peut créer/supprimer des organisations
- ✅ Peut modifier TOUS les rôles (y compris ADMIN)
- ✅ Accès total système

**Cas d'usage**: Maintenance système, configuration initiale

---

### 🟠 ADMIN (Niveau 80)
**Public**: Un par organisation  
**Portée**: Organisation uniquement  
**Restrictions**: **Ne peut PAS modifier son propre rôle**

**Capacités**:
- ✅ Gestion complète de son organisation
- ✅ Créer/modifier/supprimer des utilisateurs
- ✅ Assigner des rôles (sauf changer le sien)
- ✅ Gestion complète des événements
- ✅ Gestion complète des participants
- ✅ Envoyer des invitations
- ✅ Accès analytics et exports

**Limitations**:
- ❌ Ne peut pas modifier son propre rôle (seul SUPER_ADMIN le peut)
- ❌ Ne peut pas accéder aux autres organisations

---

### 🟡 MANAGER (Niveau 60)
**Public**: Gestionnaires d'événements  
**Portée**: Organisation uniquement  
**Restrictions**: Aucune modification de rôles/permissions

**Capacités**:
- ✅ Créer et gérer les événements
- ✅ Gérer les participants
- ✅ Effectuer le check-in
- ✅ Consulter les utilisateurs
- ✅ Accès analytics et exports

**Limitations**:
- ❌ Ne peut PAS créer/supprimer des utilisateurs
- ❌ Ne peut PAS assigner des rôles
- ❌ Ne peut PAS envoyer d'invitations

---

### 🔵 VIEWER (Niveau 40)
**Public**: Observateurs, consultants  
**Portée**: Organisation uniquement  
**Restrictions**: Lecture seule

**Capacités**:
- ✅ Consulter les événements
- ✅ Consulter les participants
- ✅ Voir les analytics

**Limitations**:
- ❌ Aucune modification possible
- ❌ Lecture seule stricte

---

### 🟣 PARTNER (Niveau 20)
**Public**: Partenaires externes  
**Portée**: Événements assignés uniquement  
**Restrictions**: Accès limité aux événements assignés

**Capacités**:
- ✅ Consulter les événements qui lui sont assignés
- ✅ Consulter les participants de ses événements

**Limitations**:
- ❌ Ne voit QUE les événements assignés
- ❌ Aucune modification possible

---

### 🟢 HOSTESS (Niveau 10)
**Public**: Personnel d'accueil  
**Portée**: Événements assignés uniquement  
**Restrictions**: Check-in uniquement

**Capacités**:
- ✅ Consulter les événements assignés
- ✅ Check-in des participants
- ✅ Scanner les QR codes

**Limitations**:
- ❌ Ne voit QUE les événements assignés
- ❌ Ne peut PAS modifier les données participants

---

## 🔐 Matrice des Permissions

### Légende
- ✅ Permission accordée
- ❌ Permission refusée
- 🔒 Permission accordée avec restrictions

| Permission | SUPER_ADMIN | ADMIN | MANAGER | VIEWER | PARTNER | HOSTESS |
|-----------|-------------|-------|---------|--------|---------|---------|
| **Organizations** |
| Créer organisations | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Voir toutes orgs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Voir son org | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Modifier son org | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Users** |
| Créer utilisateurs | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Voir utilisateurs | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Modifier utilisateurs | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Supprimer utilisateurs | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Voir son profil | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Events** |
| Créer événements | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Voir tous événements | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Voir événements assignés | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Modifier événements | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Supprimer événements | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Publier événements | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Attendees** |
| Créer participants | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Voir participants | ✅ | ✅ | ✅ | ✅ | 🔒 | 🔒 |
| Modifier participants | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Supprimer participants | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Check-in participants | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Exporter participants | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Roles & Invitations** |
| Voir rôles | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assigner rôles | ✅ | 🔒 | ❌ | ❌ | ❌ | ❌ |
| Envoyer invitations | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Voir invitations | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Annuler invitations | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Analytics** |
| Voir analytics | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Exporter rapports | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

🔒 = **ADMIN** peut assigner des rôles mais **PAS modifier son propre rôle**

---

## 🔧 Implémentation Technique

### Backend (NestJS + CASL)

#### 1. CASL Ability Factory
```typescript
// src/rbac/casl-ability.factory.ts

createForUser(user: any): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  // SUPER_ADMIN : accès total
  if (user.role === 'SUPER_ADMIN') {
    can(Action.Manage, 'all');
    return build();
  }

  // ADMIN : accès total dans son org
  if (user.role === 'ADMIN') {
    can(Action.Manage, 'all', { orgId: user.org_id });
    return build();
  }

  // Autres rôles : permissions granulaires
  user.permissions.forEach((permission) => {
    const ability = parsePermission(permission);
    can(ability.action, ability.subject, ability.conditions);
  });

  return build();
}
```

#### 2. Role Modification Guard
```typescript
// src/common/guards/role-modification.guard.ts

// Empêche un ADMIN de modifier son propre rôle
if (user.role === 'ADMIN' && user.sub === targetUserId) {
  throw new ForbiddenException(
    'Administrators cannot modify their own role.'
  );
}
```

#### 3. Application du Guard
```typescript
// Dans UsersController
@UseGuards(JwtAuthGuard, RoleModificationGuard)
@Patch(':id')
async updateUser(@Param('id') id: string, @Body() updateDto: UpdateUserDto) {
  // Le guard vérifie automatiquement les règles avant d'arriver ici
  return this.usersService.update(id, updateDto);
}
```

---

## 🧪 Scénarios de Test

### Scénario 1: SUPER_ADMIN modifie un ADMIN
**Résultat attendu**: ✅ Succès

```http
PATCH /users/{adminUserId}
Authorization: Bearer {superAdminToken}
Content-Type: application/json

{
  "role_id": "{newRoleId}"
}
```

### Scénario 2: ADMIN modifie son propre rôle
**Résultat attendu**: ❌ Erreur 403 Forbidden

```http
PATCH /users/{ownUserId}
Authorization: Bearer {adminToken}
Content-Type: application/json

{
  "role_id": "{newRoleId}"
}
```
**Message**: "Administrators cannot modify their own role. Contact a SUPER_ADMIN for role changes."

### Scénario 3: ADMIN modifie un autre utilisateur de son org
**Résultat attendu**: ✅ Succès

```http
PATCH /users/{otherUserId}
Authorization: Bearer {adminToken}
Content-Type: application/json

{
  "role_id": "{newRoleId}"
}
```

### Scénario 4: MANAGER tente de modifier un rôle
**Résultat attendu**: ❌ Erreur 403 Forbidden

```http
PATCH /users/{userId}
Authorization: Bearer {managerToken}
Content-Type: application/json

{
  "role_id": "{newRoleId}"
}
```
**Message**: "You do not have permission to modify user roles. Only SUPER_ADMIN and ADMIN can assign roles."

---

## 📝 Format des Permissions

Format: `resource.action:scope`

**Exemples**:
- `users.read:own` - Lire son propre profil
- `users.read:any` - Lire tous les utilisateurs
- `events.create` - Créer des événements
- `attendees.checkin` - Effectuer le check-in

**Actions disponibles**:
- `create` - Créer
- `read` - Lire
- `update` - Modifier
- `delete` - Supprimer
- `manage` - Gérer (toutes actions)
- `assign` - Assigner
- `checkin` - Check-in
- `export` - Exporter
- `publish` - Publier
- `cancel` - Annuler
- `view` - Consulter

**Scopes**:
- `:own` - Propre ressource uniquement
- `:any` - Toutes les ressources
- (pas de scope) - Défaut selon le contexte

---

## 🚀 Migration et Déploiement

### Étape 1: Appliquer les seeds
```bash
npm run db:seed
```

### Étape 2: Redémarrer l'API
```bash
docker restart ems_api
```

### Étape 3: Vérifier les permissions
```bash
# Connexion avec john.doe@system.com (SUPER_ADMIN)
# Connexion avec jane.smith@acme.com (ADMIN)
# Tester les restrictions
```

---

## 📊 Résumé des Changements

### ✅ Améliorations
1. **28 permissions** bien définies (vs 18 avant)
2. **Guard automatique** pour empêcher ADMIN de modifier son rôle
3. **CASL simplifié** avec logique claire SUPER_ADMIN/ADMIN/Autres
4. **Documentation complète** avec matrice de permissions
5. **Scopes clairs** (:own, :any) pour permissions granulaires

### 🎯 Règles Clés
- SUPER_ADMIN = Dieu mode (développeurs uniquement)
- ADMIN = Dieu mode dans son org (sauf son propre rôle)
- Autres = Permissions fixes, pas de modification possible

### 🔒 Sécurité Renforcée
- Guard automatique sur modification de rôles
- Validation côté backend ET frontend
- Permissions explicites (pas d'hérit age ambig u)
- Isolation multi-tenant stricte

---

**Fait avec ❤️ pour EMS**
