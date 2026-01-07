# STEP 4 : Refactor Services & Application Layer

> **Statut** : 🔨 **À DÉMARRER**  
> **Prérequis** : ✅ STEP 1 (Multi-tenant DB) + ✅ STEP 2 (JWT) + ✅ STEP 3 (Core RBAC)  
> **Durée estimée** : 3-5 jours  
> **Priorité** : 🔴 **CRITIQUE** (mise en application du système RBAC)

## 🎯 Objectif

Adapter **tous les services, controllers et middlewares** pour utiliser le nouveau modèle multi-tenant et le core RBAC hexagonal.

### 🔑 Note sur JWT Minimal (STEP 2)

Avec le JWT minimal, `JwtPayload` contient uniquement :
```typescript
{ sub, mode, currentOrgId?, iat, exp }
```

**Conséquence** : Si vous avez besoin de `isPlatform` ou `isRoot` dans un controller/service, vous devez :

1. **Option A (Recommandée)** : Utiliser `RequirePermissionGuard` qui construit `AuthContext` automatiquement via `AuthContextPort`
2. **Option B** : Injecter `AuthContextPort` et appeler `buildAuthContext(user)` manuellement

```typescript
// ❌ Ne fonctionne plus
if (user.isPlatform) { ... }

// ✅ Option A : Utiliser le guard (recommandé)
@RequirePermission('platform.action')  
// Le guard appelle authContextPort.buildAuthContext() automatiquement

// ✅ Option B : Construire AuthContext manuellement
constructor(private authContextPort: AuthContextPort) {}

async someMethod(user: JwtPayload) {
  const authContext = await this.authContextPort.buildAuthContext(user);
  if (authContext.isPlatform) { 
    // Logique spécifique platform
  }
}
```

**Important** : N'utilisez l'Option B que si vous avez besoin de `isPlatform`/`isRoot` en dehors d'une vérification de permission. Dans la majorité des cas, l'Option A (guard) est suffisante.

## ❓ Pourquoi maintenant ?

Le nouveau système est prêt mais **pas utilisé** :
- ✅ DB multi-tenant créée (STEP 1)
- ✅ JWT contient `currentOrgId` (STEP 2)
- ✅ Core RBAC hexagonal créé (STEP 3)
- ❌ **Mais le code applicatif utilise encore l'ancien modèle !**

**Ce STEP** = Refactor progressif du code métier pour utiliser le nouveau système.

---

## 📋 Stratégie de Migration Progressive

### Phase 1 : AuthService (CRITIQUE - 1 jour)
**Impact** : Login, validation user, JWT  
**Fichiers** : `src/auth/auth.service.ts`, `src/auth/jwt.strategy.ts`

### Phase 2 : UsersService (RÉFÉRENCE - 1 jour)
**Impact** : Template pour les autres services  
**Fichiers** : `src/modules/users/users.service.ts`, `users.controller.ts`

### Phase 3 : Services Métier (2-3 jours)
**Impact** : Events, Registrations, Badges, Organizations  
**Parallélisable** : Peut être fait par plusieurs devs

### Phase 4 : Controllers & Guards (1 jour)
**Impact** : Remplacement guards existants par `@RequirePermission`

---

## 📁 Phase 1 : AuthService

### Problèmes Actuels

```typescript
// ❌ ANCIEN CODE (ne compile plus)
async validateUserById(userId: string) {
  return this.prisma.user.findUnique({
    where: { id: userId },
    include: { role: true } // ❌ role n'existe plus en relation directe
  });
}
```

### Solution

```typescript
// ✅ NOUVEAU CODE (STEP 4)
async validateUserById(userId: string) {
  return this.prisma.user.findUnique({
    where: { id: userId },
    include: {
      orgMemberships: {
        include: { organization: true },
      },
      tenantRoles: {
        include: { 
          role: true,
          organization: true 
        },
      },
      platformRole: {
        include: { role: true },
      },
    },
  });
}
```

### Fichiers à Modifier

**`src/auth/auth.service.ts`**
- ✅ `login()` : Déjà modifié dans STEP 2 (utilise `generateJwtForOrg`)
- ✅ `validateUserById()` : Charger les relations multi-tenant
- ✅ `refresh()` : Utiliser le nouveau JWT payload

**`src/auth/jwt.strategy.ts`**
- ✅ Déjà adapté dans STEP 2 (retourne JwtPayload complet)

---

## 📁 Phase 2 : UsersService (Service Référence)

### 🔍 Analyse des Opérations

| Opération | Ancien Modèle | Nouveau Modèle |
|-----------|---------------|----------------|
| `create()` | 1 opération | 3 opérations (User + OrgUser + TenantUserRole) |
| `findAll()` | `WHERE org_id = ?` | `JOIN org_users` |
| `findOne()` | Simple `findUnique` | `include` relations |
| `update()` | Mettre à jour `role_id` | Mettre à jour `TenantUserRole` |
| `remove()` | Simple `delete` | Cascade via relations |

