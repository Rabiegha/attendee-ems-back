# RBAC Refactoring Progress

**Date de début :** 12 décembre 2025  
**Objectif :** Implémenter RBAC multi-tenant avec Guards séparés, scopes granulaires, et gating modules

---

## Phase 0 - Architecture & Documentation ✅

- [x] `docs/ARCHITECTURE_RBAC.md` créé (Guards pipeline, PermissionRegistry, Services)
- [x] `docs/PLAN_IMPLEMENTATION_RBAC_AVANCE.md` créé (9 phases détaillées)
- [x] `docs/GETTING_STARTED_RBAC_AVANCE.md` créé (guide step-by-step)
- [x] `docs/DECISION_NO_CASL.md` créé (rationale décision 100% custom)
- [x] `docs/INDEX_RBAC_AVANCE.md` créé (navigation)

**Statut :** ✅ Terminé - Documentation complète et cohérente

---

## Phase 1 - Modèle de données RBAC (3-5 jours)

**Objectif :** Mettre les tables et colonnes en place sans casser l'existant

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

### 1.4 Validation

- [ ] `npm run prisma:migrate:dev` passe sans erreur
- [ ] `npm run seed` remplit tous les nouveaux champs
- [ ] `npm run dev` démarre sans erreur (ancien système fonctionne toujours)
- [ ] Vérifier en BDD : Roles ont bien rank, role_type, is_locked
- [ ] Vérifier en BDD : Permissions ont bien module_key, allowed_scopes

**Statut :** ⬜ Pas commencé

---

## Phase 2 - Nouveau cœur d'auth (5-7 jours)

**Objectif :** RbacService + ModulesService + PermissionRegistry (100% custom, NO CASL)

### 2.1 Types partagés

- [ ] Créer `src/rbac/rbac.types.ts`
  - [ ] `export type Scope = 'own' | 'team' | 'org' | 'any'`
  - [ ] `export type RoleType = 'tenant_admin' | 'tenant_manager' | 'tenant_staff' | 'support_L1' | 'support_L2' | 'custom'`
  - [ ] `export const SCOPE_ORDER: Scope[] = ['own', 'team', 'org', 'any']`
  - [ ] Interface `RbacContext` (resourceTenantId, actorTenantId, resourceOwnerId, actorUserId, resourceTeamId, actorTeamIds)
  - [ ] Interface `PermissionDefinition` (module, allowedScopes, defaultScopeCeiling, defaultScopesByRoleType)

### 2.2 PermissionRegistry

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

### 2.4 RbacService

- [ ] Créer `src/rbac/rbac.service.ts`
  - [ ] Injecter `PrismaService` + `ModulesService` (NO CaslAbilityFactory)
  - [ ] `private scopeCovers(scopeLimit: Scope, context: RbacContext): boolean`
    - [ ] Logique : own (actorUserId === resourceOwnerId)
    - [ ] Logique : team (actorTeamIds.includes(resourceTeamId))
    - [ ] Logique : org (actorTenantId === resourceTenantId)
    - [ ] Logique : any (toujours true si scope >= org)
  - [ ] `async getBestScopeForPermission(user, permissionKey, orgId): Promise<Scope | null>`
    - [ ] Lire `UserRole` pour cet user + org
    - [ ] Lire `Role` pour chaque role
    - [ ] Lire `RolePermission` pour chaque role + permission
    - [ ] Retourner le scope le plus large (any > org > team > own)
  - [ ] `async can(user, permissionKey, context: RbacContext): Promise<boolean>`
    - [ ] Si `user.is_root === true` → return true
    - [ ] Extraire `moduleKey` de la permission (via PermissionRegistry)
    - [ ] Appeler `isModuleEnabledForTenant(context.resourceTenantId, moduleKey)`
    - [ ] Si module désactivé → throw ForbiddenException
    - [ ] Appeler `getBestScopeForPermission(user, permissionKey, context.actorTenantId)`
    - [ ] Si aucun scope → throw ForbiddenException
    - [ ] Appeler `scopeCovers(bestScope, context)`
    - [ ] Si scope insuffisant → throw ForbiddenException
    - [ ] Return true

### 2.5 Tests unitaires

- [ ] Créer `src/rbac/rbac.service.spec.ts`
  - [ ] Test : `is_root` user → can() retourne true pour tout
  - [ ] Test : Admin (scope any) → peut lire/modifier tout dans son org
  - [ ] Test : Manager (scope org) → peut lire/modifier dans son org, pas d'autre org
  - [ ] Test : Staff (scope team) → peut lire/modifier que sa team
  - [ ] Test : User custom (scope own) → peut lire/modifier que ses propres ressources
  - [ ] Test : Module désactivé → can() refuse même avec permission

**Statut :** ⬜ Pas commencé

---

## Phase 3 - Module pilote : Events (3-4 jours)

**Objectif :** Migrer `EventsController` pour utiliser le nouveau système (proof of concept)

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

### 3.3 Migrer EventsController

- [ ] `src/modules/events/events.controller.ts`
  - [ ] Remplacer `@UseGuards(JwtAuthGuard, OrgScopeGuard, PermissionsGuard)` par `@UseGuards(JwtAuthGuard, TenantContextGuard, ModuleGatingGuard)`
  - [ ] Remplacer `@Permissions('events.read')` par `@RequirePermission('event.read')`
  - [ ] Remplacer `@Permissions('events.create')` par `@RequirePermission('event.create')`
  - [ ] Remplacer `@Permissions('events.update')` par `@RequirePermission('event.update', { resourceIdParam: 'id', checkOwnership: true })`
  - [ ] Remplacer `@Permissions('events.delete')` par `@RequirePermission('event.delete', { scope: 'any' })`
  - [ ] Supprimer tous les checks manuels `if (user.role === 'SUPER_ADMIN')`, `const allowAny = ...`

