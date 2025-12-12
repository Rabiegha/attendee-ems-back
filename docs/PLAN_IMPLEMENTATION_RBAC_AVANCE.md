# Plan d'implémentation RBAC Avancé avec Guards Séparés

Ce document décrit le plan d'implémentation du système RBAC avancé avec l'approche **Guards séparés** et décorateur **`@RequirePermission()`**.

---

## Décision architecturale : Approche avancée

**Choix stratégique :** Nouveau décorateur `@RequirePermission()` + Guards séparés

### Pourquoi cette approche ?

1. **Séparation des responsabilités** : Chaque Guard a une seule responsabilité
2. **Composabilité maximale** : Combinaison flexible des Guards selon les besoins
3. **Testabilité** : Tests unitaires simples pour chaque Guard
4. **Évolutivité** : Extension facile sans risque de régression
5. **Auto-documentation** : Code explicite et lisible

### Architecture cible

```typescript
// Pipeline de Guards
1. JwtAuthGuard          → Authentification
2. TenantContextGuard    → Multi-tenant + Context
3. ModuleGatingGuard     → Gating modules
4. RequirePermissionGuard → Permission + scope

// Décorateurs
@RequirePermission(key, options?)  // Principal
@RequireModule(moduleKey)          // Gating explicite
@ScopeContext(builder)             // Context custom
```

---

## Phase 0 – Architecture (2-3 jours)

### Objectif
Documenter l'architecture complète avec Guards séparés.

### Tâches

1. ✅ **Mettre à jour `ARCHITECTURE_RBAC.md`**
   - Documenter le pipeline de Guards
   - Documenter les décorateurs (`@RequirePermission`, `@RequireModule`, `@ScopeContext`)
   - Exemples concrets d'utilisation
   - Algorithmes des services (AuthorizationService, ModulesService)

2. ✅ **Créer `PLAN_IMPLEMENTATION_RBAC_AVANCE.md`** (ce document)
   - Plan détaillé phase par phase
   - Checklists de validation
   - Exemples de code pour chaque phase

3. **Créer diagrammes d'architecture**
   - Pipeline de Guards (Mermaid)
   - Flux d'autorisation
   - Relations entre services

### Done quand

- ✅ Documentation complète et claire
- ✅ Équipe comprend l'architecture
- ✅ Diagrammes créés

---

## Phase 1 – Modèle de données RBAC (3-5 jours)

### Objectif
Mettre en place les tables et remplir les champs RBAC avancés dans les seeders.

### Tâches

1. **Vérifier le schéma Prisma**
   - ✅ Tables `OrgUser`, `UserRole`, `PlatformUserOrgAccess` existantes
   - ✅ Tables `Plan`, `Module`, `PlanModule`, `OrgModuleOverride` existantes

2. **Mettre à jour `prisma/seeders/roles.seeder.ts`**
   - Remplacer `level` par `rank`
   - Ajouter `role_type` : `tenant_admin`, `tenant_manager`, `tenant_staff`, `custom`
   - Ajouter `is_platform`, `is_root`, `is_locked`, `managed_by_template`
   - Ajouter `permission_ceiling_scope` : `own`, `team`, `org`, `any`

   ```typescript
   // Exemple de rôle Admin
   {
     code: 'ADMIN',
     name: 'Administrateur',
     rank: 1,
     role_type: 'tenant_admin',
     is_platform: false,
     is_root: false,
     is_locked: true,
     managed_by_template: true,
     permission_ceiling_scope: 'any',
     org_id: orgId
   }
   ```

3. **Mettre à jour `prisma/seeders/permissions.seeder.ts`**
   - Ajouter `module_key` pour toutes les permissions
   - Ajouter `allowed_scopes` : array des scopes autorisés
   - Ajouter `default_scope_ceiling` : plafond par défaut

   ```typescript
   // Exemple permission
   {
     code: 'event.read',
     description: 'Lire les événements',
     resource: 'event',
     action: 'read',
     module_key: 'events',
     allowed_scopes: ['own', 'assigned', 'team', 'org', 'any'],
     default_scope_ceiling: 'org'
   }
   ```

