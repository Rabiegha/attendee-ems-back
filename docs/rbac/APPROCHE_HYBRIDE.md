# Approche Hybride : RBAC + Multi-tenant en 1 semaine

**Date :** 12 décembre 2025  
**Objectif :** MVP RBAC + Multi-tenant fonctionnel en 1 semaine  
**Stratégie :** 80% NestJS classique + 20% DDD léger  

---

## 🎯 Philosophie

### Principe central

**Code fonctionnel d'abord, architecture propre et extensible, migration DDD complète reportée en v2**

Nous adoptons une approche pragmatique qui combine :
- La rapidité de développement de NestJS classique
- Les bénéfices de DDD pour la logique métier complexe
- Une structure facilitant la migration future vers full DDD

---

## 📐 Architecture Hybride

### 80% NestJS Classique

```typescript
// Services classiques avec Prisma
@Injectable()
export class RbacService {
  constructor(
    private prisma: PrismaService,
    private authorizationService: AuthorizationDomainService, // ← DDD
  ) {}

  async assignRole(userId: string, roleId: string, orgId: string, assignedBy: User) {
    // 1. Récupérer données (Prisma direct)
    const actorRole = await this.prisma.role.findFirst({
      where: { userRoles: { some: { userId: assignedBy.id, orgId } } }
    });
    
    const targetRole = await this.prisma.role.findUnique({
      where: { id: roleId }
    });

    // 2. Valider avec Domain Service (logique métier pure)
    if (!this.roleHierarchyService.canAssign(actorRole, targetRole)) {
      throw new ForbiddenException('Cannot assign higher rank role');
    }

    // 3. Sauvegarder (Prisma direct)
    return this.prisma.userRole.create({
      data: { userId, roleId, orgId }
    });
  }
}
```

**Avantages** :
- ✅ Rapide à coder
- ✅ Prisma directement accessible
- ✅ Pas de boilerplate
- ✅ Équipe productive immédiatement

---

### 20% DDD Léger

#### Domain Services (logique métier pure)

```typescript
// domain/rbac/services/authorization.domain-service.ts
@Injectable()
export class AuthorizationDomainService {
  can(
    user: UserContext,
    bestScope: Scope,
    context: RbacContext
  ): boolean {
    // Logique pure, 0 dépendances
    switch (bestScope) {
      case 'own':
        return context.resourceOwnerId === context.actorUserId;
      
      case 'team':
        return context.resourceTeamIds?.some(
          id => context.actorTeamIds?.includes(id)
        );
      
      case 'org':
        return context.resourceTenantId === context.actorTenantId;
      
      case 'any':
        return true;
      
      default:
        return false;
    }
  }
}
```

**Avantages** :
- ✅ Logique testable sans mock Prisma
- ✅ Réutilisable partout
- ✅ Facile à migrer vers Aggregates plus tard

#### Value Objects (concepts métier)

```typescript
// domain/rbac/value-objects/scope.vo.ts
export class Scope {
  private static readonly ORDER = ['own', 'assigned', 'team', 'any'];

  constructor(private readonly value: string) {
    if (!Scope.ORDER.includes(value)) {
      throw new DomainException(`Invalid scope: ${value}`);
    }
  }

  covers(other: Scope): boolean {
    const thisIndex = Scope.ORDER.indexOf(this.value);
    const otherIndex = Scope.ORDER.indexOf(other.value);
    return thisIndex >= otherIndex;
  }

  getValue(): string {
    return this.value;
  }
}
```

**Avantages** :
- ✅ Validation encapsulée
- ✅ Logique métier dans l'objet
- ✅ Facilite compréhension du domaine

---

## 📂 Structure Cible

```
src/
├── modules/                          # NestJS classique (80%)
│   ├── rbac/
│   │   ├── rbac.module.ts
│   │   ├── services/
│   │   │   ├── rbac.service.ts                  # Service principal
│   │   │   ├── roles.service.ts
│   │   │   └── permissions.service.ts
│   │   ├── controllers/
│   │   │   └── rbac.controller.ts
│   │   └── dto/
│   │       ├── create-role.dto.ts
│   │       └── assign-role.dto.ts
│   │
│   └── organizations/
│       ├── organizations.module.ts
│       ├── services/
│       │   └── organizations.service.ts
│       ├── controllers/
│       │   └── organizations.controller.ts
│       └── dto/
│
├── domain/                           # DDD léger (20%)
│   └── rbac/
│       ├── services/                 # Domain Services
│       │   ├── authorization.domain-service.ts
│       │   └── role-hierarchy.domain-service.ts
│       │
│       └── value-objects/            # Value Objects
│           ├── scope.vo.ts
│           ├── role-type.vo.ts
│           └── permission-key.vo.ts
│
├── common/
│   ├── guards/                       # Pipeline Guards
│   │   ├── jwt-auth.guard.ts
│   │   ├── tenant-context.guard.ts
│   │   └── require-permission.guard.ts
│   │
│   └── decorators/
│       ├── require-permission.decorator.ts
│       └── require-module.decorator.ts
│
└── rbac/                             # Configuration globale
    ├── permission-registry.ts        # Source de vérité permissions
    └── modules.service.ts            # Gating modules
```