### 3.4 Tests fonctionnels

- [ ] Tester avec user Admin (scope any) → peut tout lire/modifier
- [ ] Tester avec user Manager (scope org) → peut lire/modifier events de son org
- [ ] Tester avec user Staff (scope team) → peut lire/modifier events de sa team
- [ ] Tester avec user custom (scope own) → peut lire/modifier que ses events
- [ ] Tester avec module désactivé → 403 Forbidden

**Statut :** ⬜ Pas commencé

---

## Phase 4 - Rôles clés + Propagation (4-5 jours)

**Objectif :** Script sync permissions + seeder auto pour nouvelle org

### 4.1 Script sync permissions

- [ ] Créer `scripts/sync-permissions.ts`
  - [ ] Lire `PERMISSION_REGISTRY`
  - [ ] Upsert permissions dans table `Permission`
  - [ ] Pour chaque org existante :
    - [ ] Créer rôles clés si absents (Admin, Manager, Staff)
    - [ ] Assigner `role_permissions` selon `defaultScopesByRoleType`
  - [ ] Commande : `npm run permissions:sync`

### 4.2 Hook nouvelle org

- [ ] Modifier `src/modules/organizations/organizations.service.ts`
  - [ ] Après création org → appeler `syncPermissionsForOrg(orgId)`
  - [ ] Créer Admin/Manager/Staff avec permissions correctes

### 4.3 Validation

- [ ] Créer une nouvelle org → vérifier rôles clés créés auto
- [ ] Lancer `npm run permissions:sync` → vérifier aucune régression
- [ ] Vérifier rôles clés marqués `is_locked = true`

**Statut :** ⬜ Pas commencé

---

## Phase 5 - Multi-org réel (10-15 jours) ⚠️ BREAKING

**Objectif :** User global dans plusieurs orgs avec rôles différents

### 5.1 Migration User model

- [ ] Créer migration Prisma : Supprimer `User.org_id` et `User.role_id`
- [ ] Créer getter temporaire `User.org_id` → retourne `orgUsers[0].org_id` (compatibilité)
- [ ] Créer getter temporaire `User.role_id` → retourne `userRoles[0].role_id` (compatibilité)

### 5.2 AuthService

- [ ] Modifier `src/modules/auth/auth.service.ts`
  - [ ] Au login : lister orgs via `OrgUser`
  - [ ] Stocker `currentOrgId` dans JWT
  - [ ] Créer endpoint `POST /auth/switch-org` pour changer d'org active

### 5.3 Adapter tous les services

- [ ] `src/modules/users/users.service.ts` : Remplacer `user.org_id` par `user.currentOrgId`
- [ ] `src/modules/events/events.service.ts` : Remplacer `user.org_id` par `user.currentOrgId`
- [ ] `src/modules/attendees/attendees.service.ts` : Remplacer `user.org_id` par `user.currentOrgId`
- [ ] Tous les autres services (scan exhaustif)

### 5.4 API multi-org

- [ ] `GET /api/me/orgs` - Liste des orgs du user
- [ ] `POST /admin/users/:id/orgs/:orgId` - Donner accès org (plateforme)
- [ ] `DELETE /admin/users/:id/orgs/:orgId` - Retirer accès

### 5.5 Tests

- [ ] User dans 2 orgs → switch org → vérifier permissions différentes
- [ ] User plateforme → accès seulement aux orgs autorisées

**Statut :** ⬜ Pas commencé

---

## Phase 6 - Gating modules (4-6 jours)

**Objectif :** Plans / modules activés par org

### 6.1 Seeders plans

- [ ] Créer `prisma/seeders/plans.seeder.ts`
  - [ ] Plan "Free" : events, attendees
  - [ ] Plan "Pro" : + badges, reports
  - [ ] Plan "Enterprise" : tous modules

### 6.2 API back-office

- [ ] `GET /admin/plans` - Liste plans
- [ ] `POST /admin/plans` - Créer plan
- [ ] `GET /admin/plans/:id/modules` - Modules du plan
- [ ] `POST /admin/plans/:id/modules/:key` - Activer module
- [ ] `DELETE /admin/plans/:id/modules/:key` - Désactiver module
- [ ] `PUT /admin/orgs/:id/modules/:key` - Override org

### 6.3 Tests

- [ ] Désactiver module badges → 403 sur routes badges
- [ ] Activer module via override → routes accessibles

**Statut :** ⬜ Pas commencé

---

## Phase 7 - Refactor UI (10-12 jours)

**Objectif :** Front respecte les mêmes règles que backend

### 7.1 Service ability front

- [ ] Créer `src/services/ability.service.ts` (front)
  - [ ] `can(permissionKey, ctx?): boolean`
  - [ ] `canUse(moduleKey): boolean`
  - [ ] `canSee(componentKey): boolean`

### 7.2 Endpoint backend

- [ ] `GET /api/me/permissions` - Permissions effectives
- [ ] `GET /api/me/modules` - Modules activés

### 7.3 Migrer UI Events

- [ ] Bouton "Créer event" → `v-if="can('event.create')"`
- [ ] Bouton "Modifier" → `v-if="can('event.update')"`
- [ ] Bouton "Supprimer" → `v-if="can('event.delete')"`

### 7.4 Gestion 403

- [ ] Interceptor HTTP → détecter 403 → message clair

**Statut :** ⬜ Pas commencé

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