4. **Créer migration pour nouveaux champs**
   - Migration pour ajouter colonnes `rank`, `role_type`, etc. dans `Role`
   - Migration pour ajouter colonnes `module_key`, `allowed_scopes` dans `Permission`
   - Migration pour ajouter colonne `scope` dans `RolePermission`

5. **Vérifier les indexes**
   - Index composite sur `(user_id, org_id)` dans `OrgUser`
   - Index composite sur `(user_id, org_id, role_id)` dans `UserRole`
   - Index sur `(plan_id, module_key)` dans `PlanModule`
   - Index sur `(org_id, module_key)` dans `OrgModuleOverride`

### Done quand

- ✅ Migrations passent sans erreur
- ✅ Seeders remplissent tous les champs RBAC
- ✅ `npm run seed` fonctionne correctement
- ✅ App démarre avec l'ancien système (pas encore touché)

---

## Phase 2 – PermissionRegistry + Types (5-7 jours)

### Objectif
Créer la source de vérité TypeScript pour toutes les permissions.

### Tâches

1. **Créer `src/rbac/rbac.types.ts`**

   ```typescript
   export type Scope = 'own' | 'assigned' | 'team' | 'org' | 'any';
   
   export type RoleType = 
     | 'tenant_admin' 
     | 'tenant_manager' 
     | 'tenant_staff' 
     | 'support_L1' 
     | 'support_L2' 
     | 'custom';
   
   export interface ScopeContext {
     resourceTenantId?: string;   // Org de la ressource
     actorTenantId: string;       // Org de l'acteur
     resourceOwnerId?: string;    // Propriétaire de la ressource
     actorUserId: string;         // ID de l'acteur
     resourceTeamId?: string;     // Team de la ressource
     actorTeamIds?: string[];     // Teams de l'acteur
   }
   
   export interface PermissionDefinition {
     module: string;
     allowedScopes: Scope[];
     defaultScopeCeiling: Scope;
     defaultScopesByRoleType: Partial<Record<RoleType, Scope>>;
     description?: string;
   }
   
   export interface UserPayload {
     id: string;
     email: string;
     currentOrgId: string;
     is_root?: boolean;
     is_platform?: boolean;
     teams?: string[];
   }
   
   export const SCOPE_ORDER: Scope[] = ['own', 'assigned', 'team', 'org', 'any'];
   ```

2. **Créer `src/rbac/permission-registry.ts`**
   - Définir toutes les 315+ permissions
   - Grouper par module (events, attendees, badges, users, roles, etc.)
   - Définir `allowedScopes`, `defaultScopeCeiling`, `defaultScopesByRoleType`

   ```typescript
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
     // ... 315+ permissions
   };
   
   // Helper pour extraire le module d'une permission
   export function getModuleFromPermission(permissionKey: string): string {
     const def = PERMISSION_REGISTRY[permissionKey];
     if (!def) {
       throw new Error(`Permission ${permissionKey} not found in registry`);
     }
     return def.module;
   }
   ```

3. **Créer script de synchronisation `scripts/sync-permissions.ts`**
   - Lit le `PERMISSION_REGISTRY`
   - Upsert les permissions dans la table `Permission`
   - Optionnel : Créer les modules dans la table `Module`

   ```typescript
   async function syncPermissions() {
     for (const [key, def] of Object.entries(PERMISSION_REGISTRY)) {
       await prisma.permission.upsert({
         where: { code: key },
         create: {
           code: key,
           description: def.description || '',
           resource: key.split('.')[0],
           action: key.split('.')[1],
           module_key: def.module,
           allowed_scopes: def.allowedScopes,
           default_scope_ceiling: def.defaultScopeCeiling,
         },
         update: {
           module_key: def.module,
           allowed_scopes: def.allowedScopes,
           default_scope_ceiling: def.defaultScopeCeiling,
         },
       });
     }
   }
   ```

### Done quand

