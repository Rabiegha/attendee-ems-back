# Hiérarchie des Rôles - Guards Backend

## Vue d'ensemble

Le système implémente une **hiérarchie stricte des rôles** pour contrôler qui peut créer et modifier les utilisateurs. Cette hiérarchie est basée sur le champ `level` de chaque rôle.

## Niveaux hiérarchiques

| Rôle | Code | Level | Description |
|------|------|-------|-------------|
| Super Administrator | `SUPER_ADMIN` | 0 | Accès total multi-tenant |
| Administrator | `ADMIN` | 1 | Accès total dans son organisation |
| Manager | `MANAGER` | 2 | Accès opérationnel (création/modification sans suppression) |
| Partner | `PARTNER` | 3 | Accès aux événements assignés |
| Viewer | `VIEWER` | 4 | Lecture seule |
| Hostess | `HOSTESS` | 5 | Check-in uniquement |

**Plus le level est bas, plus le rôle a de pouvoir.**

## Règles de création d'utilisateurs

### Règle : Création ≤ son niveau

Un utilisateur peut **créer** des utilisateurs dont le rôle est de **niveau inférieur ou égal** au sien.

#### Exemples

**MANAGER (level 2) peut créer :**
- ✅ MANAGER (level 2)
- ✅ PARTNER (level 3)
- ✅ VIEWER (level 4)
- ✅ HOSTESS (level 5)

**MANAGER (level 2) NE PEUT PAS créer :**
- ❌ SUPER_ADMIN (level 0)
- ❌ ADMIN (level 1)

**ADMIN (level 1) peut créer :**
- ✅ ADMIN (level 1)
- ✅ MANAGER (level 2)
- ✅ PARTNER (level 3)
- ✅ VIEWER (level 4)
- ✅ HOSTESS (level 5)

**ADMIN (level 1) NE PEUT PAS créer :**
- ❌ SUPER_ADMIN (level 0)

## Règles de modification d'utilisateurs

### Règle 1 : Modification < son niveau (strictement inférieur)

Un utilisateur peut **modifier** uniquement des utilisateurs dont le rôle est de **niveau strictement inférieur** au sien.

#### Exemples

**MANAGER (level 2) peut modifier :**
- ✅ PARTNER (level 3)
- ✅ VIEWER (level 4)
- ✅ HOSTESS (level 5)

**MANAGER (level 2) NE PEUT PAS modifier :**
- ❌ SUPER_ADMIN (level 0)
- ❌ ADMIN (level 1)
- ❌ Autre MANAGER (level 2) ⚠️ Même niveau = interdit

**ADMIN (level 1) peut modifier :**
- ✅ MANAGER (level 2)
- ✅ PARTNER (level 3)
- ✅ VIEWER (level 4)
- ✅ HOSTESS (level 5)

**ADMIN (level 1) NE PEUT PAS modifier :**
- ❌ SUPER_ADMIN (level 0)
- ❌ Autre ADMIN (level 1) ⚠️ Même niveau = interdit

### Règle 2 : Impossible de modifier son propre rôle

Un utilisateur **ne peut jamais** modifier son propre rôle, même s'il a les permissions `users.update`.

#### Exemples

- ❌ Un MANAGER ne peut pas se promouvoir ADMIN
- ❌ Un ADMIN ne peut pas se promouvoir SUPER_ADMIN
- ❌ Un utilisateur ne peut pas changer son propre rôle pour un autre du même niveau

### Règle 3 : Assignment de rôle respecte la hiérarchie

Lors de la modification d'un utilisateur, le **nouveau rôle assigné** doit aussi respecter la hiérarchie de modification (< son niveau).

#### Exemples

**MANAGER (level 2) modifie un VIEWER (level 4) :**
- ✅ Peut le promouvoir PARTNER (level 3)
- ✅ Peut le rétrograder HOSTESS (level 5)
- ❌ NE PEUT PAS le promouvoir MANAGER (level 2) - même niveau
- ❌ NE PEUT PAS le promouvoir ADMIN (level 1) - niveau supérieur

## Implémentation technique

### Backend - `UsersService`

#### Méthode `create()`

```typescript
// Vérification dans users.service.ts
if (targetRole.level < creatorRoleLevel) {
  throw new BadRequestException(
    `You cannot create users with role '${targetRole.name}' (level ${targetRole.level}). ` +
    `Your role level is ${creatorRoleLevel}. You can only assign roles of level ${creatorRoleLevel} or higher.`
  );
}
```

**Logique :** `targetRole.level < creatorRoleLevel` → Bloqué  
**Exemple :** MANAGER (2) essaie de créer ADMIN (1) → `1 < 2` → ❌ Bloqué

#### Méthode `update()`