### Méthode 1 : `create()`

**Avant ❌**
```typescript
async create(createUserDto: CreateUserDto, orgId: string) {
  return this.prisma.user.create({
    data: {
      email: createUserDto.email,
      password_hash: hashedPassword,
      org_id: orgId,        // ❌ N'existe plus
      role_id: roleId,      // ❌ N'existe plus
      first_name: createUserDto.first_name,
      // ...
    },
  });
}
```

**Après ✅**
```typescript
async create(createUserDto: CreateUserDto, orgId: string, roleId: string) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Créer le user global
    const user = await tx.user.create({
      data: {
        email: createUserDto.email,
        password_hash: hashedPassword,
        first_name: createUserDto.first_name,
        last_name: createUserDto.last_name,
        phone: createUserDto.phone,
        company: createUserDto.company,
        job_title: createUserDto.job_title,
        country: createUserDto.country,
        is_active: true,
      },
    });

    // 2. Créer le membership
    await tx.orgUser.create({
      data: {
        user_id: user.id,
        org_id: orgId,
      },
    });

    // 3. Assigner le rôle tenant
    await tx.tenantUserRole.create({
      data: {
        user_id: user.id,
        org_id: orgId,
        role_id: roleId,
      },
    });

    // 4. Recharger avec les relations
    return tx.user.findUnique({
      where: { id: user.id },
      include: {
        orgMemberships: {
          where: { org_id: orgId },
          include: { organization: true },
        },
        tenantRoles: {
          where: { org_id: orgId },
          include: { role: true },
        },
      },
    });
  });
}
```

### Méthode 2 : `findAll()`

**Avant ❌**
```typescript
async findAll(orgId: string) {
  return this.prisma.user.findMany({
    where: { org_id: orgId },  // ❌ Champ n'existe plus
    include: { role: true },    // ❌ Relation n'existe plus
  });
}
```

**Après ✅**
```typescript
async findAll(orgId: string) {
  return this.prisma.user.findMany({
    where: {
      orgMemberships: {
        some: { org_id: orgId },  // ✅ Jointure via table intermédiaire
      },
    },
    include: {
      orgMemberships: {
        where: { org_id: orgId },
        include: { organization: true },
      },
      tenantRoles: {
        where: { org_id: orgId },
        include: { role: true },
      },
      platformRole: {
        include: { role: true },
      },
    },
  });
}
```

### Méthode 3 : `findOne()`

**Avant ❌**
```typescript
async findOne(id: string) {
  return this.prisma.user.findUnique({
    where: { id },
    include: { role: true },  // ❌
  });
}
```

**Après ✅**
```typescript
async findOne(id: string, orgId: string) {
  return this.prisma.user.findUnique({
    where: { id },
    include: {
      orgMemberships: {
        where: { org_id: orgId },
        include: { organization: true },
      },
      tenantRoles: {
        where: { org_id: orgId },
        include: { role: true },
      },
      platformRole: {
        include: { role: true },
      },
    },
  });
}
```

### Méthode 4 : `update()`

**Avant ❌**
```typescript
async update(id: string, updateUserDto: UpdateUserDto) {
  return this.prisma.user.update({
    where: { id },
    data: {
      first_name: updateUserDto.first_name,
      role_id: updateUserDto.roleId,  // ❌
      // ...
    },
  });
}
```

**Après ✅**
```typescript
async update(id: string, orgId: string, updateUserDto: UpdateUserDto) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Mettre à jour le user
    const user = await tx.user.update({
      where: { id },
      data: {
        first_name: updateUserDto.first_name,
        last_name: updateUserDto.last_name,
        phone: updateUserDto.phone,
        company: updateUserDto.company,
        job_title: updateUserDto.job_title,
        country: updateUserDto.country,
      },
    });

    // 2. Mettre à jour le rôle si changé
    if (updateUserDto.roleId) {
      await tx.tenantUserRole.update({
        where: {
          user_id_org_id: { user_id: id, org_id: orgId },
        },
        data: {
          role_id: updateUserDto.roleId,
        },
      });
    }

    // 3. Recharger avec les relations
    return tx.user.findUnique({
      where: { id },
      include: {
        tenantRoles: {
          where: { org_id: orgId },
          include: { role: true },
        },
      },
    });
  });
}
```

### Méthode 5 : `assignRoleToUser()`