- ✅ `PERMISSION_REGISTRY` complet avec 315+ permissions
- ✅ Types TypeScript définis et exportés
- ✅ Script `sync-permissions.ts` fonctionnel
- ✅ `npm run permissions:sync` exécute sans erreur

---

## Phase 3 – AuthorizationService + ModulesService (7-10 jours)

### Objectif
Créer les services centraux d'autorisation.

### Tâches

1. **Créer `src/rbac/modules.service.ts`**

   ```typescript
   @Injectable()
   export class ModulesService {
     constructor(private prisma: PrismaService) {}
   
     async isModuleEnabledForTenant(
       tenantId: string,
       moduleKey: string,
     ): Promise<boolean> {
       // 1. Vérifier override spécifique
       const override = await this.prisma.orgModuleOverride.findUnique({
         where: {
           org_id_module_key: { org_id: tenantId, module_key: moduleKey },
         },
       });
   
       if (override) {
         return override.forced_status === 'enabled';
       }
   
       // 2. Vérifier plan de l'org
       const org = await this.prisma.organization.findUnique({
         where: { id: tenantId },
         include: { plan: { include: { plan_modules: true } } },
       });
   
       if (!org?.plan) return false;
   
       // 3. Vérifier si module dans le plan
       const planModule = org.plan.plan_modules.find(
         (pm) => pm.module_key === moduleKey,
       );
   
       return planModule?.is_included_by_default ?? false;
     }
   }
   ```

2. **Créer `src/rbac/authorization.service.ts`**

   ```typescript
   @Injectable()
   export class AuthorizationService {
     constructor(
       private prisma: PrismaService,
       private modulesService: ModulesService,
     ) {}
   
     /**
      * Méthode principale : vérifie si un user peut faire une action
      */
   async can(
     user: UserPayload,
     permissionKey: string,
     context: ScopeContext,
   ): Promise<boolean> {
     // 1. Bypass is_root
     if (user.is_root) return true;

     // 2. Extraire le module de la permission
     const moduleKey = getModuleFromPermission(permissionKey);

     // 3. Vérifier que le module est activé
     const moduleEnabled = await this.modulesService.isModuleEnabledForTenant(
       context.actorTenantId,
       moduleKey,
     );
     if (!moduleEnabled) {
       throw new ForbiddenException(
         `Module '${moduleKey}' is not enabled for your organization`,
       );
     }

     // 4. Vérifier tenant vs plateforme
     if (!user.is_platform) {
       // User tenant : doit être dans l'org
       const isMember = await this.isTenantMember(
         user.id,
         context.actorTenantId,
       );
       if (!isMember) {
         throw new ForbiddenException('Not a member of this organization');
       }
     } else {
       // User plateforme : vérifier accès si scope != any
       const hasAccess = await this.hasPlatformAccess(
         user.id,
         context.resourceTenantId || context.actorTenantId,
       );
       if (!hasAccess) {
         throw new ForbiddenException('No access to this organization');
       }
     }

     // 5. Récupérer le meilleur scope pour cette permission
     const bestScope = await this.getBestScopeForPermission(
       user.id,
       permissionKey,
       context.actorTenantId,
     );
     if (!bestScope) {
       throw new ForbiddenException(
         `Permission '${permissionKey}' not granted`,
       );
     }

     // 6. Vérifier si le scope couvre le contexte
     const covers = this.scopeCovers(bestScope, context);
     if (!covers) {
       throw new ForbiddenException(
         `Insufficient scope for '${permissionKey}' (have: ${bestScope}, need: broader)`,
       );
     }

     return true;
   }     /**
      * Récupère le meilleur scope qu'un user a pour une permission
      */
     async getBestScopeForPermission(
       userId: string,
       permissionKey: string,
       orgId: string,
     ): Promise<Scope | null> {
       // Récupérer tous les rôles du user dans cette org
       const userRoles = await this.prisma.userRole.findMany({
         where: { user_id: userId, org_id: orgId },
         include: {
           role: {
             include: {
               role_permissions: {
                 where: { permission_code: permissionKey },
               },
             },
           },
         },
       });
   
       // Collecter tous les scopes disponibles
       const scopes: Scope[] = [];
       for (const ur of userRoles) {
         for (const rp of ur.role.role_permissions) {
           if (rp.scope) {
             scopes.push(rp.scope as Scope);
           }
         }
       }
   
       if (scopes.length === 0) return null;
   
       // Retourner le scope le plus large
       return this.getHighestScope(scopes);
     }
   
     /**
      * Vérifie si un scope couvre un contexte donné
      */
     scopeCovers(scopeLimit: Scope, context: ScopeContext): boolean {
       switch (scopeLimit) {
         case 'any':
           return true;
   
         case 'org':
           return context.resourceTenantId === context.actorTenantId;
   
         case 'team':
           if (!context.resourceTeamId || !context.actorTeamIds) return false;
           return context.actorTeamIds.includes(context.resourceTeamId);
   
         case 'assigned':
           // Logique custom : vérifier si ressource assignée au user
           // TODO : implémenter selon votre modèle
           return false;
   
         case 'own':
           return context.resourceOwnerId === context.actorUserId;
   
         default:
           return false;
       }
     }
   
     private async isTenantMember(
       userId: string,
       orgId: string,
     ): Promise<boolean> {
       const orgUser = await this.prisma.orgUser.findUnique({
         where: { user_id_org_id: { user_id: userId, org_id: orgId } },
       });
       return !!orgUser;
     }
   
     private async hasPlatformAccess(
       userId: string,
       orgId: string,
     ): Promise<boolean> {
       // Vérifier si user plateforme a accès à cette org
       const access = await this.prisma.platformUserOrgAccess.findFirst({
         where: { user_id: userId, org_id: orgId },
       });
       return !!access;
     }
   
     private getHighestScope(scopes: Scope[]): Scope {
       let highest: Scope = 'own';
       for (const scope of scopes) {
         if (SCOPE_ORDER.indexOf(scope) > SCOPE_ORDER.indexOf(highest)) {
           highest = scope;
         }
       }
       return highest;
     }
   }
   ```