```typescript
// Vérification 1 : Ne pas modifier son propre rôle
if (targetUser.id === updaterUserId && updateData.role_id) {
  throw new BadRequestException('You cannot modify your own role');
}

// Vérification 2 : Modifier uniquement niveaux inférieurs
if (targetCurrentRole.level <= updaterRoleLevel) {
  throw new BadRequestException(
    `You cannot modify users with role '${targetCurrentRole.name}' (level ${targetCurrentRole.level}). ` +
    `Your role level is ${updaterRoleLevel}. You can only modify users with role level strictly higher than ${updaterRoleLevel}.`
  );
}

// Vérification 3 : Assigner uniquement niveaux inférieurs
if (newRole.level <= updaterRoleLevel) {
  throw new BadRequestException(
    `You cannot assign role '${newRole.name}' (level ${newRole.level}). ` +
    `Your role level is ${updaterRoleLevel}. You can only assign roles of level strictly higher than ${updaterRoleLevel}.`
  );
}
```

**Logique modification :** `targetCurrentRole.level <= updaterRoleLevel` → Bloqué  
**Exemple :** MANAGER (2) essaie de modifier autre MANAGER (2) → `2 <= 2` → ❌ Bloqué

**Logique assignment :** `newRole.level <= updaterRoleLevel` → Bloqué  
**Exemple :** MANAGER (2) essaie d'assigner ADMIN (1) → `1 <= 2` → ❌ Bloqué

### Backend - `UsersController`

#### POST `/users` - Création

```typescript
@Post()
@Permissions('users.create')
async create(@Body() createUserDto: CreateUserDto, @Request() req) {
  const orgId = req.user.org_id;
  
  // Récupérer le niveau du créateur
  const creatorUser = await this.usersService.findOne(req.user.sub, orgId);
  const creatorRoleLevel = creatorUser?.role?.level;
  
  return this.usersService.create(createUserDto, orgId, creatorRoleLevel);
}
```

#### PATCH `/users/:id` - Modification

```typescript
@Patch(':id')
@Permissions('users.update')
async update(
  @Param('id') id: string, 
  @Body() updateUserDto: UpdateUserDto, 
  @Request() req
) {
  const orgId = req.user.org_id;
  const updaterUserId = req.user.id;
  
  // Récupérer le niveau du modificateur
  const updaterUser = await this.usersService.findOne(updaterUserId, orgId);
  const updaterRoleLevel = updaterUser?.role?.level;
  
  return this.usersService.update(id, updateUserDto, orgId, updaterUserId, updaterRoleLevel);
}
```

## Messages d'erreur

### Création refusée

```
You cannot create users with role 'Administrator' (level 1). 
Your role level is 2. You can only assign roles of level 2 or higher.
```

### Modification refusée (utilisateur cible)

```
You cannot modify users with role 'Manager' (level 2). 
Your role level is 2. You can only modify users with role level strictly higher than 2.
```

### Modification refusée (nouveau rôle assigné)

```
You cannot assign role 'Administrator' (level 1). 
Your role level is 2. You can only assign roles of level strictly higher than 2.
```

### Modification de son propre rôle

```
You cannot modify your own role
```

## Tests recommandés

### Scénario 1 : MANAGER crée un ADMIN ❌

```bash
# Login MANAGER
POST /auth/login
{ "email": "bob.johnson@acme.com", "password": "manager123" }

# Essayer de créer un ADMIN (level 1)
POST /users
{
  "email": "newadmin@acme.com",
  "password": "admin123",
  "role_id": "<ADMIN_ROLE_ID>",  # level 1
  "first_name": "New",
  "last_name": "Admin"
}

# Résultat attendu : 400 Bad Request
# Message : "You cannot create users with role 'Administrator' (level 1)..."
```

### Scénario 2 : MANAGER crée un VIEWER ✅

```bash
# Login MANAGER
POST /auth/login
{ "email": "bob.johnson@acme.com", "password": "manager123" }

# Créer un VIEWER (level 4)
POST /users
{
  "email": "newviewer@acme.com",
  "password": "viewer123",
  "role_id": "<VIEWER_ROLE_ID>",  # level 4
  "first_name": "New",
  "last_name": "Viewer"
}

# Résultat attendu : 201 Created
```

### Scénario 3 : MANAGER modifie un autre MANAGER ❌

```bash
# Login MANAGER
POST /auth/login
{ "email": "bob.johnson@acme.com", "password": "manager123" }

# Essayer de modifier un autre MANAGER (level 2)
PATCH /users/<OTHER_MANAGER_ID>
{
  "first_name": "Modified"
}

# Résultat attendu : 400 Bad Request
# Message : "You cannot modify users with role 'Manager' (level 2)..."
```