**Nouvelle méthode (n'existait pas avant)**
```typescript
async assignRoleToUser(userId: string, orgId: string, roleId: string) {
  // Vérifier que le user est membre de l'org
  const membership = await this.prisma.orgUser.findUnique({
    where: {
      user_id_org_id: { user_id: userId, org_id: orgId },
    },
  });

  if (!membership) {
    throw new BadRequestException('User is not a member of this organization');
  }

  // Vérifier que le rôle appartient à l'org
  const role = await this.prisma.role.findFirst({
    where: { id: roleId, org_id: orgId },
  });

  if (!role) {
    throw new NotFoundException('Role not found in this organization');
  }

  // Upsert le rôle tenant
  return this.prisma.tenantUserRole.upsert({
    where: {
      user_id_org_id: { user_id: userId, org_id: orgId },
    },
    create: {
      user_id: userId,
      org_id: orgId,
      role_id: roleId,
    },
    update: {
      role_id: roleId,
    },
  });
}
```

### Méthode 6 : `assignRoleToUser()` (avec hiérarchie) ⭐

**Nouvelle méthode avec vérification de la hiérarchie**
```typescript
async assignRoleToUser(
  managerId: string,
  targetUserId: string,
  roleId: string,
  orgId: string,
) {
  // 1. Vérifier que le user est membre de l'org
  const membership = await this.prisma.orgUser.findUnique({
    where: {
      user_id_org_id: { user_id: targetUserId, org_id: orgId },
    },
  });

  if (!membership) {
    throw new BadRequestException('User is not a member of this organization');
  }

  // 2. Vérifier que le rôle appartient à l'org
  const role = await this.prisma.role.findFirst({
    where: { id: roleId, org_id: orgId },
  });

  if (!role) {
    throw new NotFoundException('Role not found in this organization');
  }

  // 3. Vérifier permission RBAC
  await this.authz.assert('user.role.assign', {
    userId: managerId,
    currentOrgId: orgId,
    mode: 'tenant',
    isPlatform: false,
    isRoot: false,
  });

  // 4. ⭐ Vérifier hiérarchie : le manager peut-il gérer ce user ?
  await this.authz.assertDecision(
    await this.authz.canManageUser(managerId, targetUserId, orgId)
  );

  // 5. ⭐ Vérifier hiérarchie : le manager peut-il assigner ce rôle ?
  await this.authz.assertDecision(
    await this.authz.canAssignRole(managerId, roleId, orgId)
  );

  // 6. Upsert le rôle tenant
  return this.prisma.tenantUserRole.upsert({
    where: {
      user_id_org_id: { user_id: targetUserId, org_id: orgId },
    },
    create: {
      user_id: targetUserId,
      org_id: orgId,
      role_id: roleId,
    },
    update: {
      role_id: roleId,
    },
  });
}
```

**Résultat** :
- ✅ Admin (level=1) peut assigner Manager (level=2) à un Staff (level=3)
- ❌ Manager (level=2) CANNOT assigner Admin (level=1) à quelqu'un
- ❌ Manager (level=2) CANNOT modifier un autre Manager (level=2)

---

## 🔝 Utilisation de la Hiérarchie (Nouveauté STEP 3)

### Flux Complet : Assignation de Rôle

```
1. UsersController reçoit la requête
   ├─ @RequirePermission('user.role.assign')
   └─ Appelle UsersService.assignRoleToUser()
       ↓
2. UsersService vérifie la hiérarchie
   ├─ authz.canManageUser(managerId, targetUserId, orgId)
   │  → Vérifie : managerLevel < targetLevel ?
   │
   └─ authz.canAssignRole(managerId, roleId, orgId)
      → Vérifie : managerLevel < roleLevel ?
       ↓
3. Si OK → Assigner le rôle
   Si KO → ForbiddenException avec HIERARCHY_VIOLATION
```

### Exemple : Controller avec Hiérarchie

```typescript
@Controller('users')
@UseGuards(JwtAuthGuard, TenantContextGuard, RequirePermissionGuard)
export class UsersController {
  constructor(
    private usersService: UsersService,
  ) {}

  /**
   * Assigner un rôle à un user
   * Permission RBAC : user.role.assign
   * Hiérarchie : vérifiée dans le service
   */
  @Patch(':id/role')
  @RequirePermission('user.role.assign')
  async assignRole(
    @CurrentUser() user: JwtPayload,
    @Param('id') targetUserId: string,
    @Body() dto: AssignRoleDto,
  ) {
    // Le service gère automatiquement :
    // 1. Permission RBAC
    // 2. Hiérarchie (canManageUser + canAssignRole)
    return this.usersService.assignRoleToUser(
      user.sub,           // Manager ID
      targetUserId,       // Target User ID
      dto.roleId,         // New Role ID
      user.currentOrgId,  // Org context
    );
  }

  /**
   * Mettre à jour un user
   * Permission RBAC : user.update
   * Hiérarchie : vérifiée avant modification
   */
  @Patch(':id')
  @RequirePermission('user.update')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') targetUserId: string,
    @Body() dto: UpdateUserDto,
  ) {
    // Vérifier la hiérarchie avant toute modification
    await this.authz.assertDecision(
      await this.authz.canManageUser(user.sub, targetUserId, user.currentOrgId)
    );

    return this.usersService.update(targetUserId, user.currentOrgId, dto);
  }

  /**
   * Supprimer un user
   * Permission RBAC : user.delete
   * Hiérarchie : vérifiée avant suppression
   */
  @Delete(':id')
  @RequirePermission('user.delete')
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') targetUserId: string,
  ) {
    // Vérifier la hiérarchie avant suppression
    await this.authz.assertDecision(
      await this.authz.canManageUser(user.sub, targetUserId, user.currentOrgId)
    );

    return this.usersService.remove(targetUserId, user.currentOrgId);
  }
}
```

### Gestion des Erreurs Hiérarchiques

```typescript
// Dans le service
try {
  await this.authz.assertDecision(
    await this.authz.canManageUser(managerId, targetUserId, orgId)
  );
} catch (error) {
  if (error.message.includes('HIERARCHY_VIOLATION')) {
    throw new ForbiddenException(
      'You cannot manage a user with equal or higher role level than yours.'
    );
  }
  throw error;
}
```

### Frontend : Affichage Conditionnel

```typescript
// Le frontend peut désactiver les boutons pour les users "non gérable"
const canManageUser = (managerLevel: number, targetLevel: number) => {
  return managerLevel < targetLevel;
};

// Exemple : Admin (level=1) voit tous les boutons
// Manager (level=2) ne voit pas les boutons pour Admin (level=1)
<button disabled={!canManageUser(currentUser.level, targetUser.level)}>
  Modifier le rôle
</button>
```

## 📊 Checklist Globale

### Phase 1 : AuthService
- [ ] Adapter `validateUserById()`
- [ ] Adapter `validateUser()` (login)
- [ ] Vérifier `refresh()` utilise le nouveau JWT
- [ ] Tests unitaires adaptés
- [ ] Tests E2E adaptés

### Phase 2 : UsersService (Référence)
- [ ] Adapter `create()` (transaction 3 étapes)
- [ ] Adapter `findAll()` (jointure org_users)
- [ ] Adapter `findOne()` (include relations)
- [ ] Adapter `update()` (mise à jour TenantUserRole)
- [ ] Créer `assignRoleToUser()` (avec hiérarchie) ⭐
- [ ] Tests unitaires adaptés
- [ ] Tests E2E adaptés
- [ ] Tests de hiérarchie ⭐

### Phase 3 : Services Métier
- [ ] EventsService migré
- [ ] RegistrationsService migré
- [ ] BadgesService migré
- [ ] OrganizationsService migré
- [ ] InvitationsService migré
- [ ] Autres services métier migrés

### Phase 4 : Controllers
- [ ] Remplacer `@Roles()` par `@RequirePermission()`
- [ ] Remplacer `req.user.org_id` par `user.currentOrgId`
- [ ] Ajouter injection `rbacContext` pour scopes
- [ ] Supprimer anciens guards (RoleGuard, etc.)
- [ ] Tests E2E adaptés

### Phase 5 : Nettoyage
- [ ] Supprimer anciens guards inutilisés
- [ ] Supprimer anciens decorators inutilisés
- [ ] Mettre à jour documentation Swagger
- [ ] Mettre à jour Postman collections

---

## 🎯 Checklist de Validation

Avant de passer à STEP 5 :

- [ ] **Compilation** : `npm run build` passe sans erreur
- [ ] **Tests unitaires** : `npm test` passe
- [ ] **Tests E2E** : `npm run test:e2e` passe
- [ ] **Login fonctionne** : JWT contient `currentOrgId`
- [ ] **Switch org fonctionne** : Nouveau JWT généré
- [ ] **Permissions fonctionnent** : `@RequirePermission` bloque correctement
- [ ] **Scopes fonctionnent** : `own` vs `any` vs `assigned` bien testés
- [ ] **Aucune régression** : Features existantes fonctionnent

---

## ➡️ Prochaine Étape

**STEP 5** : Provisioning & Propagation  
→ Voir [STEP_5_PROVISIONING.md](./STEP_5_PROVISIONING.md)

Le système RBAC est utilisé partout → on peut automatiser la gestion ! 🎯

---

## 📚 Références

- [NestJS Transactions](https://www.prisma.io/docs/guides/performance-and-optimization/prisma-client-transactions-guide)
- [Prisma Include](https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries)
- [Testing Best Practices](https://docs.nestjs.com/fundamentals/testing)