3. **Tests unitaires pour `AuthorizationService`**
   - Test : `is_root` bypass toutes les vérifications
   - Test : User tenant ne peut pas accéder hors de son org
   - Test : Module désactivé refuse l'accès
   - Test : Scope `any` autorise tout
   - Test : Scope `own` autorise uniquement ownership
   - Test : Scope `org` autorise dans la même org

### Done quand

- ✅ `ModulesService.isModuleEnabledForTenant()` implémenté
- ✅ `AuthorizationService.can()` implémenté
- ✅ Tests unitaires passent
- ✅ Script de test manuel fonctionne

---

## Phase 4 – Guards NestJS (5-7 jours)

### Objectif
Créer les Guards séparés pour implémenter le pipeline d'autorisation.

### Tâches

1. **Créer `src/common/guards/tenant-context.guard.ts`**

   ```typescript
   @Injectable()
   export class TenantContextGuard implements CanActivate {
     constructor(private prisma: PrismaService) {}
   
     async canActivate(context: ExecutionContext): Promise<boolean> {
       const request = context.switchToHttp().getRequest();
       const user = request.user;
   
       if (!user) {
         throw new UnauthorizedException('User not authenticated');
       }
   
       // Vérifier que currentOrgId est valide
       if (!user.currentOrgId) {
         throw new BadRequestException('No organization selected');
       }
   
       // Vérifier appartenance si user tenant
       if (!user.is_platform && !user.is_root) {
         const orgUser = await this.prisma.orgUser.findUnique({
           where: {
             user_id_org_id: {
               user_id: user.id,
               org_id: user.currentOrgId,
             },
           },
         });
   
         if (!orgUser) {
           throw new ForbiddenException('Not a member of this organization');
         }
       }
   
       return true;
     }
   }
   ```