---

## 🚀 Migration Future vers Full DDD

### Ce qui est facile à migrer

```typescript
// AVANT (Semaine 1 - Hybride)
class RbacService {
  async assignRole(userId, roleId, orgId, assignedBy) {
    const actorRole = await this.prisma.role.findFirst(...);
    const targetRole = await this.prisma.role.findUnique(...);
    
    // ✅ Logique déjà dans Domain Service
    if (!this.roleHierarchyService.canAssign(actorRole, targetRole)) {
      throw new ForbiddenException();
    }
    
    return this.prisma.userRole.create(...);
  }
}

// APRÈS (Migration DDD complète - v2)
class AssignRoleHandler {
  async execute(command: AssignRoleCommand) {
    // 1. Récupérer Aggregates via Repository
    const actorRole = await this.roleRepo.findById(command.actorRoleId);
    const targetRole = await this.roleRepo.findById(command.targetRoleId);
    
    // 2. ✅ Même logique métier (déjà testée !)
    if (!actorRole.canAssign(targetRole)) {
      throw new DomainException();
    }
    
    // 3. Sauvegarder via Repository
    await this.roleRepo.save(targetRole);
  }
}
```

**La logique métier ne change pas, seulement la plomberie !**

---

## 📊 Comparaison des approches

| Aspect                          | Full DDD (2-3 semaines)  | Approche Hybride (1 semaine) | NestJS pur (1 semaine)    |
|---------------------------------|--------------------------|------------------------------|---------------------------|
| **Temps dev**                   | 2-3 semaines             | 1 semaine                    | 1 semaine                 |
| **Logique métier isolée**       | ✅ Oui                   | ✅ Oui (Domain Services)      | ❌ Non (dans services)    |
| **Testabilité**                 | ✅ Excellente            | ✅ Bonne                      | ⚠️ Moyenne (mock Prisma)  |
| **Courbe apprentissage**        | ⚠️ Élevée                | ✅ Faible                     | ✅ Faible                 |
| **Migration future**            | N/A | ✅ Facile          | ❌ Difficile                  |                           |
| **Boilerplate**                 | ⚠️ Beaucoup              | ✅ Minimal                    | ✅ Minimal                |
| **Maintenabilité long terme**   | ✅ Excellente            | ✅ Bonne                      | ⚠️ Moyenne                |

---

## ✅ Ce qu'on FAIT cette semaine

### Jour 1 : Fondations (6-8h)
- ✅ Migrations Prisma (rank, role_type, etc.)
- ✅ Seeders mis à jour
- ✅ Structure `src/domain/rbac/` créée
- ✅ Value Objects de base

### Jour 2-3 : RBAC Core (12-14h)
- ✅ Domain Services (Authorization, RoleHierarchy)
- ✅ PermissionRegistry
- ✅ RbacService (NestJS + Domain Services)
- ✅ ModulesService
- ✅ Tests unitaires Domain Services

### Jour 4 : Guards (6-8h)
- ✅ TenantContextGuard
- ✅ RequirePermissionGuard
- ✅ Décorateurs (@RequirePermission, @RequireModule)
- ✅ Tests Guards

### Jour 5 : Controllers (6-8h)
- ✅ RbacController (CRUD roles/permissions)
- ✅ OrganizationsController
- ✅ Services correspondants
- ✅ Tests E2E basiques

### Jour 6 : Multi-tenant (6-8h)
- ✅ Context switching (currentOrgId dans JWT)
- ✅ TenantContextGuard amélioré
- ✅ API multi-org (`/users/me/organizations`, `/auth/switch-org`)
- ✅ Tests isolation tenant

### Jour 7 : Polish (6-8h)
- ✅ Seed data complet
- ✅ Tests E2E flow complet
- ✅ Documentation QUICK_START.md
- ✅ Cleanup code

---

## ❌ Ce qu'on REPORTE en v2

### Features reportées

- ❌ Aggregates (Role, UserAuthorization, Organization)
- ❌ Repositories pattern complet
- ❌ CQRS (Commands/Queries/Handlers)
- ❌ Domain Events avec handlers
- ❌ Plans/Modules (gating avancé)
- ❌ Propagation auto permissions
- ❌ Migration controllers existants (Events, Attendees)
- ❌ UI Frontend (ability service)

### Pourquoi reporter ?

1. **Fonctionnalité d'abord** : RBAC doit marcher à 100%
2. **Pas de over-engineering** : Code qui marche > architecture parfaite
3. **Apprentissage progressif** : Équipe monte en compétence graduellement
4. **Feedback early** : Tester le système avant d'aller plus loin

---

## 🎯 Résultat après 1 semaine

### Ce qui fonctionne à 100%

```bash
# ✅ Gestion des rôles
POST /api/rbac/roles
GET /api/rbac/roles
POST /api/rbac/roles/:id/permissions
DELETE /api/rbac/roles/:id

# ✅ Gestion des assignations
POST /api/rbac/users/:userId/roles
GET /api/rbac/users/:userId/permissions
DELETE /api/rbac/users/:userId/roles/:roleId

# ✅ Multi-tenant
POST /api/organizations
POST /api/organizations/:id/members
GET /api/users/me/organizations
POST /api/auth/switch-org

# ✅ Protection routes (exemple)
GET /api/events
  → JwtAuthGuard
  → TenantContextGuard
  → RequirePermissionGuard
  → Vérifie RBAC + scope automatiquement
```

