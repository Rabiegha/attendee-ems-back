# Attendees EMS - Architecture RBAC, Multi-tenant, Propagation & Plans

> **Stack technique :** NestJS + Prisma + PostgreSQL  
> **Version :** 1.0  
> **Dernière mise à jour :** Décembre 2024

Ce document décrit l'architecture du système d'autorisation de la plateforme EMS :
- RBAC (rôles / permissions / scopes) avec NestJS Guards & Decorators
- Multi-tenant (utilisateur dans plusieurs organisations)
- Gestion des plans et des modules (feature gating)
- Propagation des permissions à grande échelle
- Intégration avec CASL (Ability-based authorization)

---

## Table des matières

1. [Brainstorming & Vision](#brainstorming)
2. [Objectifs](#objectifs)
3. [Modèle conceptuel](#modèle-conceptuel)
4. [Architecture NestJS](#architecture-nestjs)
5. [Tables RBAC & Plans](#tables-rbac--plans)
6. [Invariants importants](#invariants-importants)
7. [API d'autorisation](#api-dautorisation)
8. [Références](#références)

---

# Brainstorming

# Brainstorming

## Vue d'ensemble : Ce qu'il faut mettre en place

### 1. Nouveau moteur d'autorisation centralisé (RBAC + scopes) avec NestJS

**Architecture NestJS actuelle :**
- ✅ **Guards** : `PermissionsGuard`, `JwtAuthGuard`, `TenantContextGuard`, `RoleModificationGuard`
- ✅ **CASL Factory** : `CaslAbilityFactory` pour la vérification binaire des capabilities
- ✅ **RbacService** : Service embryonnaire avec méthodes `can()`, `canAsTenant()`, `canAsPlatform()`
- ✅ **Decorators** : `@Permissions()` pour marquer les endpoints
- ⚠️ **Limitations actuelles** :
  - Gating binaire uniquement (possède ou non la permission)
  - Scopes ignorés dans CASL
  - Pas de gating par module (plans)
  - Logique de scope partielle dans `RbacService`

**Ce qui doit être ajouté/amélioré :**
* Introduire un **moteur d'autorisations centralisé** (évolution de `RbacService`) basé sur :
    * Les rôles (tenant / plateforme / root)
    * Les permissions (avec `module_key`)
    * Les scopes (own, assigned, team, any) - **implémentation complète**
* Respecter les deux axes :
    * **Type de rôle** : `is_platform`, `is_root`, `role_type`
    * **Portée (scope)** : `scope` dans `role_permissions` (own, team, assigned, any)
* Fournir une API/middleware NestJS générique :
    * `can(user, permissionKey, context): Promise<boolean>`
    * `@Permissions(permissionKey1, permissionKey2, ...)` - Decorator existant (améliorer le Guard)
    * `hasPermissionWithScope(user, permissionKey): { hasPermission, scope }`
* **Intégration avec CASL** :
    * CASL reste pour la vérification binaire (capability check)
    * Le moteur RBAC gère les scopes et le gating modules
    * Séparation claire des responsabilités

### 2. Modèle multi-tenant : user dans plusieurs orgs, plusieurs rôles

**État actuel dans Prisma :**
- ✅ `User` : Compte global sans `org_id` direct (déjà préparé pour multi-tenant)
- ✅ `OrgUser` : Table de liaison user ↔ organization (multi-appartenance)
- ✅ `UserRole` : Rôles par user + org (composite key)
- ✅ `PlatformUserOrgAccess` : Accès plateforme aux organisations
- ✅ Enum `OrgUserStatus` : active | invited | suspended
- ⚠️ **Limitations actuelles** :
  - JWT contient encore des infos d'une seule org (pas de `currentOrgId` dynamique)
  - Pas de switch d'organisation implémenté
  - Services utilisent encore des patterns mono-tenant

**Ce qui doit être fait :**
* **User global** (compte unique) + appartenance aux orgs via `OrgUser` :
    * Un user peut appartenir à plusieurs organisations
    * Champ `is_default` pour définir l'org par défaut
* **Rôles attachés via `UserRole`** :
    * Un user peut avoir plusieurs rôles par org
    * Support des rôles plateforme (`org_id = NULL`)
* **Users plateforme** :
    * `is_platform = true`, rôles plateforme (`roles.org_id = NULL`)
    * Accès aux orgs contrôlé via `PlatformUserOrgAccess`
* **Garantir côté BDD** (via Prisma) :
    * Un user tenant ne peut avoir que des rôles de ses orgs
    * FK composites : `UserRole(user_id, org_id)` → `OrgUser(user_id, org_id)`
* **JWT multi-org** :
    * Stocker `currentOrgId` dans le payload JWT
    * Créer un endpoint `POST /auth/switch-org` pour changer d'org active
    * Régénérer le token avec les permissions de la nouvelle org

### 3. Hiérarchie et structure des rôles (rank, types de rôles, rôles clés)

**État actuel dans Prisma :**
- ✅ `Role.rank` : Hiérarchie numérique (plus grand = plus puissant)
- ✅ `Role.is_platform` : Marqueur rôle plateforme
- ✅ `Role.is_root` : Marqueur God role
- ✅ `Role.role_type` : Enum `RoleType` (tenant_admin, tenant_manager, tenant_staff, support_L1, support_L2, custom)
- ✅ `Role.is_locked` : Protection contre modification/suppression
- ✅ `Role.managed_by_template` : Gestion automatique par PermissionRegistry
- ✅ `Role.permission_ceiling_scope` : Plafond de scope (any, team, assigned, own)
- ⚠️ **Seeders actuels** utilisent `level` au lieu de `rank` (à migrer)
- ⚠️ **RoleModificationGuard** existe mais pas d'anti-escalade complète

**Ce qui doit être fait :**
* **Définir une hiérarchie claire** entre les rôles via `rank` :
    * Valeurs : SUPER_ADMIN = 0, ADMIN = 1, MANAGER = 2, STAFF = 3, etc.
    * Plus le rank est petit, plus le rôle est puissant
* **Respecter les règles d'anti-escalade** (via NestJS Guards) :
    * Un user ne peut pas créer/assigner un rôle de `rank ≤` au sien
    * Un user ne peut jamais modifier son propre rôle
    * Seul un `is_root` peut créer/assigner un rôle root
* **Introduire des rôles types** via enum `RoleType` :
    * `tenant_admin`, `tenant_manager`, `tenant_staff` (tenant)
    * `support_L1`, `support_L2` (plateforme)
    * `custom` (créé par les orgs)
* **Introduire des rôles clés par org** :
    * Admin, Manager, Staff "standard" :
        * `role_type = tenant_admin / tenant_manager / tenant_staff`
        * `managed_by_template = true`
        * `is_locked = true` (non modifiables / non supprimables)
    * Ces rôles servent de socle commun et de cible principale pour la propagation auto
* **Migrer les seeders** :
    * Remplacer `level` par `rank`
    * Utiliser les nouveaux champs (`role_type`, `is_locked`, `managed_by_template`)

### 4. Permissions alignées avec la logique métier + PermissionRegistry

**État actuel :**
- ✅ **Seeder permissions** : `prisma/seeders/permissions.seeder.ts` (~931 lignes)
- ✅ **Structure actuelle** : `code`, `scope`, `name`, `description` dans le seeder
- ✅ **Schema Prisma** : `Permission` avec `module_key`, `allowed_scopes[]`, `default_scope_ceiling`
- ✅ **Permissions groupées** : organizations, users, events, attendees, registrations, roles, invitations, badges, analytics, reports
- ⚠️ **Limitations** :
  - Pas de `PermissionRegistry` TypeScript centralisé
  - `module_key` non rempli systématiquement
  - `allowed_scopes` et `default_scope_ceiling` non utilisés
  - `defaultScopesByRoleType` non défini

**Ce qui doit être fait :**
* **Lister les actions métier réelles** (déjà partiellement fait) :
    * Gérer événements, gérer sessions, scanner badges, gérer partenaires, gérer staff, exporter, importer, etc.
* **Regrouper ces actions en permissions** :
    * Format : `resource.action` (ex : `event.read`, `event.create`, `attendee.import`, `badge.print`, `event.export`)
    * Scopes possibles : `own`, `assigned`, `team`, `any`
* **Créer un `PermissionRegistry` TypeScript** (source de vérité) :
    ```typescript
    // src/rbac/permission-registry.ts
    export const PERMISSION_REGISTRY = {
      'event.read': {
        module: 'events',
        resource: 'event',
        action: 'read',
        allowedScopes: ['own', 'assigned', 'team', 'any'],
        defaultScopeCeiling: 'any',
        defaultScopesByRoleType: {
          tenant_admin: 'any',
          tenant_manager: 'any',
          tenant_staff: 'team',
          support_L1: 'assigned',
          custom: 'own',
        }
      },
      // ... toutes les permissions
    };
    ```
* **Lier chaque permission à** :
    * Un `module_key` (events, attendees, badges, analytics, etc.)
    * Une liste de `allowed_scopes` (scopes possibles)
    * Des scopes par défaut par type de rôle (`defaultScopesByRoleType`)
* **Utiliser le Registry** :
    * Dans les seeders (générer la table `Permission` depuis le Registry)
    * Dans `RbacService` (validation des scopes autorisés)
    * Dans les scripts de sync/propagation

### 5. Provisioning automatique des rôles et permissions par organisation

**État actuel :**
- ✅ **Seeder rôles** : `prisma/seeders/roles.seeder.ts` crée les templates système
- ✅ **Fonction `seedOrganizationRoles(orgId)`** : Clone les rôles pour une org
- ⚠️ **Limitations** :
  - Hook de création d'org non automatisé
  - Pas de script de sync idempotent
  - Utilise `level` au lieu de `rank`
  - Ne remplit pas les nouveaux champs RBAC

**Ce qui doit être fait :**
* **À la création d'une nouvelle org** (via `OrganizationsService`) :
    * Hook NestJS après création : `@OnEvent('organization.created')`
    * Créer automatiquement les rôles clés (Admin, Manager, Staff) avec :
        * `role_type` + `rank` + `permission_ceiling_scope`
        * `is_locked = true`, `managed_by_template = true`
    * Assigner les permissions de base via le `PermissionRegistry`
* **Utiliser un seeder/script idempotent** (upsert) pour :
    * Recréer / corriger les rôles standard si besoin
    * Rejouer la config sans dupliquer
    * Script CLI : `npm run permissions:sync`
* **Service NestJS dédié** :
    ```typescript
    // src/rbac/role-provisioning.service.ts
    @Injectable()
    export class RoleProvisioningService {
      async provisionDefaultRoles(orgId: string): Promise<void>
      async syncPermissionsForOrg(orgId: string): Promise<void>
      async syncAllOrganizations(): Promise<void>
    }
    ```

6. Propagation / mise à jour des permissions à grande échelle
Objectif : ajouter / modifier des permissions sans casser les customisations ni la sécurité.
* Séparer :
    * définition globale (PermissionRegistry),
    * custom par org (rôles modifiés par les admins).
* Ajouter un champ managed_by_template sur les rôles :
    * true → rôle géré automatiquement par le modèle global,
    * false → rôle custom, jamais modifié automatiquement.
* Rôles créés par une org :
    * managed_by_template = false par défaut (toujours custom).
* Un rôle perd managed_by_template = true dès que l’admin modifie ses permissions / scopes / structure :
    * il devient un rôle custom.
* Rôles clés (is_locked = true) :
    * restent toujours managed_by_template = true,
    * ne peuvent pas être modifiés par les orgs.
* Script de sync :
    * lit le PermissionRegistry,
    * upsert les permissions,
    * met à jour les role_permissions uniquement pour les rôles managed_by_template = true (surtout les rôles clés),
    * ne touche jamais aux rôles custom (managed_by_template = false).

### 7. Gating par plan / modules

**Objectif :** Intégrer la notion de plan (offre/abonnement) et limiter l'accès aux modules, même si les permissions existent.

**État actuel :**
- ✅ **Tables Prisma** : `Plan`, `Module`, `PlanModule`, `OrgModuleOverride` (100% implémentées)
- ✅ **Organization.plan_id** : Lien vers le plan
- ⚠️ **Limitations** :
  - Pas de service `ModulesService` pour vérifier l'activation
  - `module_key` non rempli systématiquement dans les permissions
  - Gating non intégré dans `RbacService` ou guards

**Ce qui doit être fait :**

* **Créer `ModulesService`** :
    ```typescript
    // src/modules/plans/modules.service.ts
    @Injectable()
    export class ModulesService {
      async isModuleEnabledForTenant(
        tenantId: string, 
        moduleKey: string
      ): Promise<boolean> {
        // 1. Lire Organization.plan_id
        // 2. Vérifier PlanModule (modules inclus par défaut)
        // 3. Appliquer OrgModuleOverride (prioritaire)
        // 4. Retourner boolean
      }
    }
    ```

* **Intégrer dans `RbacService.can()`** :
    ```typescript
    async can(user, permissionKey, context): Promise<boolean> {
      // ... vérifications existantes ...
      
      // Gating par module
      const moduleKey = this.getModuleKeyForPermission(permissionKey);
      if (moduleKey) {
        const isEnabled = await this.modulesService.isModuleEnabledForTenant(
          context.orgId, 
          moduleKey
        );
        if (!isEnabled) return false;
      }
      
      // ... suite des vérifications ...
    }
    ```

* **Créer un decorator avancé** :
    ```typescript
    // src/common/decorators/require-permission.decorator.ts
    export function RequirePermission(
      permissionKey: string, 
      moduleKey?: string
    ) {
      return applyDecorators(
        SetMetadata('permission', permissionKey),
        SetMetadata('module', moduleKey),
        UseGuards(PermissionsGuard)
      );
    }
    ```

* **Endpoints back-office** (NestJS Controllers) :
    ```typescript
    // src/modules/plans/plans.controller.ts
    @Controller('admin/plans')
    @UseGuards(JwtAuthGuard, PermissionsGuard)
    export class PlansController {
      @Get() // GET /admin/plans
      @Permissions('plans.read')
      async findAll()
      
      @Post() // POST /admin/plans
      @Permissions('plans.create')
      async create()
      
      @Get(':id/modules') // GET /admin/plans/:id/modules
      @Permissions('plans.read')
      async getModules()
      
      @Post(':id/modules/:key') // POST /admin/plans/:id/modules/:key
      @Permissions('plans.manage_modules')
      async enableModule()
      
      @Delete(':id/modules/:key') // DELETE /admin/plans/:id/modules/:key
      @Permissions('plans.manage_modules')
      async disableModule()
    }
    
    // src/modules/organizations/org-modules.controller.ts
    @Controller('admin/organizations/:orgId/modules')
    export class OrgModulesController {
      @Put(':key') // PUT /admin/orgs/:orgId/modules/:key
      @Permissions('organizations.manage_modules')
      async overrideModule() // Force enable/disable
    }
    ```

* **Seeder les plans de base** :
    ```typescript
    // prisma/seeders/plans.seeder.ts
    const plans = [
      { 
        code: 'FREE', 
        modules: ['events', 'attendees'] 
      },
      { 
        code: 'PRO', 
        modules: ['events', 'attendees', 'badges', 'reports'] 
      },
      { 
        code: 'ENTERPRISE', 
        modules: 'all' 
      },
    ];
    ```

* **Invariant** :
    * Une org ne peut plus utiliser un module qui n'est pas dans son plan ni dans ses overrides, même si un rôle a la permission en BDD

### 8. Refactor de l'UI côté front

**État actuel du frontend :**
- 📁 **Stack** : React/Vue/Angular (à confirmer selon `/attendee-ems-front`)
- ⚠️ **Limitations probables** :
  - Checks en dur type `if (user.role === 'admin')`
  - Pas de service d'ability côté frontend
  - Gestion 403 basique ou absente

**Ce qui doit être fait :**

* **Adapter l'UI** pour consommer le nouveau moteur d'autorisations + gating modules :
    * Affichage conditionnel des menus, pages, boutons, actions
    * Feedback propre en cas de 403 (erreur d'autorisation)

* **Créer un endpoint backend** :
    ```typescript
    // src/modules/auth/auth.controller.ts
    @Get('me/permissions')
    @UseGuards(JwtAuthGuard)
    async getMyPermissions(@CurrentUser() user) {
      return {
        permissions: user.permissions, // avec scopes
        modules: await this.modulesService.getEnabledModulesForOrg(user.orgId),
        orgId: user.currentOrgId,
        isRoot: user.isRoot,
        isPlatform: user.isPlatform,
      };
    }
    
    @Get('me/organizations')
    @UseGuards(JwtAuthGuard)
    async getMyOrganizations(@CurrentUser() user) {
      // Retourne la liste des orgs de l'utilisateur
    }
    ```

* **Exposer un service "ability" côté front** :
    ```typescript
    // frontend/src/services/ability.service.ts
    class AbilityService {
      private permissions: string[] = [];
      private modules: string[] = [];
      
      can(permissionKey: string, scope?: string): boolean {
        // Vérifie si user a la permission (avec ou sans scope)
      }
      
      canUse(moduleKey: string): boolean {
        return this.modules.includes(moduleKey);
      }
      
      canSee(componentKey: string): boolean {
        // Logique custom pour composants UI
      }
      
      async refresh(): Promise<void> {
        // Appelle GET /api/auth/me/permissions
      }
    }
    ```

* **Utiliser ce service partout** au lieu de checks en dur :
    * ❌ `if (user.role === 'admin')`
    * ❌ `if (user.isAdmin)`
    * ✅ `if (ability.can('event.create'))`
    * ✅ `if (ability.canUse('badges'))`

* **Gérer les erreurs 403** :
    ```typescript
    // HTTP Interceptor
    axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response.status === 403) {
          // Afficher message : "Permission refusée : {permissionKey}"
          // Optionnel : refresh permissions ou redirect
        }
        return Promise.reject(error);
      }
    );
    ```

---

## Objectifs

- Garantir un contrôle d'accès sécurisé, cohérent et extensible avec **NestJS Guards & Decorators**
- Supporter plusieurs organisations (tenants) avec des rôles et permissions spécifiques
- Permettre à un même utilisateur d'appartenir à plusieurs organisations avec des rôles différents
- Introduire des rôles plateforme (support, super admin) et un rôle root
- Lier l'accès aux fonctionnalités aux plans / modules souscrits par chaque organisation
- Permettre la propagation contrôlée des nouvelles permissions sans casser les customisations locales
- **Intégrer harmonieusement avec l'écosystème NestJS** (Dependency Injection, Guards, Interceptors, etc.)

---

## Architecture NestJS

### Vue d'ensemble des composants

```
┌─────────────────────────────────────────────────────────────────┐
│                         HTTP Request                             │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   JwtAuthGuard          │
                    │   (Authentication)      │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ TenantContextGuard      │
                    │ (Org context)           │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  PermissionsGuard       │
                    │  (@Permissions)         │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ AuthorizationService    │
                    │   .can(user, perm, ctx) │
                    └────────────┬────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │                                 │
    ┌───────────▼──────────┐         ┌───────────▼──────────┐
    │  CaslAbilityFactory  │         │   ModulesService     │
    │  (Binary gating)     │         │   (Feature gating)   │
    └──────────────────────┘         └──────────────────────┘
                │                                 │
                └────────────────┬────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      Controller         │
                    │      (Business Logic)   │
                    └─────────────────────────┘
```

### Composants existants

#### 1. Guards (src/common/guards/)

**`JwtAuthGuard`**
- Authentifie le user via JWT
- Extrait le payload et l'attache à `request.user`
- Premier guard dans la chaîne

**`TenantContextGuard`**
- Vérifie que le user a accès à l'org courante
- Charge le contexte tenant

**`PermissionsGuard`**
- Lit les metadata `@Permissions()`
- Délègue la vérification à `CaslAbilityFactory` (actuellement - gating binaire uniquement)
- **À améliorer** : Doit utiliser `AuthorizationService.can()` pour scopes + gating module

**`RoleModificationGuard`**
- Empêche les modifications de rôles non autorisées
- **À compléter** avec anti-escalade complète

#### 2. Services RBAC (src/rbac/)

**`CaslAbilityFactory`**
- Crée des abilities CASL pour vérification binaire (capability check)
- **Limite actuelle** : Ignore les scopes, gating binaire uniquement
- **Rôle futur** : Rester pour checks binaires, les scopes gérés par `AuthorizationService`

**`RbacService`** (embryonnaire)
- Méthodes `can()`, `canAsTenant()`, `canAsPlatform()`
- **À transformer** en `AuthorizationService` complet

#### 3. Decorators (src/common/decorators/)

**`@Permissions(...permissionKeys)`**
- Marque les endpoints avec permissions requises
- Lu par `PermissionsGuard`

**`@CurrentUser()`** (probablement existant)
- Extrait `request.user` (JWT payload)

**À améliorer : `PermissionsGuard`**
- Adapter pour utiliser `AuthorizationService` au lieu de juste CASL
- Intégrer gating par module et scopes

#### 4. Seeders Prisma (prisma/seeders/)

**`permissions.seeder.ts`** (~931 lignes)
- Seede toutes les permissions
- Format: `{ code, scope, name, description }`
- **À migrer** vers utilisation du `PermissionRegistry`

**`roles.seeder.ts`** (~256 lignes)
- Crée les rôles système (templates)
- Fonction `seedOrganizationRoles(orgId)` pour cloner les rôles
- **À migrer** : `level` → `rank`, ajouter nouveaux champs

### Flow d'autorisation complet (cible)

1. **Request arrives** → `JwtAuthGuard` authentifie
2. **User authenticated** → `TenantContextGuard` vérifie org context
3. **Org verified** → `PermissionsGuard` lit `@Permissions('event.create')`
4. **Permission required** → `AuthorizationService.can()` appelé avec :
   ```typescript
   {
     permissionKey: 'event.create',
     moduleKey: 'events',
     actorOrgId: user.currentOrgId,
     actorUserId: user.sub,
     // ... autres contextes
   }
   ```
5. **Authorization checks** :
   - ✅ User is root? → Allow
   - ✅ Module enabled for org? → Check `ModulesService`
   - ✅ User has permission? → Query `UserRole → RolePermission`
   - ✅ Scope covers resource? → `scopeCovers(scope, context)`
6. **Access granted/denied** → Continue to controller or throw 403

### Modules NestJS impliqués

```typescript
// src/app.module.ts
@Module({
  imports: [
    // ... autres modules
    RbacModule,
    AuthModule,
    OrganizationsModule,
    PlansModule,  // À créer
  ],
})
export class AppModule {}

// src/rbac/rbac.module.ts
@Module({
  providers: [
    AuthorizationService,
    CaslAbilityFactory,
    RoleProvisioningService,
    PermissionPropagationService,
  ],
  exports: [
    AuthorizationService,
    CaslAbilityFactory,
  ],
})
export class RbacModule {}

// src/modules/plans/plans.module.ts (nouveau)
@Module({
  providers: [
    PlansService,
    ModulesService,
  ],
  controllers: [
    PlansController,
    OrgModulesController,
  ],
  exports: [
    ModulesService,
  ],
})
export class PlansModule {}
```

---


## 2. Modèle conceptuel


### 2.1 Axes principaux

1. **Type de rôle**
   - `is_root` : rôle God, bypass total (rare, extrêmement limité).
   - `is_platform` : rôle plateforme (support, ops, etc.), non lié à une org unique.
   - `role_type` : classification fonctionnelle du rôle (ex. `tenant_admin`, `tenant_manager`, `tenant_staff`, `support_L1`, `support_L2`, `custom`).

2. **Portée (scope)**

    Portée pour un utilisateur Tenant (is_platform = false)
    Un utilisateur tenant ne voit jamais en dehors de son organisation, peu importe son scope.
   - `own`  : Accès uniquement à ce qui lui appartient personnellement. Exemples : événements qu'il a créés (si la logique existe), actions qu'il a effectuées
   - `team` : accès aux ressources de sa team.
   - `assigned`  : Accès uniquement aux ressources qui lui ont été explicitement assignées. Exemples : événements qu’on lui a donnés dans event_access.
   - `any`  : Accès à toute l’organisation (tous les événements, tous les participants, tous les partenaires, etc.). Ici any = org.
   - L’ordre des scopes est : `own < assigned < team  < any`.

    Portée pour un utilisateur Plateforme (is_platform = true)
    Un utilisateur plateforme a une visibilité qui dépend de son scope et de
    platform_user_org_access (la liste des tenants auxquels il peut accéder)
   - `own`  : Accès uniquement à ce qu’il a créé dans les outils plateforme (rare).
   - `assigned` : Accès uniquement aux organisations (tenants) qui lui sont attribuées dans platform_user_org_access.
   - `any`  : Accès à tous les tenants ainsi que toutes leurs ressources. (any = full cross-tenancy)
   - L’ordre des scopes est : `own < assigned < any`.

3. **Plans / modules**
   - Les fonctionnalités sont regroupées par module (`events`, `attendees`, `badges`, `analytics`, etc.).
   - Chaque organisation a un **plan** qui active certains modules.
   - Des overrides par organisation permettent d’activer/désactiver manuellement un module.

---


## 3. Tables RBAC & Plans

### 3.1 Niveau utilisateur / organisation

- `users`  
  Compte global utilisateur (email, mot de passe, profil). Un user peut appartenir à plusieurs orgs.

- `org_users`  
  Lien entre `users` et `organizations`.  
  Un user peut avoir plusieurs entrées ici (multi-tenant).

- `user_roles`  
  Lien entre un user, une org et un rôle.  
  Un user peut avoir plusieurs rôles dans une même org.

- `platform_user_org_access`  
  Spécifie sur quelles organisations un user plateforme (`is_platform = true`) peut intervenir.

### 3.2 Rôles et permissions

- `roles`  
  Rôle dans une organisation ou rôle plateforme global.  
  Champs importants :
  - `org_id` : NULL pour les rôles plateforme.
  - `rank` : hiérarchie (plus grand = plus puissant).
  - `is_platform` : rôle plateforme.
  - `is_root` : rôle God.
  - `role_type` : type logique (`tenant_admin`, `tenant_manager`, `tenant_staff`, `custom`, etc.).
  - `is_locked` : rôle clé non modifiable / non supprimable.
  - `managed_by_template` : rôle géré automatiquement par le PermissionRegistry.

- `permissions`  
  Permission atomique (ex : `event.read`, `event.create`, `badge.print`).  
  Champs importants :
  - `module_key` : module associé à la permission.
  - `scope_levels` : scopes possibles pour cette permission.
  - `default_scope_ceiling` : scope maximal par défaut.

- `role_permissions`  
  Associe un rôle à une permission avec un `scope_limit`.

### 3.3 Plans et modules

- `plans`  
  Définit les offres commerciales (Free, Pro, Enterprise…).

- `modules`  
  Liste les modules fonctionnels de la plateforme (events, attendees, badges…).

- `plan_modules`  
  Lie un plan à un module (quels modules sont inclus par défaut dans chaque plan).

- `org_module_overrides`  
  Permet au super admin plateforme de forcer l’activation ou la désactivation d’un module pour une organisation donnée.

---


## 4. Invariants importants

1. **Multi-tenant**
   - Un user tenant ne sort jamais de son organisation dans les données.
   - Pour un user tenant, toute action est limitée à une org présente dans `org_users`.
   - Un user plateforme (is_platform = true) :
   si son scope = assigned, il ne peut agir que sur les organisations listées dans platform_user_org_access ;
   si son scope = any, il peut agir sur toutes les organisations (accès cross-tenants complet).

2. **Hiérarchie des rôles**
   - Un utilisateur ne peut pas créer ni assigner un rôle de `rank` ≥ à son propre rôle.
   - Un utilisateur ne peut jamais modifier son propre rôle.
   - Seul un rôle `is_root = true` peut créer/assigner un rôle root.
   - Les rôles clés (Admin/Manager/Staff standard) sont `is_locked = true`.impossible à supprimer, modifier ou renommer.
   

3. **Rôles clés et templates**
   - Chaque organisation possède des rôles clés : Admin, Manager, Staff.
   - Ces rôles ont :
     - `role_type = tenant_admin / tenant_manager / tenant_staff`,
     - `managed_by_template = true`,
     - `is_locked = true`.
   - Les rôles créés par une org sont :
     - `managed_by_template = false` par défaut,
     - gérés 100 % par l’organisation, jamais modifiés automatiquement.

4. **Propagation des permissions**
   - Le `PermissionRegistry` est la source de vérité globale pour :
     - la liste des permissions,
     - leurs scopes possibles,
     - les scopes par défaut par type de rôle.
   - Un script de synchronisation :
     - upsert les permissions,
     - met à jour `role_permissions` uniquement pour les rôles `managed_by_template = true`.
   - Les rôles custom (`managed_by_template = false`) ne sont jamais modifiés automatiquement.

---

## 6. PermissionRegistry : Source de vérité TypeScript

Le `PermissionRegistry` centralise la définition de toutes les permissions en TypeScript.

### 6.1 Structure

```typescript
// src/rbac/permission-registry.ts
export interface PermissionDefinition {
  module: string;                    // Module associé
  allowedScopes: Scope[];            // Scopes autorisés pour cette permission
  defaultScopeCeiling: Scope;        // Plafond par défaut
  defaultScopesByRoleType: {         // Scopes par défaut par type de rôle
    tenant_admin?: Scope;
    tenant_manager?: Scope;
    tenant_staff?: Scope;
    support_L1?: Scope;
    support_L2?: Scope;
    custom?: Scope;
  };
  description?: string;
}

export const PERMISSION_REGISTRY: Record<string, PermissionDefinition> = {
  // ========== EVENTS ==========
  'event.read': {
    module: 'events',
    allowedScopes: ['own', 'assigned', 'team', 'org', 'any'],
    defaultScopeCeiling: 'org',
    defaultScopesByRoleType: {
      tenant_admin: 'any',
      tenant_manager: 'org',
      tenant_staff: 'team',
      support_L1: 'assigned',
      custom: 'own',
    },
    description: 'Lire les événements'
  },
  'event.create': {
    module: 'events',
    allowedScopes: ['org', 'any'],
    defaultScopeCeiling: 'org',
    defaultScopesByRoleType: {
      tenant_admin: 'any',
      tenant_manager: 'org',
      tenant_staff: 'org',
      custom: 'org',
    },
    description: 'Créer un événement'
  },
  'event.update': {
    module: 'events',
    allowedScopes: ['own', 'assigned', 'team', 'org', 'any'],
    defaultScopeCeiling: 'org',
    defaultScopesByRoleType: {
      tenant_admin: 'any',
      tenant_manager: 'org',
      tenant_staff: 'team',
      custom: 'own',
    },
    description: 'Modifier un événement'
  },
  'event.delete': {
    module: 'events',
    allowedScopes: ['any'],
    defaultScopeCeiling: 'any',
    defaultScopesByRoleType: {
      tenant_admin: 'any',
    },
    description: 'Supprimer un événement (admin only)'
  },

  // ========== ATTENDEES ==========
  'attendee.read': {
    module: 'attendees',
    allowedScopes: ['own', 'assigned', 'team', 'org', 'any'],
    defaultScopeCeiling: 'org',
    defaultScopesByRoleType: {
      tenant_admin: 'any',
      tenant_manager: 'org',
      tenant_staff: 'team',
      custom: 'assigned',
    },
    description: 'Lire les participants'
  },
  'attendee.import': {
    module: 'attendees',
    allowedScopes: ['org', 'any'],
    defaultScopeCeiling: 'org',
    defaultScopesByRoleType: {
      tenant_admin: 'any',
      tenant_manager: 'org',
      tenant_staff: 'org',
    },
    description: 'Importer des participants'
  },

  // ========== BADGES ==========
  'badge.design.create': {
    module: 'badges',
    allowedScopes: ['org', 'any'],
    defaultScopeCeiling: 'org',
    defaultScopesByRoleType: {
      tenant_admin: 'any',
      tenant_manager: 'org',
    },
    description: 'Créer un design de badge'
  },
  'badge.print': {
    module: 'badges',
    allowedScopes: ['assigned', 'team', 'org', 'any'],
    defaultScopeCeiling: 'org',
    defaultScopesByRoleType: {
      tenant_admin: 'any',
      tenant_manager: 'org',
      tenant_staff: 'team',
      custom: 'assigned',
    },
    description: 'Imprimer des badges'
  },

  // ========== ROLES & PERMISSIONS ==========
  'role.create': {
    module: 'roles',
    allowedScopes: ['org', 'any'],
    defaultScopeCeiling: 'org',
    defaultScopesByRoleType: {
      tenant_admin: 'any',
    },
    description: 'Créer un rôle'
  },
  'role.assign': {
    module: 'roles',
    allowedScopes: ['org', 'any'],
    defaultScopeCeiling: 'org',
    defaultScopesByRoleType: {
      tenant_admin: 'any',
      tenant_manager: 'org',
    },
    description: 'Assigner un rôle à un utilisateur'
  },

  // ... 315+ permissions au total
};
```

### 6.2 Utilisation du Registry

**Extraction du module depuis une permission :**

```typescript
const permissionDef = PERMISSION_REGISTRY['event.read'];
const moduleKey = permissionDef.module; // 'events'
```

**Vérification des scopes autorisés :**

```typescript
const allowedScopes = PERMISSION_REGISTRY['event.update'].allowedScopes;
if (!allowedScopes.includes(requestedScope)) {
  throw new Error('Scope non autorisé pour cette permission');
}
```

**Obtention du scope par défaut pour un type de rôle :**

```typescript
const defaultScope = PERMISSION_REGISTRY['event.read']
  .defaultScopesByRoleType.tenant_manager; // 'org'
```

5. **Gating par plan / modules**
   - Une permission ne suffit pas pour autoriser une action :
     - le module correspondant doit être activé pour l’org.
   - `isModuleEnabledForTenant(tenantId, moduleKey)` combine :
     - le plan de l’org + `plan_modules`,
     - les overrides `org_module_overrides`.
   - `requirePermission` refuse l’accès si le module est désactivé, même si le rôle a la permission.

---

## 5. Architecture des Guards NestJS

### 5.1 Pipeline de Guards

L'autorisation repose sur un pipeline de Guards NestJS, exécutés dans l'ordre :

```typescript
1. JwtAuthGuard          → Authentification (extrait user du JWT)
2. TenantContextGuard    → Multi-tenant (valide org, set currentOrgId)
3. ModuleGatingGuard     → Gating modules (vérifie module activé)
4. RequirePermissionGuard → Permission + scope (vérifie autorisation finale)
```

**Principes clés :**
- **Séparation des responsabilités** : 1 Guard = 1 responsabilité
- **Composabilité** : Les Guards peuvent être combinés selon les besoins
- **Testabilité** : Chaque Guard est testable indépendamment
- **Évolutivité** : Ajout de nouveaux Guards sans modifier l'existant

### 5.2 Décorateurs

#### `@RequirePermission(key, options?)`

Décorateur principal pour les permissions avec options avancées :

```typescript
@RequirePermission('event.read', {
  scope?: Scope,              // Force un scope spécifique
  resourceIdParam?: string,   // Param pour extraire l'ID de la ressource
  checkOwnership?: boolean,   // Vérifier ownership de la ressource
  allowPlatform?: boolean     // Autoriser users plateforme
})
```

**Exemples d'utilisation :**

```typescript
// Cas 1: Lecture simple (scope auto-déterminé)
@Get()
@RequirePermission('event.list')
async findAll() { }

// Cas 2: Création avec scope explicite
@Post()
@RequirePermission('event.create', { scope: 'org' })
async create(@Body() dto) { }

// Cas 3: Modification avec ownership
@Patch(':id')
@RequirePermission('event.update', { 
  resourceIdParam: 'id',
  checkOwnership: true 
})
async update(@Param('id') id: string, @Body() dto) { }

// Cas 4: Suppression admin only
@Delete(':id')
@RequirePermission('event.delete', { 
  scope: 'any',
  resourceIdParam: 'id'
})
async delete(@Param('id') id: string) { }
```

#### `@RequireModule(moduleKey)`

Décorateur optionnel pour gating explicite de module :

```typescript
@Post(':eventId/badges')
@RequireModule('badges')  // Vérifie que le module badges est activé
@RequirePermission('badge.create', { scope: 'team' })
async createBadge(@Param('eventId') eventId: string) { }
```

#### `@RbacContext(builder)`

Décorateur pour construire un RbacContext custom dans les cas complexes :

```typescript
@Post(':eventId/sessions')
@RequirePermission('session.create', { scope: 'team' })
@RbacContext((req, params) => ({
  resourceTenantId: params.eventId,
  actorTenantId: req.user.currentOrgId,
  actorUserId: req.user.id,
  actorTeamIds: req.user.teams || []
}))
async createSession(@Param('eventId') eventId: string) { }
```

### 5.3 Services d'autorisation

#### `RbacService`

Service central qui orchestre toute la logique d'autorisation :

```typescript
@Injectable()
export class RbacService {
  constructor(
    private prisma: PrismaService,
    private modulesService: ModulesService,
  ) {}

  // Méthode principale
  async can(
    user: UserPayload, 
    permissionKey: string, 
    context: RbacContext
  ): Promise<boolean>

  // Méthodes auxiliaires
  async getBestScopeForPermission(
    user: UserPayload, 
    permissionKey: string, 
    orgId: string
  ): Promise<Scope | null>

  scopeCovers(scopeLimit: Scope, context: RbacContext): boolean

  private async isTenantMember(userId: string, orgId: string): Promise<boolean>
  
  private async hasPlatformAccess(userId: string, orgId: string): Promise<boolean>
  
  private getHighestScope(scopes: Scope[]): Scope
}
```

**Algorithme de `can()` :**

1. **Vérifier is_root** : Si `user.is_root === true` → accès total (return true)
2. **Vérifier tenant vs plateforme** :
   - User tenant : vérifier appartenance à l'org via `OrgUser`
   - User plateforme : vérifier accès via `PlatformUserOrgAccess` (si scope = assigned)
3. **Vérifier module activé** : `isModuleEnabledForTenant(tenantId, moduleKey)`
4. **Récupérer le meilleur scope** : `getBestScopeForPermission(user, permissionKey, orgId)`
   - Si aucun scope trouvé → **refuser l'accès** (return false)
5. **Vérifier scope coverage** : `scopeCovers(bestScope, context)`

#### `ModulesService`

Service dédié à la gestion des plans et modules :

```typescript
@Injectable()
export class ModulesService {
  async isModuleEnabledForTenant(
    tenantId: string, 
    moduleKey: string
  ): Promise<boolean> {
    // 1. Lire plan de l'org
    // 2. Vérifier plan_modules
    // 3. Appliquer org_module_overrides (priorité)
    // 4. Retourner boolean
  }
}
```

### 5.4 API Frontend

Service d'autorisation côté front :

```typescript
// ability.service.ts
export class AbilityService {
  can(permissionKey: string, ctx?: RbacContext): boolean
  canUse(moduleKey: string): boolean
  canSee(componentKey: string): boolean
}
```

**Endpoint backend pour le front :**

```typescript
// GET /api/me/permissions
{
  "permissions": [
    { "key": "event.read", "scope": "org" },
    { "key": "event.create", "scope": "org" },
    { "key": "badge.print", "scope": "team" }
  ],
  "modules": ["events", "attendees", "badges"]
}
```

---

Tu peux enrichir ce doc au fur et à mesure, mais avec ça tu as déjà une base claire.  
Maintenant on met à jour ton DBML.

---

## 2) Mise à jour DBML (partie RBAC & plans)

Tu as déjà `users`, `roles`, `permissions`, `role_permissions` dans ton DBML.  
Voici une version mise à jour / complétée des tables RBAC & plans.  
Tu peux les intégrer dans ton schéma existant.

```dbml
///////////////////////////////////////////////////////
// RBAC & Multi-tenant
///////////////////////////////////////////////////////

org_users [icon: users, color: green] {
  id uuid pk
  org_id uuid
  user_id uuid
  status text                  // active | invited | suspended...
  is_default boolean
  created_at timestamptz
  updated_at timestamptz
}

user_roles [icon: shield, color: purple] {
  id uuid pk
  user_id uuid
  org_id uuid                  // NULL pour les rôles plateforme (optionnel si tu sépares tenant/platform)
  role_id uuid
  created_at timestamptz
  updated_at timestamptz
}

platform_user_org_access [icon: globe, color: purple] {
  id uuid pk
  user_id uuid                 // users.id (is_platform = true)
  org_id uuid                  // organizations.id
  created_at timestamptz
  updated_at timestamptz
}

roles [icon: shield, color: purple] {
  id uuid pk
  org_id uuid                  // NULL = rôle plateforme
  code text
  name text
  description text

  // RBAC avancé
  rank int                     // plus grand = plus puissant
  is_platform boolean          // true = rôle plateforme (support, root, etc.)
  is_root boolean              // true = God role
  role_type text               // tenant_admin | tenant_manager | tenant_staff | support_L1 | custom...
  is_locked boolean            // true = rôle clé non modifiable / non supprimable
  managed_by_template boolean  // true = suit le PermissionRegistry

  permission_ceiling_scope text  // own|team|org|any : plafond de scope pour ce rôle

  created_at timestamptz
  updated_at timestamptz
}

permissions [icon: key, color: orange] {
  code text pk                 // ex: 'event.read'
  description text
  resource text                // ex: 'event'
  action text                  // ex: 'read'

  module_key text              // ex: 'events', 'attendees', 'badges'
  scope_levels text[]          // ex: ['own','team','org','any']
  default_scope_ceiling text   // ex: 'org'

  created_at timestamptz
  updated_at timestamptz
}

role_permissions [icon: lock, color: orange] {
  role_id uuid pk
  permission_code text pk      // permissions.code

  scope_limit text             // own|team|org|any (limite pour ce rôle/permission)
  conditions jsonb             // pour logiques avancées (optionnel)

  created_at timestamptz
  updated_at timestamptz
}

///////////////////////////////////////////////////////
// Plans & Modules
///////////////////////////////////////////////////////

plans [icon: package, color: blue] {
  id uuid pk
  code text unique             // ex: 'FREE', 'PRO', 'ENTERPRISE'
  name text
  description text
  billing_period text          // ex: 'monthly', 'yearly'
  is_active boolean
  created_at timestamptz
  updated_at timestamptz
}

modules [icon: layers, color: teal] {
  key text pk                  // ex: 'events', 'attendees', 'badges', 'analytics'
  name text
  description text
  category text                // optionnel : 'core', 'premium', ...
  created_at timestamptz
  updated_at timestamptz
}

plan_modules [icon: link, color: teal] {
  id uuid pk
  plan_id uuid                 // plans.id
  module_key text              // modules.key
  is_included_by_default boolean
  created_at timestamptz
  updated_at timestamptz
}

org_module_overrides [icon: toggle-right, color: teal] {
  id uuid pk
  org_id uuid                  // organizations.id
  module_key text              // modules.key

  forced_status text           // 'enabled' | 'disabled' (override du plan)

  created_at timestamptz
  updated_at timestamptz
}
Relations à ajouter dans la section relationships
dbml
Copier le code
// org_users: user dans plusieurs organisations
org_users.org_id > organizations.id
org_users.user_id > users.id

// user_roles: rôles par user et par org
user_roles.user_id > users.id
user_roles.org_id > organizations.id
user_roles.role_id > roles.id

// platform_user_org_access
platform_user_org_access.user_id > users.id
platform_user_org_access.org_id > organizations.id

// roles.org_id > organizations.id (optionnel si non NULL)
roles.org_id > organizations.id

// role_permissions
role_permissions.role_id > roles.id
role_permissions.permission_code > permissions.code

// plans & modules
plan_modules.plan_id > plans.id
plan_modules.module_key > modules.key

org_module_overrides.org_id > organizations.id
org_module_overrides.module_key > modules.key


Indexes utiles
indexes {
  // appartenance user/org (multi-tenant)
  (org_users.user_id, org_users.org_id) [unique]
  (user_roles.user_id, user_roles.org_id, user_roles.role_id) [unique]

  // mapping plan/modules
  (plan_modules.plan_id, plan_modules.module_key) [unique]

  // overrides par org/module
  (org_module_overrides.org_id, org_module_overrides.module_key) [unique]
}