2. **Créer `src/common/guards/module-gating.guard.ts`**

   ```typescript
   @Injectable()
   export class ModuleGatingGuard implements CanActivate {
     constructor(
       private reflector: Reflector,
       private modulesService: ModulesService,
     ) {}
   
     async canActivate(context: ExecutionContext): Promise<boolean> {
       const requiredModule = this.reflector.get<string>(
         REQUIRE_MODULE_KEY,
         context.getHandler(),
       );
   
       if (!requiredModule) {
         return true; // Pas de module requis
       }
   
       const request = context.switchToHttp().getRequest();
       const user = request.user;
   
       const isEnabled = await this.modulesService.isModuleEnabledForTenant(
         user.currentOrgId,
         requiredModule,
       );
   
       if (!isEnabled) {
         throw new ForbiddenException(
           `Module ${requiredModule} is not enabled for your organization`,
         );
       }
   
       return true;
     }
   }
   ```

3. **Créer `src/common/guards/require-permission.guard.ts`**

   ```typescript
   export interface RequirePermissionOptions {
     scope?: Scope;
     resourceIdParam?: string;
     checkOwnership?: boolean;
     allowPlatform?: boolean;
   }
   
   @Injectable()
   export class RequirePermissionGuard implements CanActivate {
     constructor(
       private reflector: Reflector,
       private authorizationService: AuthorizationService,
     ) {}
   
     async canActivate(context: ExecutionContext): Promise<boolean> {
       const metadata = this.reflector.get<{
         key: string;
         options?: RequirePermissionOptions;
       }>(REQUIRE_PERMISSION_KEY, context.getHandler());
   
       if (!metadata) {
         return true; // Pas de permission requise
       }
   
       const request = context.switchToHttp().getRequest();
       const user: UserPayload = request.user;
       const { key: permissionKey, options } = metadata;
   
       // Construire le ScopeContext
       const scopeContext = await this.buildScopeContext(
         request,
         user,
         options,
       );
   
       // Vérifier l'autorisation
       const allowed = await this.authorizationService.can(
         user,
         permissionKey,
         scopeContext,
       );
   
       if (!allowed) {
         throw new ForbiddenException(
           `Insufficient permissions: ${permissionKey}`,
         );
       }
   
       return true;
     }
   
     private async buildScopeContext(
       request: any,
       user: UserPayload,
       options?: RequirePermissionOptions,
     ): Promise<ScopeContext> {
       const context: ScopeContext = {
         actorTenantId: user.currentOrgId,
         actorUserId: user.id,
         actorTeamIds: user.teams || [],
       };
   
       // Si resourceIdParam fourni, extraire resourceTenantId
       if (options?.resourceIdParam) {
         const resourceId = request.params[options.resourceIdParam];
         if (resourceId) {
           // TODO: Fetch resource to get tenantId and ownerId
           // context.resourceTenantId = resource.org_id;
           // context.resourceOwnerId = resource.created_by;
         }
       }
   
       return context;
     }
   }
   ```

4. **Créer les décorateurs `src/common/decorators/`**

   ```typescript
   // require-permission.decorator.ts
   export const REQUIRE_PERMISSION_KEY = 'require_permission';
   
   export const RequirePermission = (
     key: string,
     options?: RequirePermissionOptions,
   ) => SetMetadata(REQUIRE_PERMISSION_KEY, { key, options });
   
   // require-module.decorator.ts
   export const REQUIRE_MODULE_KEY = 'require_module';
   
   export const RequireModule = (moduleKey: string) =>
     SetMetadata(REQUIRE_MODULE_KEY, moduleKey);
   
   // scope-context.decorator.ts
   export const SCOPE_CONTEXT_KEY = 'scope_context';
   
   export const ScopeContext = (
     builder: (req: any, params: any) => ScopeContext,
   ) => SetMetadata(SCOPE_CONTEXT_KEY, builder);
   ```

### Done quand

- ✅ Les 3 Guards créés et fonctionnels
- ✅ Décorateurs créés
- ✅ Tests unitaires pour chaque Guard
- ✅ Pipeline complet testé

---

## Phase 5 – Migration module pilote : Events (3-4 jours)

### Objectif
Migrer le module Events pour utiliser les nouveaux Guards et décorateurs.

### Tâches