### Features RBAC complètes

- ✅ Hiérarchie (rank)
- ✅ Anti-escalade (user ne peut pas assigner rank supérieur)
- ✅ Scopes (own, assigned, team, any)
- ✅ Multi-tenant (user dans plusieurs orgs)
- ✅ Rôles différents par org
- ✅ Isolation des données par org
- ✅ Context switching (changer d'org active)

### Architecture

- ✅ Structure propre et extensible
- ✅ Logique métier isolée (testable)
- ✅ Guards composables
- ✅ Migration DDD future facilitée
- ✅ 0 breaking changes sur code existant

---

## 🧪 Tests

### Tests unitaires (Domain Services)

```typescript
describe('AuthorizationDomainService', () => {
  it('should allow access with scope "own" when user is owner', () => {
    const service = new AuthorizationDomainService();
    const context = {
      resourceOwnerId: 'user123',
      actorUserId: 'user123',
    };
    
    expect(service.can(user, 'own', context)).toBe(true);
  });

  it('should deny access with scope "own" when user is not owner', () => {
    const service = new AuthorizationDomainService();
    const context = {
      resourceOwnerId: 'user456',
      actorUserId: 'user123',
    };
    
    expect(service.can(user, 'own', context)).toBe(false);
  });
});
```

**Avantage** : Tests purs, 0 mock, rapides

### Tests d'intégration (Services)

```typescript
describe('RbacService', () => {
  it('should assign role with proper authorization', async () => {
    // Setup
    const admin = await createUser({ roleType: 'tenant_admin', rank: 100 });
    const manager = await createUser({ roleType: 'tenant_manager', rank: 50 });
    
    // Act
    await rbacService.assignRole(manager.id, managerRole.id, org.id, admin);
    
    // Assert
    const userRoles = await prisma.userRole.findMany({
      where: { userId: manager.id }
    });
    expect(userRoles).toHaveLength(1);
  });
});
```

### Tests E2E (Flow complet)

```typescript
describe('RBAC E2E', () => {
  it('should enforce RBAC on protected routes', async () => {
    // 1. Login as Manager
    const { token } = await login('manager@test.com');
    
    // 2. Try to access events (should work)
    const response = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    
    // 3. Try to delete event (should fail - needs Admin)
    const deleteResponse = await request(app)
      .delete('/api/events/123')
      .set('Authorization', `Bearer ${token}`);
    
    expect(deleteResponse.status).toBe(403);
  });
});
```

---

## 📚 Documentation

### Documentation créée

- ✅ `ARCHITECTURE_RBAC.md` - Architecture complète
- ✅ `APPROCHE_HYBRIDE.md` - Ce document
- ✅ `PROGRESS.md` - Suivi jour par jour
- ✅ `QUICK_START.md` - Guide démarrage rapide (Jour 7)

### Exemples de code

Tous les fichiers clés contiennent :
- JSDoc complète
- Exemples d'utilisation
- Cas d'erreur
- Tests

---

## 🔄 Plan de migration v2 (après la semaine 1)

### Phase 1 : Aggregates (1 semaine)
- Créer Role Aggregate
- Créer UserAuthorization Aggregate
- Créer Organization Aggregate
- Migrer logique métier des Services vers Aggregates

### Phase 2 : Repositories (1 semaine)
- Créer Repository interfaces
- Implémenter Prisma Repositories
- Créer Mappers (Prisma ↔ Domain)
- Remplacer Prisma direct par Repositories

### Phase 3 : CQRS (1 semaine)
- Créer Commands/Queries
- Créer Handlers
- Migrer Controllers pour utiliser CQRS
- Domain Events

### Phase 4 : Features avancées (1-2 semaines)
- Plans/Modules
- Propagation permissions
- Migration controllers existants

**Total migration v2 : 4-5 semaines** (au lieu de refaire tout depuis zéro)

---

## 💡 Lessons Learned

### Ce qui marche bien

1. **Domain Services** : Excellente isolation de la logique métier
2. **Value Objects** : Validation + logique encapsulées
3. **Hybrid approach** : Productivité + qualité
4. **Tests unitaires** : Faciles sans mock Prisma

### Ce qu'on améliorerait

1. **Plus de Value Objects** : RoleId, UserId, OrgId (v2)
2. **Event Sourcing** : Pour audit trail (v2)
3. **Cache** : Redis pour permissions (v2)

---

## ✅ Checklist Go Live

Avant de déployer en prod :

- [ ] Tous les tests passent
- [ ] Documentation à jour
- [ ] Seed data en place
- [ ] Tests E2E validés
- [ ] Performance OK (< 100ms pour `can()`)
- [ ] Logs en place
- [ ] Monitoring configuré
- [ ] Rollback plan prêt

---

**Dernière mise à jour :** 12 décembre 2025