### Scénario 4 : MANAGER modifie son propre rôle ❌

```bash
# Login MANAGER
POST /auth/login
{ "email": "bob.johnson@acme.com", "password": "manager123" }

# Essayer de changer son propre rôle
PATCH /users/<SELF_ID>
{
  "role_id": "<ADMIN_ROLE_ID>"
}

# Résultat attendu : 400 Bad Request
# Message : "You cannot modify your own role"
```

### Scénario 5 : MANAGER modifie un VIEWER en PARTNER ✅

```bash
# Login MANAGER
POST /auth/login
{ "email": "bob.johnson@acme.com", "password": "manager123" }

# Modifier un VIEWER (level 4) et le promouvoir PARTNER (level 3)
PATCH /users/<VIEWER_ID>
{
  "role_id": "<PARTNER_ROLE_ID>"  # level 3
}

# Résultat attendu : 200 OK
```

### Scénario 6 : MANAGER essaie de promouvoir un VIEWER en ADMIN ❌

```bash
# Login MANAGER
POST /auth/login
{ "email": "bob.johnson@acme.com", "password": "manager123" }

# Modifier un VIEWER (level 4) et essayer de le promouvoir ADMIN (level 1)
PATCH /users/<VIEWER_ID>
{
  "role_id": "<ADMIN_ROLE_ID>"  # level 1
}

# Résultat attendu : 400 Bad Request
# Message : "You cannot assign role 'Administrator' (level 1)..."
```

### Scénario 7 : ADMIN modifie un MANAGER ✅

```bash
# Login ADMIN
POST /auth/login
{ "email": "jane.smith@acme.com", "password": "admin123" }

# Modifier un MANAGER (level 2)
PATCH /users/<MANAGER_ID>
{
  "first_name": "Modified Manager"
}

# Résultat attendu : 200 OK
```

## Cas spéciaux

### SUPER_ADMIN

Le **SUPER_ADMIN** (level 0) a un traitement spécial :
- Bypass toutes les permissions via `getPolicyRules()` dans `auth.service.ts`
- Retourne `{action: 'manage', subject: 'all'}`
- Peut créer et modifier **tous** les utilisateurs sans restriction
- Peut voir toutes les organisations (multi-tenant)

**Note :** Le SUPER_ADMIN n'est pas soumis aux règles de hiérarchie car il a un accès total au système.

## Résumé visuel

```
┌─────────────────────────────────────────────────────────────┐
│                    HIÉRARCHIE DES RÔLES                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Level 0: SUPER_ADMIN  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│           │                                              ┃  │
│           │ Peut créer/modifier: TOUS                    ┃  │
│           ▼                                              ┃  │
│  Level 1: ADMIN        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┃  │
│           │                                           ┃  ┃  │
│           │ Peut créer: ADMIN, MANAGER, PARTNER...    ┃  ┃  │
│           │ Peut modifier: MANAGER, PARTNER...        ┃  ┃  │
│           ▼                                           ┃  ┃  │
│  Level 2: MANAGER      ━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┃  ┃  │
│           │                                       ┃  ┃  ┃  │
│           │ Peut créer: MANAGER, PARTNER...       ┃  ┃  ┃  │
│           │ Peut modifier: PARTNER, VIEWER...     ┃  ┃  ┃  │
│           ▼                                       ┃  ┃  ┃  │
│  Level 3: PARTNER      ━━━━━━━━━━━━━━━━━━━┓    ┃  ┃  ┃  │
│           │                               ┃    ┃  ┃  ┃  │
│           ▼                               ┃    ┃  ┃  ┃  │
│  Level 4: VIEWER       ━━━━━━━━━━━━━┓   ┃    ┃  ┃  ┃  │
│           │                           ┃   ┃    ┃  ┃  ┃  │
│           ▼                           ┃   ┃    ┃  ┃  ┃  │
│  Level 5: HOSTESS      ━━━━━━━━━┓   ┃   ┃    ┃  ┃  ┃  │
│                                   ┃   ┃   ┃    ┃  ┃  ┃  │
│                                   ┗━━━┻━━━┻━━━━┻━━┻━━┻━━┫
│                                                             │
│  RÈGLES:                                                    │
│  • Création: ≤ son level (peut créer même niveau)          │
│  • Modification: < son level (strictement inférieur)       │
│  • Pas de modification de son propre rôle                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Prochaines étapes

1. ✅ Backend guards implémentés
2. ⏳ Tester les endpoints avec différents rôles
3. ⏳ Frontend : Filtrer la liste des rôles dans le formulaire selon la hiérarchie
4. ⏳ Frontend : Afficher un message d'erreur clair si tentative de création/modification interdite
5. ⏳ Ajouter des tests unitaires et e2e pour valider tous les scénarios