1. **Migrer `src/modules/events/events.controller.ts`**

   ```typescript
   // AVANT
   @Get()
   @UseGuards(JwtAuthGuard, PermissionsGuard)
   @Permissions('event.read')
   async findAll(@Req() req) {
     if (req.user.role === 'SUPER_ADMIN') {
       // ...
     }
   }
   
   // APRÈS
   @Get()
   @UseGuards(
     JwtAuthGuard,
     TenantContextGuard,
     ModuleGatingGuard,
     RequirePermissionGuard,
   )
   @RequirePermission('event.read')
   async findAll() {
     // Plus de checks manuels
   }
   
   @Post()
   @UseGuards(
     JwtAuthGuard,
     TenantContextGuard,
     ModuleGatingGuard,
     RequirePermissionGuard,
   )
   @RequirePermission('event.create', { scope: 'org' })
   async create(@Body() dto: CreateEventDto) { }
   
   @Patch(':id')
   @UseGuards(
     JwtAuthGuard,
     TenantContextGuard,
     ModuleGatingGuard,
     RequirePermissionGuard,
   )
   @RequirePermission('event.update', {
     resourceIdParam: 'id',
     checkOwnership: true,
   })
   async update(@Param('id') id: string, @Body() dto: UpdateEventDto) { }
   
   @Delete(':id')
   @UseGuards(
     JwtAuthGuard,
     TenantContextGuard,
     ModuleGatingGuard,
     RequirePermissionGuard,
   )
   @RequirePermission('event.delete', { scope: 'any' })
   async delete(@Param('id') id: string) { }
   ```

2. **Supprimer tous les checks manuels dans le service**
   - ❌ `if (user.role === 'SUPER_ADMIN')`
   - ❌ `const allowAny = req.user.permissions?.some(...)`
   - ✅ Laisser uniquement la logique métier

3. **Tests E2E pour le module Events**
   - Test : Admin peut tout faire (scope any)
   - Test : Manager peut lire/modifier dans son org (scope org)
   - Test : Staff peut lire/modifier dans sa team (scope team)
   - Test : User custom peut uniquement lire ce qu'il a créé (scope own)
   - Test : Module désactivé refuse l'accès

### Done quand

- ✅ Module Events migré complètement
- ✅ Aucun check manuel restant
- ✅ Tests E2E passent
- ✅ Différents rôles testés manuellement

---

## Phase 6 – Propagation automatique des rôles (4-5 jours)

### Objectif
Créer le système de provisioning automatique des rôles clés par organisation.

### Tâches

1. **Créer `scripts/sync-roles.ts`**

   ```typescript
   async function syncRolesForOrg(orgId: string) {
     // Définir les rôles clés
     const keyRoles = [
       {
         code: 'ADMIN',
         name: 'Administrateur',
         rank: 1,
         role_type: 'tenant_admin',
         is_locked: true,
         managed_by_template: true,
         permission_ceiling_scope: 'any',
       },
       {
         code: 'MANAGER',
         name: 'Manager',
         rank: 2,
         role_type: 'tenant_manager',
         is_locked: true,
         managed_by_template: true,
         permission_ceiling_scope: 'org',
       },
       {
         code: 'STAFF',
         name: 'Staff',
         rank: 3,
         role_type: 'tenant_staff',
         is_locked: true,
         managed_by_template: true,
         permission_ceiling_scope: 'team',
       },
     ];
   
     for (const roleDef of keyRoles) {
       // Upsert le rôle
       const role = await prisma.role.upsert({
         where: { org_id_code: { org_id: orgId, code: roleDef.code } },
         create: { ...roleDef, org_id: orgId },
         update: { ...roleDef },
       });
   
       // Assigner les permissions selon PermissionRegistry
       await syncPermissionsForRole(role.id, roleDef.role_type);
     }
   }
   
   async function syncPermissionsForRole(roleId: string, roleType: RoleType) {
     // Pour chaque permission du registry
     for (const [key, def] of Object.entries(PERMISSION_REGISTRY)) {
       const defaultScope = def.defaultScopesByRoleType[roleType];
       if (!defaultScope) continue;
   
       // Upsert role_permission
       await prisma.rolePermission.upsert({
         where: { role_id_permission_code: { role_id: roleId, permission_code: key } },
         create: {
           role_id: roleId,
           permission_code: key,
           scope: defaultScope,
         },
         update: {
           scope: defaultScope,
         },
       });
     }
   }
   ```

