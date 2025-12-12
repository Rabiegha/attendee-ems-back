# RBAC Refactoring Progress - Approche Hybride

**Date de début :** 12 décembre 2025  
**Objectif :** Implémenter RBAC multi-tenant avec Guards séparés, scopes granulaires, et gating modules  
**Approche :** Hybride (80% NestJS classique + 20% DDD léger)  
**Timeline :** 1 semaine pour MVP fonctionnel  
**Stratégie :** Code fonctionnel d'abord, architecture propre et extensible, migration DDD complète reportée en v2

---

## Phase 0 - Architecture & Documentation ✅

- [x] `docs/ARCHITECTURE_RBAC.md` créé (Guards pipeline, PermissionRegistry, Services)
- [x] `docs/PLAN_IMPLEMENTATION_RBAC_AVANCE.md` créé (9 phases détaillées)
- [x] `docs/GETTING_STARTED_RBAC_AVANCE.md` créé (guide step-by-step)
- [x] `docs/DECISION_NO_CASL.md` créé (rationale décision 100% custom)
- [x] `docs/INDEX_RBAC_AVANCE.md` créé (navigation)
- [x] Documentation adaptée pour approche hybride (DDD léger)

**Statut :** ✅ Terminé - Documentation complète et cohérente

---

## 🎯 Approche Hybride : Architecture

### Principes

