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

**Conséquence** : Si vous avez besoin de `isPlatform` ou `isRoot` dans un controller, vous devez :
1. **Option A** : Utiliser `RequirePermissionGuard` qui construit `AuthContext` automatiquement
2. **Option B** : Injecter `AuthContextPort` et appeler `buildAuthContext(user)` manuellement

```typescript
// ❌ Ne fonctionne plus
if (user.isPlatform) { ... }

// ✅ Utiliser le guard (recommandé)
@RequirePermission('platform.action')  // Le guard gère isPlatform

// ✅ OU construire AuthContext manuellement
const authContext = await this.authContextPort.buildAuthContext(user);
if (authContext.isPlatform) { ... }
```

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

---

## 📁 Phase 3 : Services Métier

### Template de Migration

Pour chaque service (`EventsService`, `RegistrationsService`, etc.) :

#### 1. Identifier les patterns problématiques

```bash
# Rechercher les utilisations de l'ancien modèle
grep -r "org_id:" src/modules/
grep -r "user.role" src/modules/
grep -r "req.user.org_id" src/modules/
```

#### 2. Adapter les méthodes

**Pattern général :**
```typescript
// Avant
where: { org_id: orgId }

// Après
where: { org_id: orgId } // ✅ OK pour les modèles qui ont org_id
```

**Note** : Les modèles métier (`Event`, `Attendee`, `Badge`) **gardent** leur `org_id` direct ! Seul `User` a changé.

#### 3. Vérifier les relations

```typescript
// Exemple : EventsService
async findAll(orgId: string) {
  return this.prisma.event.findMany({
    where: { org_id: orgId }, // ✅ OK (Event a toujours org_id)
    include: {
      organization: true,
      // ... autres relations
    },
  });
}
```

### Services à Migrer (par ordre de priorité)

1. **EventsService** (critique)
   - Peu de changements (Event garde org_id)
   - Vérifier les relations avec User (created_by)

2. **RegistrationsService** (critique)
   - Peu de changements
   - Vérifier les snapshots user

3. **BadgesService** (moyen)
   - Relation avec User (generated_by)
   - Adapter les queries

4. **OrganizationsService** (faible)
   - Surtout les relations avec users

5. **InvitationsService** (faible)
   - Relation avec User (sent_by)

---

## 📁 Phase 4 : Controllers & Guards

### Remplacer les Guards Existants

**Avant ❌**
```typescript
@Controller('events')
@UseGuards(JwtAuthGuard, RoleGuard) // ❌ Ancien système
export class EventsController {
  @Get()
  @Roles('ADMIN', 'MANAGER') // ❌ Decorator custom
  async findAll(@Req() req) {
    const orgId = req.user.org_id; // ❌ N'existe plus
    return this.eventsService.findAll(orgId);
  }
}
```

**Après ✅**
```typescript
@Controller('events')
@UseGuards(JwtAuthGuard, TenantContextGuard, RequirePermissionGuard) // ✅ Nouveau système
export class EventsController {
  @Get()
  @RequirePermission('event.read') // ✅ Permission-based
  async findAll(@CurrentUser() user: JwtPayload) {
    const orgId = user.currentOrgId; // ✅ Depuis JWT
    return this.eventsService.findAll(orgId);
  }

  @Post()
  @RequirePermission('event.create')
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() createEventDto: CreateEventDto,
  ) {
    return this.eventsService.create(createEventDto, user.currentOrgId);
  }

  @Patch(':id')
  @RequirePermission('event.update')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    // Charger la ressource pour vérifier le scope
    const event = await this.eventsService.findOne(id);
    
    // Injecter le RBAC context (pour scope 'own')
    const req = /* récupérer req depuis context */;
    req.rbacContext = {
      resourceOwnerId: event.created_by,
      resourceOrgId: event.org_id,
    };

    return this.eventsService.update(id, updateEventDto);
  }
}
```

### Pattern de Vérification Scope

Pour les permissions avec scope `own` ou `assigned` :

```typescript
@Patch(':id')
@RequirePermission('event.update')
async update(
  @CurrentUser() user: JwtPayload,
  @Param('id') id: string,
  @Body() dto: UpdateEventDto,
  @Req() req: Request,
) {
  // 1. Charger la ressource
  const event = await this.eventsService.findOne(id);

  if (!event) {
    throw new NotFoundException('Event not found');
  }

  // 2. Injecter le RBAC context (pour que le guard puisse vérifier le scope)
  req['rbacContext'] = {
    resourceOwnerId: event.created_by,
    resourceOrgId: event.org_id,
  };

  // 3. Le guard RequirePermissionGuard va vérifier automatiquement
  //    si le user a le droit selon son scope (own/org/assigned/any)

  return this.eventsService.update(id, dto);
}
```

---

## 🧪 Tests à Adapter

### Tests Unitaires

**Avant ❌**
```typescript
describe('UsersService', () => {
  it('should find all users in org', async () => {
    const users = await service.findAll('org-id');
    expect(users).toHaveLength(5);
  });
});
```

**Après ✅**
```typescript
describe('UsersService', () => {
  beforeEach(async () => {
    // Setup: Créer users avec memberships
    await prisma.user.create({ ... });
    await prisma.orgUser.create({ ... });
    await prisma.tenantUserRole.create({ ... });
  });

  it('should find all users in org', async () => {
    const users = await service.findAll('org-id');
    expect(users).toHaveLength(5);
    expect(users[0].tenantRoles).toBeDefined();
  });
});
```

### Tests E2E

**Avant ❌**
```typescript
it('GET /users should return users of org', () => {
  return request(app.getHttpServer())
    .get('/users')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
});
```

**Après ✅**
```typescript
it('GET /users should return users of current org', async () => {
  // Login pour obtenir JWT avec currentOrgId
  const loginRes = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: 'admin@org1.com', password: 'password' });

  const response = await request(app.getHttpServer())
    .get('/users')
    .set('Authorization', `Bearer ${loginRes.body.access_token}`)
    .expect(200);

  expect(response.body).toHaveLength(3); // 3 users dans org1
  expect(response.body[0].tenantRoles).toBeDefined();
});
```

---

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
- [ ] Créer `assignRoleToUser()`
- [ ] Tests unitaires adaptés
- [ ] Tests E2E adaptés

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
- [ ] **Scopes fonctionnent** : `own` vs `org` vs `any` bien testés
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