2. **Hook dans `OrganizationsService.create()`**

   ```typescript
   async create(dto: CreateOrganizationDto) {
     const org = await this.prisma.organization.create({ data: dto });
     
     // Provisioning automatique des rôles clés
     await syncRolesForOrg(org.id);
     
     return org;
   }
   ```

3. **Script de migration pour orgs existantes**
   - Parcourir toutes les orgs
   - Créer les rôles clés si absents
   - Ne pas toucher aux rôles custom

### Done quand

- ✅ Script `sync-roles.ts` fonctionnel
- ✅ Nouvelle org reçoit automatiquement Admin/Manager/Staff
- ✅ `npm run roles:sync` fonctionne
- ✅ Orgs existantes migrées

---

## Phase 7 – Multi-org réel (10-15 jours) ⚠️ BREAKING

### Objectif
Passer au modèle multi-org complet (user peut être dans plusieurs orgs).

### Tâches

1. **Migration Prisma : Supprimer `org_id` et `role_id` de `User`**
   - Créer migration pour supprimer colonnes
   - Créer script de migration des données existantes

2. **Adapter `AuthService`**
   - Login : lister les orgs du user via `OrgUser`
   - Stocker `currentOrgId` dans le JWT
   - Endpoint `POST /auth/switch-org` pour changer d'org

3. **Adapter tous les services**
   - Remplacer `user.org_id` par `user.currentOrgId`
   - Remplacer `user.role_id` par lookup via `UserRole`

4. **API multi-org**
   - `GET /api/me/orgs` : Liste des orgs du user
   - `POST /admin/users/:id/orgs/:orgId` : Ajouter user à une org
   - `DELETE /admin/users/:id/orgs/:orgId` : Retirer user d'une org

### Done quand

- ✅ User peut être dans plusieurs orgs
- ✅ Switch org fonctionne
- ✅ Users plateforme gérés
- ✅ Tous les services migrés

---

## Phase 8 – Gating modules + Plans (4-6 jours)

### Objectif
Implémenter le gating complet par plan/modules.

### Tâches

1. **Seeder des plans**

   ```typescript
   const plans = [
     {
       code: 'FREE',
       name: 'Plan Gratuit',
       modules: ['events', 'attendees'],
     },
     {
       code: 'PRO',
       name: 'Plan Pro',
       modules: ['events', 'attendees', 'badges', 'reports'],
     },
     {
       code: 'ENTERPRISE',
       name: 'Plan Enterprise',
       modules: ['*'], // Tous les modules
     },
   ];
   ```

2. **API back-office Plans/Modules**

   ```typescript
   // PlansController
   @Get()
   @RequirePermission('plan.read', { scope: 'any' })
   async listPlans() { }
   
   @Post()
   @RequirePermission('plan.create', { scope: 'any' })
   async createPlan() { }
   
   @Post(':id/modules/:key')
   @RequirePermission('plan.module.add', { scope: 'any' })
   async addModuleToPlan() { }
   
   @Put('orgs/:orgId/modules/:key')
   @RequirePermission('org.module.override', { scope: 'any' })
   async overrideModuleForOrg() { }
   ```

3. **Brancher `isModuleEnabledForTenant` dans `AuthorizationService.can()`**
   - Déjà fait en Phase 3 ✅

### Done quand

- ✅ Plans seedés
- ✅ API back-office fonctionnelle
- ✅ Module désactivé refuse l'accès
- ✅ Override org fonctionne

---

## Phase 9 – Frontend (10-12 jours)

### Objectif
Adapter le frontend pour utiliser le nouveau système d'autorisation.

### Tâches

