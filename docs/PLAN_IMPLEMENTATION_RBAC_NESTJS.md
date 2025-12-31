# Plan d'Implémentation RBAC Multi-Tenant - NestJS

> **Stack :** NestJS + Prisma + PostgreSQL  
> **Version :** 1.0  
> **Date :** Décembre 2024

Ce plan détaille l'implémentation complète du système RBAC multi-tenant dans votre application NestJS existante.

---

## 📊 État des lieux

### ✅ Déjà en place
- **Schema Prisma** : Toutes les tables RBAC (User, OrgUser, UserRole, Role, Permission, RolePermission, Plan, Module, etc.)
- **Guards NestJS** : PermissionsGuard, JwtAuthGuard, TenantContextGuard, RoleModificationGuard
- **CASL Factory** : CaslAbilityFactory pour vérifications binaires
- **RbacService** : Service embryonnaire avec `can()`, `canAsTenant()`, `canAsPlatform()`
- **Seeders** : permissions.seeder.ts (~931 lignes), roles.seeder.ts (~256 lignes)
- **Decorators** : @Permissions() pour marquer les endpoints

### ⚠️ À améliorer/compléter
- Gating par scope (own, assigned, team, any) incomplet
- Pas de gating par module (plans)
- JWT mono-org (pas de switch d'organisation)
- PermissionRegistry TypeScript manquant
- Propagation automatique des permissions absente
- Seeders utilisent `level` au lieu de `rank`

---

## 🎯 Phases d'implémentation

> **Note importante :** Dans ce plan, nous utilisons le decorator `@Permissions()` **existant** au lieu de créer un nouveau `@RequirePermission()`. Le `PermissionsGuard` existant sera **amélioré** pour utiliser `AuthorizationService.can()` qui gère les scopes et le gating par module. Cette approche est plus simple et rétrocompatible.

---

## Phase 0 – Documentation & Architecture ✅ EN COURS

**Objectif :** Consolider toute la documentation et clarifier l'architecture avant le code.

### Tâches

1. **✅ Mettre à jour `docs/ARCHITECTURE_RBAC.md`**
   - Brainstorming complet adapté à NestJS
   - Tables RBAC & Plans (déjà dans Prisma)
   - Invariants et règles métier
   - Architecture NestJS (Guards, Services, Decorators)

2. **📝 Créer des diagrammes** (optionnel mais recommandé)
   - Diagramme ER (Prisma → DBML ou Mermaid)
   - Flow d'autorisation (User → Guard → RbacService → CASL)
   - Flow multi-org (Login → JWT → Switch Org)

3. **📋 Documenter l'existant**
   - Inventaire des guards actuels
   - Inventaire des services RBAC
   - Inventaire des permissions (seeder)

### Critères de succès
- ✅ `docs/ARCHITECTURE_RBAC.md` complet et orienté NestJS
- ✅ Plan d'implémentation NestJS créé
- ⬜ Diagrammes (optionnel)

---

## Phase 1 – Mise à niveau du modèle de données

**Objectif :** Compléter les seeders et utiliser tous les nouveaux champs Prisma (rank, role_type, is_locked, etc.).

### Tâches NestJS

1. **Migrer `prisma/seeders/roles.seeder.ts`**
   ```typescript
   // Remplacer:
   const systemRolesTemplates: RoleSeedData[] = [
     {
       code: 'SUPER_ADMIN',
       level: 0,  // ❌ OLD
       // ...
     }
   ];
   
   // Par:
   const systemRolesTemplates: RoleSeedData[] = [
     {
       code: 'SUPER_ADMIN',
       rank: 0,  // ✅ NEW
       is_root: true,
       is_platform: true,
       role_type: 'custom',  // ou créer un type 'root'
       is_locked: true,
       managed_by_template: true,
       permission_ceiling_scope: 'any',
     },
     {
       code: 'ADMIN',
       rank: 1,
       role_type: 'tenant_admin',
       is_locked: true,
       managed_by_template: true,
       permission_ceiling_scope: 'any',
     },
     // ... etc
   ];
   ```

2. **Compléter `prisma/seeders/permissions.seeder.ts`**
   ```typescript
   // Pour chaque permission, ajouter:
   const permissionsData: PermissionSeedData[] = [
     {
       code: 'events.read',
       // ✅ Ajouter ces champs:
       module_key: 'events',
       allowed_scopes: ['own', 'assigned', 'team', 'any'],
       default_scope_ceiling: 'any',
       resource: 'event',
       action: 'read',
       // ...
     },
   ];
   ```

3. **Créer un seeder pour Plans/Modules**
   ```typescript
   // prisma/seeders/plans.seeder.ts
   export async function seedPlans() {
     const plans = [
       { code: 'FREE', name: 'Free Plan', modules: ['events', 'attendees'] },
       { code: 'PRO', name: 'Pro Plan', modules: ['events', 'attendees', 'badges', 'reports'] },
       { code: 'ENTERPRISE', name: 'Enterprise', modules: 'all' },
     ];
     
     for (const plan of plans) {
       await prisma.plan.upsert({ ... });
       // Créer les PlanModule
     }
   }
   ```

4. **Créer une migration Prisma** (si besoin)
   ```bash
   npm run db:migrate -- --name update_rbac_fields
   ```

### Commandes à exécuter
```bash
# 1. Générer le client Prisma mis à jour
npm run db:generate

# 2. Appliquer les migrations
npm run db:migrate

# 3. Re-seeder
npm run db:seed

# 4. Vérifier en DB
npm run db:studio
```

### Critères de succès
- ⬜ Tous les rôles ont `rank`, `role_type`, `is_locked`, `managed_by_template`
- ⬜ Toutes les permissions ont `module_key`, `allowed_scopes`
- ⬜ Plans FREE, PRO, ENTERPRISE créés avec leurs modules
- ⬜ L'app démarre sans erreur (`npm run start:dev`)

---

## Phase 2 – PermissionRegistry TypeScript

**Objectif :** Créer la source de vérité unique pour toutes les permissions (TypeScript, pas seulement BDD).

### Tâches NestJS

1. **Créer `src/rbac/permission-registry.ts`**
   ```typescript
   // src/rbac/permission-registry.ts
   import { PermissionScope, RoleType } from '@prisma/client';
   
   export interface PermissionDefinition {
     module: string;
     resource: string;
     action: string;
     allowedScopes: PermissionScope[];
     defaultScopeCeiling: PermissionScope;
     defaultScopesByRoleType: Partial<Record<RoleType, PermissionScope>>;
     description?: string;
   }
   
   export const PERMISSION_REGISTRY: Record<string, PermissionDefinition> = {
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
       },
       description: 'Read events',
     },
     'event.create': {
       module: 'events',
       resource: 'event',
       action: 'create',
       allowedScopes: ['team', 'any'],
       defaultScopeCeiling: 'any',
       defaultScopesByRoleType: {
         tenant_admin: 'any',
         tenant_manager: 'any',
         tenant_staff: 'team',
       },
     },
     // ... +300 permissions à définir
   };
   
   // Helper pour obtenir la définition
   export function getPermissionDefinition(key: string): PermissionDefinition | null {
     return PERMISSION_REGISTRY[key] || null;
   }
   ```

2. **Créer un script de génération de seeder**
   ```typescript
   // scripts/generate-permissions-seeder.ts
   import { PERMISSION_REGISTRY } from '../src/rbac/permission-registry';
   import * as fs from 'fs';
   
   function generateSeeder() {
     const permissions = Object.entries(PERMISSION_REGISTRY).map(([code, def]) => ({
       code,
       module_key: def.module,
       resource: def.resource,
       action: def.action,
       allowed_scopes: def.allowedScopes,
       default_scope_ceiling: def.defaultScopeCeiling,
       description: def.description,
     }));
     
     const seederCode = `// AUTO-GENERATED - DO NOT EDIT
   export const PERMISSIONS_DATA = ${JSON.stringify(permissions, null, 2)};
   `;
     
     fs.writeFileSync('prisma/seeders/permissions.generated.ts', seederCode);
   }
   
   generateSeeder();
   ```

3. **Ajouter script dans `package.json`**
   ```json
   {
     "scripts": {
       "permissions:generate": "ts-node scripts/generate-permissions-seeder.ts",
       "db:seed:permissions": "ts-node prisma/seeders/seed-specific.ts permissions"
     }
   }
   ```

### Critères de succès
- ⬜ `PERMISSION_REGISTRY` créé avec au moins 50 permissions (à compléter progressivement)
- ⬜ Script de génération fonctionne
- ⬜ Registry utilisable dans le code TypeScript

---

## Phase 3 – AuthorizationService complet

**Objectif :** Créer le moteur central d'autorisation avec gestion complète des scopes et modules.

### Tâches NestJS

1. **Créer les types** dans `src/rbac/rbac.types.ts`
   ```typescript
   // src/rbac/rbac.types.ts (compléter l'existant)
   import { PermissionScope } from '@prisma/client';
   
   export interface ScopeContext {
     // Tenant context
     actorOrgId: string;
     actorUserId: string;
     actorTeamIds?: string[];
     
     // Resource context
     resourceOrgId?: string;
     resourceOwnerId?: string;
     resourceTeamId?: string;
     
     // Platform context
     isPlatformUser?: boolean;
     allowedOrgIds?: string[];  // Pour users plateforme
     
     // Module gating
     moduleKey?: string;
   }
   
   export interface AuthorizationContext extends ScopeContext {
     permissionKey: string;
     bypassRoot?: boolean;
   }
   
   export const SCOPE_ORDER: PermissionScope[] = ['none', 'own', 'assigned', 'team', 'any'];
   ```

2. **Refactoriser `src/rbac/rbac.service.ts`** (ou créer `authorization.service.ts`)
   ```typescript
   // src/rbac/authorization.service.ts
   import { Injectable } from '@nestjs/common';
   import { PrismaService } from '../prisma/prisma.service';
   import { PERMISSION_REGISTRY } from './permission-registry';
   import { AuthorizationContext, SCOPE_ORDER } from './rbac.types';
   import { PermissionScope } from '@prisma/client';
   
   @Injectable()
   export class AuthorizationService {
     constructor(
       private prisma: PrismaService,
       private modulesService: ModulesService,  // À créer Phase 4
     ) {}
     
     /**
      * Méthode principale : vérifie si un user peut faire une action
      */
     async can(
       user: any,  // JwtPayload ou User entity
       permissionKey: string,
       context: AuthorizationContext,
     ): Promise<boolean> {
       // 1. Bypass root
       if (context.bypassRoot !== false && (user.is_root || user.role === 'SUPER_ADMIN')) {
         return true;
       }
       
       // 2. Vérifier que la permission existe
       const permissionDef = PERMISSION_REGISTRY[permissionKey];
       if (!permissionDef) {
         console.warn(`Permission ${permissionKey} not found in registry`);
         return false;
       }
       
       // 3. Gating par module
       const moduleKey = context.moduleKey || permissionDef.module;
       if (moduleKey) {
         const isModuleEnabled = await this.modulesService.isModuleEnabledForTenant(
           context.actorOrgId,
           moduleKey,
         );
         if (!isModuleEnabled) {
           return false;
         }
       }
       
       // 4. Obtenir le meilleur scope pour cette permission
       const scope = await this.getBestScopeForPermission(
         user.id,
         context.actorOrgId,
         permissionKey,
       );
       
       if (!scope || scope === 'none') {
         return false;
       }
       
       // 5. Vérifier que le scope couvre le contexte
       return this.scopeCovers(scope, context, user.is_platform);
     }
     
     /**
      * Obtient le meilleur scope qu'un user a pour une permission dans une org
      */
     async getBestScopeForPermission(
       userId: string,
       orgId: string,
       permissionKey: string,
     ): Promise<PermissionScope | null> {
       // Récupérer tous les rôles du user dans cette org
       const userRoles = await this.prisma.userRole.findMany({
         where: {
           user_id: userId,
           org_id: orgId,
         },
         include: {
           role: {
             include: {
               rolePermissions: {
                 where: {
                   permission_code: permissionKey,
                 },
               },
             },
           },
         },
       });
       
       if (userRoles.length === 0) {
         return null;
       }
       
       // Trouver le scope le plus large (any > team > assigned > own)
       let bestScope: PermissionScope = 'none';
       
       for (const userRole of userRoles) {
         for (const rolePermission of userRole.role.rolePermissions) {
           const currentScope = rolePermission.scope;
           if (this.compareScopes(currentScope, bestScope) > 0) {
             bestScope = currentScope;
           }
         }
       }
       
       return bestScope === 'none' ? null : bestScope;
     }
     
     /**
      * Compare deux scopes : retourne 1 si a > b, -1 si a < b, 0 si égaux
      */
     private compareScopes(a: PermissionScope, b: PermissionScope): number {
       const indexA = SCOPE_ORDER.indexOf(a);
       const indexB = SCOPE_ORDER.indexOf(b);
       return indexA - indexB;
     }
     
     /**
      * Vérifie si un scope permet l'accès à une ressource selon le contexte
      */
     private scopeCovers(
       scope: PermissionScope,
       context: AuthorizationContext,
       isPlatformUser: boolean,
     ): boolean {
       // Pour les users plateforme
       if (isPlatformUser) {
         if (scope === 'any') {
           // Accès à tous les tenants
           return true;
         }
         if (scope === 'assigned') {
           // Seulement les orgs assignées
           return context.allowedOrgIds?.includes(context.resourceOrgId!) ?? false;
         }
         if (scope === 'own') {
           // Ressources créées par lui-même
           return context.resourceOwnerId === context.actorUserId;
         }
       }
       
       // Pour les users tenant
       if (scope === 'any') {
         // Tout dans l'org
         return context.resourceOrgId === context.actorOrgId;
       }
       
       if (scope === 'team') {
         // Même org + même team
         return (
           context.resourceOrgId === context.actorOrgId &&
           context.actorTeamIds?.includes(context.resourceTeamId!) === true
         );
       }
       
       if (scope === 'assigned') {
         // TODO: Vérifier dans une table d'assignation (event_access, etc.)
         return false;
       }
       
       if (scope === 'own') {
         // Même org + propriétaire
         return (
           context.resourceOrgId === context.actorOrgId &&
           context.resourceOwnerId === context.actorUserId
         );
       }
       
       return false;
     }
   }
   ```

3. **Améliorer `PermissionsGuard` existant**
   ```typescript
   // src/common/guards/permissions.guard.ts
   import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
   import { Reflector } from '@nestjs/core';
   import { AuthorizationService } from '../../rbac/authorization.service';
   import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
   
   @Injectable()
   export class PermissionsGuard implements CanActivate {
     constructor(
       private reflector: Reflector,
       private authorizationService: AuthorizationService,
     ) {}
     
     async canActivate(context: ExecutionContext): Promise<boolean> {
       // Lire les permissions depuis @Permissions()
       const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
         PERMISSIONS_KEY,
         [context.getHandler(), context.getClass()],
       );
       
       if (!requiredPermissions || requiredPermissions.length === 0) {
         return true;  // Pas de permission requise
       }
       
       const request = context.switchToHttp().getRequest();
       const user = request.user;
       
       if (!user) {
         throw new ForbiddenException('User not authenticated');
       }
       
       // Vérifier chaque permission avec AuthorizationService
       for (const permissionKey of requiredPermissions) {
         const authContext = {
           actorUserId: user.sub,
           actorOrgId: user.currentOrgId || user.orgId,
           // resourceOrgId, resourceOwnerId seront ajoutés par le controller si nécessaire
         };
         
         const allowed = await this.authorizationService.can(
           user,
           permissionKey,
           authContext,
         );
         
         if (allowed) {
           return true;  // Au moins une permission OK
         }
       }
       
       throw new ForbiddenException(
         `Insufficient permissions: ${requiredPermissions.join(', ')}`,
       );
     }
   }
   ```

   **Explication de l'approche :**
   - ✅ Utilise le decorator `@Permissions()` existant
   - ✅ Lit les metadata via `PERMISSIONS_KEY` 
   - ✅ Appelle `AuthorizationService.can()` pour chaque permission
   - ✅ `AuthorizationService` gère les scopes + gating module
   - ✅ Pas besoin de créer un nouveau decorator

4. **Extraction automatique du module_key**
   ```typescript
   // Dans AuthorizationService.can()
   async can(user, permissionKey, context): Promise<boolean> {
     // 1. Bypass root
     if (user.is_root) return true;
     
     // 2. Extraire moduleKey depuis le PermissionRegistry
     const permissionDef = PERMISSION_REGISTRY[permissionKey];
     if (!permissionDef) return false;
     
     const moduleKey = context.moduleKey || permissionDef.module;
     
     // 3. Gating par module
     const isModuleEnabled = await this.modulesService.isModuleEnabledForTenant(
       context.actorOrgId,
       moduleKey,
     );
     if (!isModuleEnabled) return false;
     
     // 4. Vérifier la permission + scope
     // ...
   }
   ```

### Critères de succès
         actorUserId: user.sub || user.id,
         actorTeamIds: user.teamIds || [],
         isPlatformUser: user.is_platform,
         // resourceOrgId, resourceOwnerId seront ajoutés par le controller si nécessaire
       };
       
       const allowed = await this.authorizationService.can(
         user,
         permissionKey,
         authContext,
       );
       
       if (!allowed) {
         throw new ForbiddenException(
           `Insufficient permissions: ${permissionKey}`,
         );
       }
       
       return true;
     }
   }
   ```

### Critères de succès
- ⬜ `AuthorizationService.can()` implémenté et testé
- ⬜ `PermissionsGuard` amélioré pour utiliser AuthorizationService
- ⬜ Gating par scope fonctionnel (own, assigned, team, any)
- ⬜ Tests unitaires pour `scopeCovers()` et `getBestScopeForPermission()`

---

## Phase 4 – Module Gating (Plans)

**Objectif :** Implémenter le gating par module selon le plan de l'organisation.

### Tâches NestJS

1. **Créer `ModulesService`**
   ```typescript
   // src/modules/plans/modules.service.ts
   import { Injectable } from '@nestjs/common';
   import { PrismaService } from '../prisma/prisma.service';
   
   @Injectable()
   export class ModulesService {
     constructor(private prisma: PrismaService) {}
     
     async isModuleEnabledForTenant(
       orgId: string,
       moduleKey: string,
     ): Promise<boolean> {
       // 1. Vérifier les overrides d'abord (priorité)
       const override = await this.prisma.orgModuleOverride.findUnique({
         where: {
           org_id_module_key: {
             org_id: orgId,
             module_key: moduleKey,
           },
         },
       });
       
       if (override) {
         return override.forced_status === 'enabled';
       }
       
       // 2. Vérifier le plan de l'org
       const org = await this.prisma.organization.findUnique({
         where: { id: orgId },
         include: {
           plan: {
             include: {
               planModules: {
                 where: {
                   module_key: moduleKey,
                 },
               },
             },
           },
         },
       });
       
       if (!org || !org.plan) {
         // Pas de plan = modules de base uniquement
         const coreModules = ['events', 'attendees'];
         return coreModules.includes(moduleKey);
       }
       
       const planModule = org.plan.planModules[0];
       return planModule?.is_included_by_default ?? false;
     }
     
     async getEnabledModulesForOrg(orgId: string): Promise<string[]> {
       // Implémentation similaire mais retourne tous les modules actifs
     }
   }
   ```

2. **Créer les controllers Plans** (admin uniquement)
   ```typescript
   // src/modules/plans/plans.controller.ts
   import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
   import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
   import { PermissionsGuard } from '../../common/guards/permissions.guard';
   import { Permissions } from '../../common/decorators/permissions.decorator';
   import { PlansService } from './plans.service';
   
   @Controller('admin/plans')
   @UseGuards(JwtAuthGuard, PermissionsGuard)
   export class PlansController {
     constructor(private plansService: PlansService) {}
     
     @Get()
     @Permissions('plans.read')
     async findAll() {
       return this.plansService.findAll();
     }
     
     @Post()
     @Permissions('plans.create')
     async create(@Body() createPlanDto: any) {
       return this.plansService.create(createPlanDto);
     }
     
     @Get(':id/modules')
     @Permissions('plans.read')
     async getModules(@Param('id') planId: string) {
       return this.plansService.getModules(planId);
     }
     
     @Post(':id/modules/:moduleKey')
     @Permissions('plans.manage_modules')
     async enableModule(
       @Param('id') planId: string,
       @Param('moduleKey') moduleKey: string,
     ) {
       return this.plansService.enableModule(planId, moduleKey);
     }
   }
   ```

3. **Ajouter permission plans dans Registry**
   ```typescript
   // src/rbac/permission-registry.ts
   export const PERMISSION_REGISTRY = {
     // ...
     'plans.read': {
       module: 'admin',
       resource: 'plan',
       action: 'read',
       allowedScopes: ['any'],
       defaultScopeCeiling: 'any',
       defaultScopesByRoleType: {
         tenant_admin: 'any',  // Peut voir son plan
         // support_L1/L2 peuvent voir tous les plans
       },
     },
     'plans.create': {
       module: 'admin',
       resource: 'plan',
       action: 'create',
       allowedScopes: ['any'],
       defaultScopeCeiling: 'any',
       defaultScopesByRoleType: {
         // Réservé aux root/super_admin
       },
     },
     'plans.manage_modules': {
       module: 'admin',
       resource: 'plan',
       action: 'manage_modules',
       allowedScopes: ['any'],
       defaultScopeCeiling: 'any',
     },
   };
   ```

### Critères de succès
- ⬜ `ModulesService.isModuleEnabledForTenant()` fonctionne
- ⬜ Gating intégré dans `AuthorizationService.can()`
- ⬜ Endpoints admin/plans fonctionnels
- ⬜ Tests: org avec plan FREE ne peut pas accéder au module 'badges'

---

## Phase 5 – Multi-org & JWT

**Objectif :** Permettre à un user d'avoir plusieurs orgs et de switcher entre elles.

### Tâches NestJS

1. **Mettre à jour le JWT Payload**
   ```typescript
   // src/auth/interfaces/jwt-payload.interface.ts
   export interface JwtPayload {
     sub: string;  // user.id
     email: string;
     
     // Multi-org
     currentOrgId: string;  // Org active
     availableOrgIds: string[];  // Toutes les orgs du user
     
     // Platform user
     is_platform: boolean;
     is_root: boolean;
     
     // Permissions (de l'org active)
     permissions: string[];  // Format: "permission.code:scope"
     role: string;  // Code du rôle principal
     
     iat: number;
     exp: number;
   }
   ```

2. **Adapter `AuthService.login()`**
   ```typescript
   // src/auth/auth.service.ts
   async login(user: User) {
     // Récupérer les orgs du user
     const orgUsers = await this.prisma.orgUser.findMany({
       where: { user_id: user.id, status: 'active' },
       include: { organization: true },
     });
     
     // Déterminer l'org par défaut
     const defaultOrg = orgUsers.find(ou => ou.is_default) || orgUsers[0];
     
     if (!defaultOrg && !user.is_platform) {
       throw new UnauthorizedException('User has no active organization');
     }
     
     const currentOrgId = defaultOrg?.org_id || null;
     
     // Récupérer les permissions pour cette org
     const permissions = await this.getPermissionsForUserInOrg(
       user.id,
       currentOrgId,
     );
     
     const payload: JwtPayload = {
       sub: user.id,
       email: user.email,
       currentOrgId,
       availableOrgIds: orgUsers.map(ou => ou.org_id),
       is_platform: user.is_platform,
       is_root: user.is_root,
       permissions: permissions.map(p => `${p.code}:${p.scope}`),
       role: 'ADMIN',  // TODO: déterminer le rôle principal
     };
     
     return {
       access_token: this.jwtService.sign(payload),
       user: { ...user, currentOrgId },
     };
   }
   
   private async getPermissionsForUserInOrg(
     userId: string,
     orgId: string,
   ): Promise<Array<{ code: string; scope: string }>> {
     const userRoles = await this.prisma.userRole.findMany({
       where: { user_id: userId, org_id: orgId },
       include: {
         role: {
           include: {
             rolePermissions: {
               include: {
                 permission: true,
               },
             },
           },
         },
       },
     });
     
     const permissionsMap = new Map<string, string>();
     
     for (const userRole of userRoles) {
       for (const rp of userRole.role.rolePermissions) {
         const existing = permissionsMap.get(rp.permission_code);
         // Garder le scope le plus large
         if (!existing || this.compareScopes(rp.scope, existing) > 0) {
           permissionsMap.set(rp.permission_code, rp.scope);
         }
       }
     }
     
     return Array.from(permissionsMap.entries()).map(([code, scope]) => ({
       code,
       scope,
     }));
   }
   ```

3. **Créer endpoint switch-org**
   ```typescript
   // src/auth/auth.controller.ts
   @Post('switch-org')
   @UseGuards(JwtAuthGuard)
   async switchOrg(
     @CurrentUser() user: any,
     @Body() body: { orgId: string },
   ) {
     // Vérifier que le user appartient à cette org
     const orgUser = await this.prisma.orgUser.findUnique({
       where: {
         user_id_org_id: {
           user_id: user.sub,
           org_id: body.orgId,
         },
       },
     });
     
     if (!orgUser || orgUser.status !== 'active') {
       throw new ForbiddenException('Access denied to this organization');
     }
     
     // Régénérer le token avec la nouvelle org
     return this.authService.switchOrganization(user.sub, body.orgId);
   }
   
   @Get('me/organizations')
   @UseGuards(JwtAuthGuard)
   async getMyOrganizations(@CurrentUser() user: any) {
     return this.prisma.orgUser.findMany({
       where: { user_id: user.sub },
       include: { organization: true },
     });
   }
   ```

### Critères de succès
- ⬜ JWT contient `currentOrgId` et `availableOrgIds`
- ⬜ Endpoint `POST /auth/switch-org` fonctionne
- ⬜ `GET /auth/me/organizations` retourne toutes les orgs
- ⬜ Permissions rechargées à chaque switch

---

## Phase 6 – Propagation automatique

**Objectif :** Créer un système de sync des permissions qui respecte les customisations.

### Tâches NestJS

1. **Créer `RoleProvisioningService`**
   ```typescript
   // src/rbac/role-provisioning.service.ts
   import { Injectable } from '@nestjs/common';
   import { PrismaService } from '../prisma/prisma.service';
   import { PERMISSION_REGISTRY } from './permission-registry';
   import { RoleType, PermissionScope } from '@prisma/client';
   
   @Injectable()
   export class RoleProvisioningService {
     constructor(private prisma: PrismaService) {}
     
     /**
      * Provisionne les rôles par défaut pour une nouvelle org
      */
     async provisionDefaultRoles(orgId: string): Promise<void> {
       const defaultRoles = [
         {
           code: 'ADMIN',
           name: 'Administrator',
           rank: 1,
           role_type: 'tenant_admin' as RoleType,
           is_locked: true,
           managed_by_template: true,
           permission_ceiling_scope: 'any' as PermissionScope,
         },
         {
           code: 'MANAGER',
           name: 'Manager',
           rank: 2,
           role_type: 'tenant_manager' as RoleType,
           is_locked: true,
           managed_by_template: true,
           permission_ceiling_scope: 'any' as PermissionScope,
         },
         {
           code: 'STAFF',
           name: 'Staff',
           rank: 3,
           role_type: 'tenant_staff' as RoleType,
           is_locked: true,
           managed_by_template: true,
           permission_ceiling_scope: 'team' as PermissionScope,
         },
       ];
       
       for (const roleData of defaultRoles) {
         const role = await this.prisma.role.upsert({
           where: {
             org_id_code: {
               org_id: orgId,
               code: roleData.code,
             },
           },
           create: {
             ...roleData,
             org_id: orgId,
           },
           update: {},
         });
         
         // Assigner les permissions selon le PermissionRegistry
         await this.assignDefaultPermissions(role.id, roleData.role_type);
       }
     }
     
     /**
      * Assigne les permissions par défaut selon le type de rôle
      */
     private async assignDefaultPermissions(
       roleId: string,
       roleType: RoleType,
     ): Promise<void> {
       const permissionsToAssign: Array<{
         permission_code: string;
         scope: PermissionScope;
       }> = [];
       
       for (const [code, def] of Object.entries(PERMISSION_REGISTRY)) {
         const scopeForRole = def.defaultScopesByRoleType[roleType];
         if (scopeForRole && scopeForRole !== 'none') {
           permissionsToAssign.push({
             permission_code: code,
             scope: scopeForRole,
           });
         }
       }
       
       // Upsert en bulk
       for (const perm of permissionsToAssign) {
         await this.prisma.rolePermission.upsert({
           where: {
             role_id_permission_code: {
               role_id: roleId,
               permission_code: perm.permission_code,
             },
           },
           create: {
             role_id: roleId,
             permission_code: perm.permission_code,
             scope: perm.scope,
           },
           update: {},
         });
       }
     }
     
     /**
      * Sync les permissions pour toutes les orgs (managed_by_template = true uniquement)
      */
     async syncAllOrganizations(): Promise<void> {
       const organizations = await this.prisma.organization.findMany();
       
       for (const org of organizations) {
         await this.syncPermissionsForOrg(org.id);
       }
     }
     
     /**
      * Sync les permissions pour une org (rôles managed uniquement)
      */
     async syncPermissionsForOrg(orgId: string): Promise<void> {
       const managedRoles = await this.prisma.role.findMany({
         where: {
           org_id: orgId,
           managed_by_template: true,
         },
       });
       
       for (const role of managedRoles) {
         // Supprimer les anciennes permissions
         await this.prisma.rolePermission.deleteMany({
           where: { role_id: role.id },
         });
         
         // Réassigner selon le Registry
         await this.assignDefaultPermissions(role.id, role.role_type);
       }
     }
   }
   ```

2. **Hook sur création d'org**
   ```typescript
   // src/modules/organizations/organizations.service.ts
   import { Injectable } from '@nestjs/common';
   import { EventEmitter2 } from '@nestjs/event-emitter';
   import { RoleProvisioningService } from '../../rbac/role-provisioning.service';
   
   @Injectable()
   export class OrganizationsService {
     constructor(
       private prisma: PrismaService,
       private eventEmitter: EventEmitter2,
       private roleProvisioning: RoleProvisioningService,
     ) {}
     
     async create(createOrgDto: any) {
       const org = await this.prisma.organization.create({
         data: createOrgDto,
       });
       
       // Provisionner les rôles par défaut
       await this.roleProvisioning.provisionDefaultRoles(org.id);
       
       // Émettre l'événement
       this.eventEmitter.emit('organization.created', { orgId: org.id });
       
       return org;
     }
   }
   ```

3. **CLI Command pour sync manuel**
   ```typescript
   // src/rbac/commands/sync-permissions.command.ts (avec nest-commander)
   import { Command, CommandRunner } from 'nest-commander';
   import { RoleProvisioningService } from '../role-provisioning.service';
   
   @Command({ name: 'rbac:sync-permissions' })
   export class SyncPermissionsCommand extends CommandRunner {
     constructor(private roleProvisioning: RoleProvisioningService) {
       super();
     }
     
     async run(): Promise<void> {
       console.log('🔄 Syncing permissions for all organizations...');
       await this.roleProvisioning.syncAllOrganizations();
       console.log('✅ Done!');
     }
   }
   ```

### Critères de succès
- ⬜ Nouvelle org reçoit automatiquement Admin/Manager/Staff
- ⬜ `npm run cli rbac:sync-permissions` fonctionne
- ⬜ Rôles custom (`managed_by_template = false`) non touchés
- ⬜ Rôles locked (`is_locked = true`) toujours managed

---

## Phase 7 – Migration module pilote (Events)

**Objectif :** Migrer un module existant pour utiliser le nouveau système.

### Tâches NestJS

1. **Refactoriser `EventsController`**
   ```typescript
   // src/modules/events/events.controller.ts
   import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
   import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
   import { PermissionsGuard } from '../../common/guards/permissions.guard';
   import { Permissions } from '../../common/decorators/permissions.decorator';
   import { CurrentUser } from '../../common/decorators/current-user.decorator';
   import { EventsService } from './events.service';
   
   @Controller('events')
   @UseGuards(JwtAuthGuard, PermissionsGuard)
   export class EventsController {
     constructor(private eventsService: EventsService) {}
     
     @Get()
     @Permissions('events.read')
     async findAll(@CurrentUser() user: any) {
       // Le guard a déjà vérifié la permission + module
       // Ici on applique le scope au niveau query
       return this.eventsService.findAllForUser(user);
     }
     
     @Post()
     @Permissions('events.create')
     async create(
       @CurrentUser() user: any,
       @Body() createEventDto: any,
     ) {
       return this.eventsService.create(user, createEventDto);
     }
     
     @Put(':id')
     @Permissions('events.update')
     async update(
       @CurrentUser() user: any,
       @Param('id') id: string,
       @Body() updateEventDto: any,
     ) {
       return this.eventsService.update(user, id, updateEventDto);
     }
     
     @Delete(':id')
     @Permissions('events.delete')
     async delete(
       @CurrentUser() user: any,
       @Param('id') id: string,
     ) {
       return this.eventsService.delete(user, id);
     }
   }
   ```

2. **Adapter le service pour scope filtering**
   ```typescript
   // src/modules/events/events.service.ts
   import { Injectable, ForbiddenException } from '@nestjs/common';
   import { PrismaService } from '../prisma/prisma.service';
   import { AuthorizationService } from '../../rbac/authorization.service';
   
   @Injectable()
   export class EventsService {
     constructor(
       private prisma: PrismaService,
       private authz: AuthorizationService,
     ) {}
     
     async findAllForUser(user: any) {
       const scope = await this.authz.getBestScopeForPermission(
         user.sub,
         user.currentOrgId,
         'events.read',
       );
       
       // Construire le where selon le scope
       const where: any = { org_id: user.currentOrgId };
       
       if (scope === 'own') {
         where.created_by = user.sub;
       } else if (scope === 'team') {
         where.team_id = { in: user.teamIds };
       } else if (scope === 'assigned') {
         // Joindre avec event_access
         where.eventAccess = {
           some: { user_id: user.sub },
         };
       }
       // Si scope === 'any', pas de filtre supplémentaire
       
       return this.prisma.event.findMany({ where });
     }
     
     async update(user: any, eventId: string, data: any) {
       // Vérifier que le user a le droit de modifier cet event
       const event = await this.prisma.event.findUnique({
         where: { id: eventId },
       });
       
       if (!event) {
         throw new NotFoundException('Event not found');
       }
       
       const canUpdate = await this.authz.can(user, 'events.update', {
         actorOrgId: user.currentOrgId,
         actorUserId: user.sub,
         resourceOrgId: event.org_id,
         resourceOwnerId: event.created_by,
         moduleKey: 'events',
       });
       
       if (!canUpdate) {
         throw new ForbiddenException('Cannot update this event');
       }
       
       return this.prisma.event.update({
         where: { id: eventId },
         data,
       });
     }
   }
   ```

### Critères de succès
- ⬜ Module Events n'a plus de checks manuels (`if (user.role === 'ADMIN')`)
- ⬜ Utilise `@Permissions()` sur tous les endpoints
- ⬜ Scope filtering dans les queries
- ⬜ Tests avec différents rôles (Admin, Manager, Staff)

---

## Phase 8 – Frontend Ability Service

**Objectif :** Synchroniser l'UI avec le backend.

### Tâches

1. **Créer endpoint backend**
   ```typescript
   // src/auth/auth.controller.ts
   @Get('me/permissions')
   @UseGuards(JwtAuthGuard)
   async getMyPermissions(@CurrentUser() user: any) {
     const permissions = await this.authService.getPermissionsForUserInOrg(
       user.sub,
       user.currentOrgId,
     );
     
     const modules = await this.modulesService.getEnabledModulesForOrg(
       user.currentOrgId,
     );
     
     return {
       permissions: permissions.map(p => `${p.code}:${p.scope}`),
       modules: modules.map(m => m.key),
       orgId: user.currentOrgId,
       isRoot: user.is_root,
       isPlatform: user.is_platform,
     };
   }
   ```

2. **Frontend Ability Service** (React/Vue/Angular)
   ```typescript
   // frontend/src/services/ability.service.ts
   class AbilityService {
     private permissions: Set<string> = new Set();
     private modules: Set<string> = new Set();
     
     async refresh() {
       const response = await axios.get('/api/auth/me/permissions');
       this.permissions = new Set(response.data.permissions);
       this.modules = new Set(response.data.modules);
     }
     
     can(permissionKey: string, scope?: string): boolean {
       if (scope) {
         return this.permissions.has(`${permissionKey}:${scope}`);
       }
       // Vérifie si la permission existe avec n'importe quel scope
       return Array.from(this.permissions).some(p => 
         p.startsWith(`${permissionKey}:`)
       );
     }
     
     canUse(moduleKey: string): boolean {
       return this.modules.has(moduleKey);
     }
   }
   
   export const ability = new AbilityService();
   ```

3. **Utiliser dans les composants**
   ```tsx
   // React example
   import { ability } from '../services/ability.service';
   
   function EventsPage() {
     const canCreate = ability.can('events.create');
     const canExport = ability.can('events.export');
     
     return (
       <div>
         {canCreate && <button>Create Event</button>}
         {canExport && <button>Export</button>}
       </div>
     );
   }
   ```

### Critères de succès
- ⬜ Endpoint `/auth/me/permissions` retourne les données
- ⬜ `AbilityService` créé côté frontend
- ⬜ Au moins un module (Events) utilise le service
- ⬜ Boutons cachés si pas de permission

---

## 📋 Checklist globale

### Phase 0 - Documentation
- ✅ `docs/ARCHITECTURE_RBAC.md` mis à jour
- ✅ `docs/PLAN_IMPLEMENTATION_RBAC_NESTJS.md` créé
- ⬜ Diagrammes (optionnel)

### Phase 1 - Modèle de données
- ⬜ Seeders migrés (`level` → `rank`)
- ⬜ Tous les champs RBAC remplis
- ⬜ Plans FREE/PRO/ENTERPRISE créés

### Phase 2 - PermissionRegistry
- ⬜ `permission-registry.ts` créé
- ⬜ Script de génération seeder
- ⬜ Au moins 50 permissions définies

### Phase 3 - AuthorizationService
- ⬜ `AuthorizationService.can()` complet
- ⬜ `scopeCovers()` implémenté
- ⬜ `PermissionsGuard` amélioré
- ⬜ Tests unitaires

### Phase 4 - Module Gating
- ⬜ `ModulesService` créé
- ⬜ Gating intégré dans `AuthorizationService`
- ⬜ Endpoints admin/plans
- ⬜ Tests gating

### Phase 5 - Multi-org
- ⬜ JWT multi-org
- ⬜ `POST /auth/switch-org`
- ⬜ `GET /auth/me/organizations`
- ⬜ Permissions rechargées

### Phase 6 - Propagation
- ⬜ `RoleProvisioningService`
- ⬜ Hook création org
- ⬜ CLI command sync
- ⬜ Tests propagation

### Phase 7 - Module pilote
- ⬜ EventsController migré
- ⬜ Scope filtering
- ⬜ Tests avec différents rôles

### Phase 8 - Frontend
- ⬜ Endpoint `/auth/me/permissions`
- ⬜ `AbilityService` frontend
- ⬜ Un module utilise le service
- ⬜ Gestion 403

---

## 🚀 Ordre de priorité recommandé

1. **Phase 0** (2-3 jours) - Documentation ✅
2. **Phase 1** (3-5 jours) - Seeders et modèle
3. **Phase 2** (5-7 jours) - PermissionRegistry
4. **Phase 3** (7-10 jours) - AuthorizationService (le plus critique)
5. **Phase 7** (3-4 jours) - Module pilote (validation)
6. **Phase 4** (4-6 jours) - Module Gating
7. **Phase 5** (10-15 jours) - Multi-org
8. **Phase 6** (4-5 jours) - Propagation
9. **Phase 8** (10-12 jours) - Frontend

**Estimation totale : 8-10 semaines** (1 développeur full-time)

---

## ⚠️ Points d'attention NestJS

1. **Dependency Injection** : Attention aux imports circulaires entre `AuthorizationService`, `ModulesService`, `PrismaService`
   - Solution : Utiliser `@Inject(forwardRef(() => ModulesService))` si nécessaire

2. **Guards Order** : L'ordre des guards est important
   ```typescript
   @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
   ```

3. **Exception Filters** : Créer un filter global pour les 403
   ```typescript
   @Catch(ForbiddenException)
   export class ForbiddenExceptionFilter implements ExceptionFilter {
     catch(exception: ForbiddenException, host: ArgumentsHost) {
       const ctx = host.switchToHttp();
       const response = ctx.getResponse();
       
       response.status(403).json({
         statusCode: 403,
         message: exception.message,
         error: 'Forbidden',
         timestamp: new Date().toISOString(),
       });
     }
   }
   ```

4. **Performance** : Cache les permissions dans Redis
   ```typescript
   @Injectable()
   export class AuthorizationService {
     async getBestScopeForPermission(userId, orgId, permKey) {
       const cacheKey = `perms:${userId}:${orgId}:${permKey}`;
       const cached = await this.redis.get(cacheKey);
       if (cached) return cached;
       
       // ... query DB ...
       
       await this.redis.set(cacheKey, result, 'EX', 300); // 5min
       return result;
     }
   }
   ```

5. **Tests** : Utiliser les utilitaires NestJS
   ```typescript
   describe('AuthorizationService', () => {
     let service: AuthorizationService;
     let prisma: PrismaService;
     
     beforeEach(async () => {
       const module: TestingModule = await Test.createTestingModule({
         providers: [
           AuthorizationService,
           {
             provide: PrismaService,
             useValue: mockPrismaService,
           },
         ],
       }).compile();
       
       service = module.get<AuthorizationService>(AuthorizationService);
     });
     
     it('should allow admin with scope any', async () => {
       const result = await service.can(adminUser, 'events.read', context);
       expect(result).toBe(true);
     });
   });
   ```

---

## 📚 Ressources

- **Prisma** : https://www.prisma.io/docs
- **NestJS Guards** : https://docs.nestjs.com/guards
- **CASL** : https://casl.js.org/v6/en/
- **nest-commander** (pour CLI) : https://docs.nestjs.com/recipes/nest-commander
- **@nestjs/event-emitter** (pour hooks) : https://docs.nestjs.com/techniques/events

---

**Prochaine étape : Commencer par Phase 1 (Seeders) ! 🎯**