1. **80% NestJS Classique** (rapide à implémenter)
   - Services avec Prisma direct
   - Controllers classiques
   - Pas d'Aggregates, pas de CQRS complet
   - Pas de Repositories pattern (pour l'instant)

2. **20% DDD Léger** (logique métier isolée)
   - Domain Services pour logique complexe
   - Value Objects pour concepts métier
   - Structure facilitant migration DDD future

### Structure Cible

```
src/
├── modules/                    # NestJS classique
│   ├── rbac/
│   │   ├── rbac.module.ts
│   │   ├── services/
│   │   │   ├── rbac.service.ts           # Service principal (Prisma)
│   │   │   ├── roles.service.ts
│   │   │   └── permissions.service.ts
│   │   ├── controllers/
│   │   │   └── rbac.controller.ts
│   │   └── dto/
│   │
│   └── organizations/
│       ├── organizations.module.ts
│       ├── organizations.service.ts
│       └── organizations.controller.ts
│
├── domain/                     # DDD léger (logique métier)
│   └── rbac/
│       ├── services/           # Domain Services
│       │   ├── authorization.domain-service.ts
│       │   └── role-hierarchy.domain-service.ts
│       │
│       └── value-objects/      # Value Objects
│           ├── scope.vo.ts
│           ├── role-type.vo.ts
│           └── permission-key.vo.ts
│
└── common/
    ├── guards/                 # Pipeline Guards
    │   ├── jwt-auth.guard.ts
    │   ├── tenant-context.guard.ts
    │   └── require-permission.guard.ts
    │
    └── decorators/
        ├── require-permission.decorator.ts
        └── require-module.decorator.ts
```

### Avantages

- ✅ Code fonctionnel rapidement (1 semaine)
- ✅ Logique métier isolée (testable)
- ✅ Migration DDD future facilitée
- ✅ Pas de over-engineering
- ✅ Équipe productive immédiatement

---

## Phase 1 - Modèle de données RBAC (JOUR 1 : 6-8h)

**Objectif :** Mettre les tables et colonnes en place sans casser l'existant + Structure DDD légère

### 1.1 Migrations Prisma

- [ ] Migration `Role` : Ajouter champs avancés
  - [ ] `rank` (Int, nullable pour legacy)
  - [ ] `is_platform` (Boolean, default false)
  - [ ] `is_root` (Boolean, default false)
  - [ ] `role_type` (Enum: tenant_admin, tenant_manager, tenant_staff, support_L1, support_L2, custom)
  - [ ] `is_locked` (Boolean, default false)
  - [ ] `permission_ceiling_scope` (Enum: own, team, org, any)
  - [ ] `managed_by_template` (Boolean, default false)

- [ ] Migration `Permission` : Ajouter champs modules/scopes
  - [ ] `module_key` (String, nullable pour migration progressive)
  - [ ] `allowed_scopes` (Json array: ['own', 'team', 'org', 'any'])
  - [ ] `default_scope_ceiling` (Enum: own, team, org, any)

- [ ] Migration `RolePermission` : Ajouter scope effectif
  - [ ] `scope` (Enum: own, team, org, any, nullable pour legacy)

### 1.2 Indexes & Contraintes

- [ ] Index composite `(user_id, org_id)` sur `UserRole`
- [ ] Index composite `(role_id, org_id)` sur `UserRole`
- [ ] Index composite `(plan_id, module_key)` sur `PlanModule`
- [ ] Index composite `(org_id, module_key)` sur `OrgModuleOverride`
- [ ] FK composite `UserRole(user_id, org_id) → OrgUser(user_id, org_id)` (vérifier)
- [ ] FK composite `UserRole(role_id, org_id) → Role(id, org_id)` (vérifier)

### 1.3 Seeders mis à jour

- [ ] `prisma/seeders/roles.seeder.ts`
  - [ ] Marquer SUPER_ADMIN : `rank=0, is_root=true, role_type=custom, is_locked=true`
  - [ ] Marquer ADMIN : `rank=1, role_type=tenant_admin, is_locked=true, managed_by_template=true`
  - [ ] Marquer MANAGER : `rank=2, role_type=tenant_manager, is_locked=true, managed_by_template=true`
  - [ ] Marquer STAFF : `rank=3, role_type=tenant_staff, is_locked=true, managed_by_template=true`

- [ ] `prisma/seeders/permissions.seeder.ts`
  - [ ] Ajouter `module_key` pour chaque permission
  - [ ] Ajouter `allowed_scopes` par permission
  - [ ] Ajouter `default_scope_ceiling` par permission

### 1.4 Créer structure DDD légère

- [ ] Créer `src/domain/rbac/value-objects/scope.vo.ts`
- [ ] Créer `src/domain/rbac/value-objects/role-type.vo.ts`
- [ ] Créer `src/domain/rbac/value-objects/permission-key.vo.ts`
- [ ] Créer `src/domain/rbac/services/` (vide pour l'instant)

### 1.5 Validation

- [ ] `npm run prisma:migrate:dev` passe sans erreur
- [ ] `npm run seed` remplit tous les nouveaux champs
- [ ] `npm run dev` démarre sans erreur (ancien système fonctionne toujours)
- [ ] Vérifier en BDD : Roles ont bien rank, role_type, is_locked
- [ ] Vérifier en BDD : Permissions ont bien module_key, allowed_scopes
- [ ] Structure `src/domain/rbac/` créée

**Statut :** ⬜ Pas commencé  
**Temps estimé :** 6-8h

---

## Phase 2 - Nouveau cœur d'auth (JOUR 2-3 : 12-14h)

**Objectif :** RbacService (NestJS classique) + Domain Services (DDD léger) + PermissionRegistry (100% custom, NO CASL)

**Architecture :** Hybride
- Services NestJS utilisent Prisma directement
- Logique métier complexe déléguée aux Domain Services
- Facile à migrer vers full DDD plus tard

### 2.1 Types partagés

- [ ] Créer `src/rbac/rbac.types.ts`
  - [ ] `export type Scope = 'own' | 'team' | 'org' | 'any'`
  - [ ] `export type RoleType = 'tenant_admin' | 'tenant_manager' | 'tenant_staff' | 'support_L1' | 'support_L2' | 'custom'`
  - [ ] `export const SCOPE_ORDER: Scope[] = ['own', 'team', 'org', 'any']`
  - [ ] Interface `RbacContext` (resourceTenantId, actorTenantId, resourceOwnerId, actorUserId, resourceTeamId, actorTeamIds)
  - [ ] Interface `PermissionDefinition` (module, allowedScopes, defaultScopeCeiling, defaultScopesByRoleType)

### 2.2 Domain Services (DDD léger)

- [ ] Créer `src/domain/rbac/services/authorization.domain-service.ts`
  - [ ] `can(user, permissionKey, context: RbacContext): boolean`
  - [ ] `scopeCovers(scopeLimit: Scope, context: RbacContext): boolean`
  - [ ] Logique pure, 0 dépendances Prisma
  - [ ] Tests unitaires faciles

- [ ] Créer `src/domain/rbac/services/role-hierarchy.domain-service.ts`
  - [ ] `canAssign(actorRole, targetRole): boolean`
  - [ ] `canModifyRole(actor, targetRole): boolean`
  - [ ] Anti-escalade (rank hierarchy)
  - [ ] Tests unitaires

### 2.3 PermissionRegistry

- [ ] Créer `src/rbac/permission-registry.ts`
  - [ ] Définir structure `PERMISSION_REGISTRY: Record<string, PermissionDefinition>`
  - [ ] Ajouter permissions **Events** (event.read, event.create, event.update, event.delete)
  - [ ] Ajouter permissions **Attendees** (attendee.read, attendee.create, attendee.update, attendee.delete, attendee.import, attendee.export)
  - [ ] Ajouter permissions **Badges** (badge.read, badge.create, badge.print, badge.scan)
  - [ ] Ajouter permissions **Users** (user.read, user.create, user.update, user.delete)
  - [ ] Ajouter permissions **Roles** (role.read, role.create, role.update, role.delete, role.assign)
  - [ ] Ajouter permissions **Organizations** (org.read, org.create, org.update, org.delete)
  - [ ] Ajouter toutes les 315+ permissions (itératif)

### 2.3 ModulesService

- [ ] Créer `src/rbac/modules.service.ts`
  - [ ] `async isModuleEnabledForTenant(tenantId: string, moduleKey: string): Promise<boolean>`
    - [ ] Lire `Organization.plan_id`
    - [ ] Lire `PlanModule` pour ce plan
    - [ ] Vérifier `OrgModuleOverride` (force_enabled/force_disabled)
    - [ ] Retourner boolean

### 2.5 RbacService (NestJS classique + Domain Services)

- [ ] Créer `src/modules/rbac/services/rbac.service.ts`
  - [ ] Injecter `PrismaService` + `ModulesService` + `AuthorizationDomainService` + `RoleHierarchyDomainService`
  - [ ] `async getBestScopeForPermission(user, permissionKey, orgId): Promise<Scope | null>`
    - [ ] Lire `UserRole` pour cet user + org
    - [ ] Lire `Role` pour chaque role
    - [ ] Lire `RolePermission` pour chaque role + permission
    - [ ] Retourner le scope le plus large (any > org > team > own)
  - [ ] `async can(user, permissionKey, context: RbacContext): Promise<boolean>`
    - [ ] Si `user.is_root === true` → return true (bypass)
    - [ ] Récupérer données utilisateur depuis Prisma (roles, permissions)
    - [ ] Extraire `moduleKey` de la permission (via PermissionRegistry)
    - [ ] Appeler `modulesService.isModuleEnabledForTenant(context.resourceTenantId, moduleKey)`
    - [ ] Si module désactivé → throw ForbiddenException
    - [ ] Appeler `getBestScopeForPermission(user, permissionKey, context.actorTenantId)`
    - [ ] Si aucun scope → throw ForbiddenException
    - [ ] **Déléguer la logique d'autorisation au Domain Service** : `authorizationDomainService.can(user, bestScope, context)`
    - [ ] Return résultat

### 2.6 Tests unitaires

- [ ] Créer `src/domain/rbac/services/authorization.domain-service.spec.ts`
  - [ ] Test : scope 'own' + resourceOwnerId === actorUserId → true
  - [ ] Test : scope 'team' + resourceTeamId in actorTeamIds → true
  - [ ] Test : scope 'org' + resourceTenantId === actorTenantId → true
  - [ ] Test : scope 'any' → true
  - [ ] Test : scope insuffisant → false

- [ ] Créer `src/domain/rbac/services/role-hierarchy.domain-service.spec.ts`
  - [ ] Test : rank inférieur ne peut pas assigner rank supérieur
  - [ ] Test : is_root peut tout assigner
  - [ ] Test : is_locked ne peut pas être modifié

- [ ] Créer `src/modules/rbac/services/rbac.service.spec.ts` (tests d'intégration)
  - [ ] Test : `is_root` user → can() retourne true pour tout
  - [ ] Test : Admin (scope any) → peut lire/modifier tout dans son org
  - [ ] Test : Manager (scope org) → peut lire/modifier dans son org, pas d'autre org
  - [ ] Test : Staff (scope team) → peut lire/modifier que sa team
  - [ ] Test : User custom (scope own) → peut lire/modifier que ses propres ressources
  - [ ] Test : Module désactivé → can() refuse même avec permission

**Statut :** ⬜ Pas commencé  
**Temps estimé :** 12-14h (Jour 2-3)

---

## Phase 3 - Guards + Décorateurs (JOUR 4 : 6-8h)

**Objectif :** Créer Guards et Décorateurs pour protéger les routes

### 3.1 Créer les Guards

- [ ] Créer `src/common/guards/tenant-context.guard.ts` (renommer/améliorer `OrgScopeGuard`)
  - [ ] Valider appartenance org via `OrgUser`
  - [ ] Set `req.user.currentOrgId`

- [ ] Créer `src/common/guards/module-gating.guard.ts`
  - [ ] Extraire `moduleKey` du décorateur `@RequireModule()`
  - [ ] Appeler `modulesService.isModuleEnabledForTenant()`
  - [ ] Refuser si module désactivé

- [ ] Créer `src/common/guards/require-permission.guard.ts` (remplace `PermissionsGuard`)
  - [ ] Lire `@RequirePermission()` metadata
  - [ ] Construire `RbacContext` depuis la requête
  - [ ] Appeler `rbacService.can()`
  - [ ] Refuser si can() === false

### 3.2 Créer les Décorateurs

- [ ] Créer `src/common/decorators/require-permission.decorator.ts`
  - [ ] `@RequirePermission(key: string, options?: { scope?, resourceIdParam?, checkOwnership?, allowPlatform? })`

- [ ] Créer `src/common/decorators/require-module.decorator.ts`
  - [ ] `@RequireModule(moduleKey: string)`

- [ ] Créer `src/common/decorators/scope-context.decorator.ts`
  - [ ] `@RbacContext(builder: (req, params) => RbacContext)`

### 3.3 Tests Guards

- [ ] Créer `src/common/guards/require-permission.guard.spec.ts`
  - [ ] Test : Permission accordée → accès autorisé
  - [ ] Test : Permission refusée → 403
  - [ ] Test : Module désactivé → 403
  - [ ] Test : Scope insuffisant → 403

**Statut :** ⬜ Pas commencé  
**Temps estimé :** 6-8h (Jour 4)

---

## Phase 4 - Controllers RBAC + Organizations (JOUR 5 : 6-8h)

**Objectif :** Créer les controllers pour gérer les rôles et les organisations

### 4.1 RbacController

- [ ] Créer `src/modules/rbac/controllers/rbac.controller.ts`
  - [ ] `POST /api/rbac/roles` - Créer un rôle
  - [ ] `GET /api/rbac/roles` - Lister les rôles
  - [ ] `POST /api/rbac/roles/:roleId/permissions` - Assigner une permission à un rôle
  - [ ] `POST /api/rbac/users/:userId/roles` - Assigner un rôle à un utilisateur
  - [ ] `GET /api/rbac/users/:userId/permissions` - Lister les permissions d'un utilisateur
  - [ ] Utiliser `@RequirePermission()` pour protéger les routes

### 4.2 OrganizationsController

- [ ] Créer `src/modules/organizations/controllers/organizations.controller.ts`
  - [ ] `POST /api/organizations` - Créer une organisation
  - [ ] `GET /api/organizations` - Lister les organisations
  - [ ] `POST /api/organizations/:orgId/members` - Ajouter un membre à une org
  - [ ] `GET /api/users/me/organizations` - Lister les orgs de l'utilisateur connecté
  - [ ] Utiliser `@RequirePermission()` pour protéger les routes

### 4.3 Services correspondants

- [ ] Créer `src/modules/rbac/services/roles.service.ts`
  - [ ] Logique création/lecture rôles
  - [ ] Utiliser `RoleHierarchyDomainService` pour validation anti-escalade

- [ ] Créer `src/modules/organizations/services/organizations.service.ts`
  - [ ] Logique création org
  - [ ] Logique ajout membres

### 4.4 Tests

- [ ] Tests E2E : Créer org → créer rôle → assigner rôle → vérifier permissions

**Statut :** ⬜ Pas commencé  
**Temps estimé :** 6-8h (Jour 5)

---

## Phase 5 - Multi-tenant basique (JOUR 6 : 6-8h)

**Objectif :** User global dans plusieurs orgs avec rôles différents (version simplifiée, sans breaking changes)

### 5.1 Système Context Switching

- [ ] Ajouter `currentOrgId` dans le JWT payload
- [ ] Créer endpoint `POST /api/auth/switch-org` pour changer d'org active
- [ ] Modifier `JwtAuthGuard` pour extraire `currentOrgId`
- [ ] **Garder `User.org_id` pour compatibilité** (pas de breaking change)
- [ ] Migration complète reportée en v2

### 5.2 TenantContextGuard amélioré

- [ ] Améliorer `src/common/guards/tenant-context.guard.ts`
  - [ ] Extraire `currentOrgId` du JWT
  - [ ] Vérifier appartenance via `OrgUser`
  - [ ] Set `req.user.currentOrgId`
  - [ ] Refuser si user n'appartient pas à l'org

### 5.3 API multi-org basique

- [ ] `GET /api/users/me/organizations` - Lister les orgs de l'utilisateur
- [ ] `POST /api/auth/switch-org` - Changer d'org active (génère nouveau JWT)

### 5.4 Tests

- [ ] User dans 2 orgs → switch org → vérifier `currentOrgId` change
- [ ] Vérifier isolation : user ne peut pas accéder aux ressources d'autres orgs

**Statut :** ⬜ Pas commencé  
**Temps estimé :** 6-8h (Jour 6)

---

## Phase 6 - Seed Data + Tests E2E (JOUR 7 : 6-8h)

**Objectif :** Créer données de test et valider le système complet

### 6.1 Script Seed complet

- [ ] Créer `prisma/seeds/rbac-complete-seed.ts`
  - [ ] Créer 2 organisations de test
  - [ ] Créer rôles standards (Admin, Manager, Staff) pour chaque org
  - [ ] Créer users de test avec rôles différents
  - [ ] Assigner permissions selon `PermissionRegistry`
  - [ ] Créer données de test (events, attendees)

### 6.2 Tests E2E

- [ ] Flow complet : Login → Créer event → Vérifier RBAC
- [ ] Test Admin : peut tout faire
- [ ] Test Manager : limité à son org
- [ ] Test Staff : limité à sa team
- [ ] Test multi-org : switch org → vérifier permissions changent

### 6.3 Documentation

- [ ] Créer `docs/rbac/QUICK_START.md`
  - [ ] Comment lancer l'app
  - [ ] Comment tester RBAC
  - [ ] Exemples de requêtes

**Statut :** ⬜ Pas commencé  
**Temps estimé :** 6-8h (Jour 7)

---

## Phase 7+ - Améliorations futures (v2)

**Reporté après la semaine 1. Ces features seront implémentées progressivement.**

### 7.1 Migration DDD complète

- [ ] Créer Aggregates (Role, UserAuthorization, Organization)
- [ ] Créer Repositories pattern
- [ ] Implémenter CQRS (Commands/Queries/Handlers)
- [ ] Domain Events
- [ ] Migration progressive module par module

### 7.2 Plans & Modules (Gating avancé)

- [ ] Créer Plans (Free, Pro, Enterprise)
- [ ] Créer Modules (events, attendees, badges, analytics)
- [ ] ModuleGatingGuard fonctionnel
- [ ] API back-office pour gérer plans/modules

### 7.3 Propagation permissions

- [ ] Script sync permissions automatique
- [ ] Hook création org → créer rôles clés auto
- [ ] Gestion `managed_by_template`

### 7.4 UI Frontend

- [ ] Service ability front
- [ ] Endpoint `GET /api/me/permissions`
- [ ] Migrer UI Events pour utiliser `can()`
- [ ] Gestion 403

### 7.5 Migration controllers existants

- [ ] Migrer EventsController vers `@RequirePermission()`
- [ ] Migrer AttendeesController
- [ ] Migrer RegistrationsController
- [ ] Supprimer ancien `PermissionsGuard`

**Statut :** ⬜ Reporté en v2

---

## Problèmes rencontrés

_Aucun pour l'instant_

---

## Décisions importantes

### ✅ Architecture Guards séparés
- **Date :** 11 décembre 2025
- **Décision :** Guards séparés (JwtAuth → TenantContext → ModuleGating → RequirePermission)
- **Rationale :** 1 guard = 1 responsabilité, composable, testable

### ✅ NO CASL
- **Date :** 11 décembre 2025
- **Décision :** 100% custom RbacService, pas de CASL
- **Rationale :** CASL limité au binaire, pas de scopes granulaires, bugs existants
- **Référence :** `docs/DECISION_NO_CASL.md`

### ✅ Guards globaux
- **Date :** 12 décembre 2025
- **Décision :** Possibilité de mettre JwtAuth/TenantContext/ModuleGating en global (main.ts)
- **Rationale :** Éviter duplication, `@RequirePermission()` reste par route

---

## Notes de migration

- **JWT taille :** Stocker uniquement permissions de l'org active (pas toutes les orgs)
- **Performance :** Indexes composites sur (user_id, org_id), (role_id, org_id)
- **Cache :** Redis pour `getEffectivePermissions(userId, orgId)`, TTL 5-15 min
- **Tests :** Créer helpers `createUserInOrg(orgId, roleType)` pour tests

---

## Ressources

- **Docs principales :**
  - `docs/ARCHITECTURE_RBAC.md`
  - `docs/PLAN_IMPLEMENTATION_RBAC_AVANCE.md`
  - `docs/GETTING_STARTED_RBAC_AVANCE.md`
  - `docs/DECISION_NO_CASL.md`

- **Code à étudier :**
  - `prisma/schema.prisma` (tables RBAC complètes)
  - `src/common/guards/permissions.guard.ts` (ancien système)
  - `src/common/guards/tenant-context.guard.ts` (base multi-tenant)

---

**Dernière mise à jour :** 12 décembre 2025