1. **Créer `AbilityService` côté front**

   ```typescript
   export class AbilityService {
     private permissions: Array<{ key: string; scope: Scope }> = [];
     private modules: string[] = [];
   
     async loadPermissions() {
       const response = await fetch('/api/me/permissions');
       const data = await response.json();
       this.permissions = data.permissions;
       this.modules = data.modules;
     }
   
     can(permissionKey: string, ctx?: ScopeContext): boolean {
       const perm = this.permissions.find((p) => p.key === permissionKey);
       if (!perm) return false;
       
       // TODO: Implémenter scopeCovers côté front
       return true;
     }
   
     canUse(moduleKey: string): boolean {
       return this.modules.includes(moduleKey);
     }
   }
   ```

2. **Endpoint backend `GET /api/me/permissions`**

   ```typescript
   @Get('me/permissions')
   async getMyPermissions(@Req() req) {
     const user = req.user;
     
     // Récupérer toutes les permissions effectives
     const permissions = await this.authorizationService
       .getEffectivePermissions(user.id, user.currentOrgId);
     
     // Récupérer les modules activés
     const modules = await this.modulesService
       .getEnabledModules(user.currentOrgId);
     
     return { permissions, modules };
   }
   ```

3. **Migrer UI Events**

   ```typescript
   // AVANT
   {user.role === 'admin' && <CreateEventButton />}
   
   // APRÈS
   {ability.can('event.create') && <CreateEventButton />}
   ```

4. **Interceptor 403**

   ```typescript
   axios.interceptors.response.use(
     (response) => response,
     (error) => {
       if (error.response?.status === 403) {
         const permission = error.response.data.permission;
         toast.error(`Permission requise : ${permission}`);
       }
       return Promise.reject(error);
     },
   );
   ```

### Done quand

- ✅ `AbilityService` créé et fonctionnel
- ✅ Endpoint `/api/me/permissions` fonctionne
- ✅ Module Events migré côté UI
- ✅ Gestion 403 propre

---

## Checklist globale de validation

### Phase 0 ✅
- [ ] Documentation architecture complète
- [ ] Diagrammes créés
- [ ] Équipe formée

### Phase 1 ✅
- [ ] Migrations passent
- [ ] Seeders remplissent champs RBAC
- [ ] App démarre

### Phase 2 ✅
- [ ] `PERMISSION_REGISTRY` complet
- [ ] Types définis
- [ ] Script sync fonctionnel

### Phase 3 ✅
- [ ] `AuthorizationService` implémenté
- [ ] `ModulesService` implémenté
- [ ] Tests unitaires passent

### Phase 4 ✅
- [ ] Guards créés
- [ ] Décorateurs créés
- [ ] Tests unitaires passent

### Phase 5 ✅
- [ ] Module Events migré
- [ ] Tests E2E passent
- [ ] Rôles testés

### Phase 6 ✅
- [ ] Script sync rôles fonctionnel
- [ ] Nouvelle org = rôles auto
- [ ] Orgs existantes migrées

### Phase 7 ✅
- [ ] User multi-org
- [ ] Switch org fonctionne
- [ ] Services migrés

### Phase 8 ✅
- [ ] Plans seedés
- [ ] API back-office OK
- [ ] Gating fonctionne

### Phase 9 ✅
- [ ] `AbilityService` créé
- [ ] Endpoint `/api/me/permissions` OK
- [ ] UI Events migrée
- [ ] Gestion 403 propre

---

## Estimation totale : 8-10 semaines

| Phase | Durée | Risque |
|-------|-------|--------|
| Phase 0 | 2-3j | Faible |
| Phase 1 | 3-5j | Moyen |
| Phase 2 | 5-7j | Moyen |
| Phase 3 | 7-10j | Moyen |
| Phase 4 | 5-7j | Moyen |
| Phase 5 | 3-4j | Faible |
| Phase 6 | 4-5j | Moyen |
| Phase 7 | 10-15j | Élevé |
| Phase 8 | 4-6j | Faible |
| Phase 9 | 10-12j | Moyen |

---

**Prêt à commencer ? 🚀**
