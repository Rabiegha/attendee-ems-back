# STEP 3 : Core RBAC Hexagonal

> **Statut** : 🔨 **À DÉMARRER**  
> **Prérequis** : ✅ STEP 1 (Multi-tenant DB) + ✅ STEP 2 (JWT Multi-org)  
> **Durée estimée** : 2-3 jours  
> **Priorité** : 🔴 **CRITIQUE** (cœur du système d'autorisation)

## 🎯 Objectif

Construire un **moteur d'autorisation RBAC** pur, indépendant de NestJS/Prisma, suivant les principes de l'**architecture hexagonale** :
- **Core** : Logique métier pure (décisions allow/deny)
- **Ports** : Interfaces (SPI) dont le core dépend
- **Adapters** : Implémentations concrètes (DB, HTTP, etc.)

### 🔑 Adaptation au JWT Minimal (STEP 2)

Avec le JWT minimal de STEP 2 (`{ sub, mode, currentOrgId }`), on n'a plus `isPlatform` ni `isRoot` dans le JWT.  

**Solution** : Créer un port `AuthContextPort` qui construit un `AuthContext` complet depuis le JWT minimal + une requête DB.

```
JWT minimal          AuthContextPort.buildAuthContext()           AuthContext complet
{ sub, mode }   →      + requête DB                    →   { userId, mode, isPlatform, isRoot, currentOrgId }
```

**Pourquoi cette approche ?**
- ✅ JWT reste léger (~200 bytes)
- ✅ Pas de staleness : `isPlatform`/`isRoot` toujours à jour
- ✅ Core RBAC reste pur : ne dépend pas du format JWT
- ✅ Facile à tester : mock du port suffit
- ✅ Scalable : cache possible au niveau du port

**Flux complet** :
```
1. User fait login → JWT minimal { sub, mode, currentOrgId }
2. Request arrive avec JWT
3. JwtAuthGuard valide JWT → injecte JwtPayload dans request.user
4. RequirePermissionGuard intercepte :
   a) Appelle authContextPort.buildAuthContext(request.user)
   b) Charge isPlatform/isRoot depuis DB (1 requête, cacheable)
   c) Construit AuthContext complet
   d) Appelle authorizationService.can(permission, authContext, rbacContext)
5. Core RBAC évalue la décision
```

Ceci garantit que le **core RBAC reste pur** (pas de dépendance au JWT) tout en s'adaptant au JWT minimal.

## ❓ Pourquoi Hexagonal ?

✅ **Testabilité** : Le core est testable sans DB/HTTP  
✅ **Évolutivité** : Ajouter des features (overrides, caching) sans refactor  
✅ **Indépendance** : Le domaine RBAC ne dépend pas de NestJS  
✅ **Clarté** : Séparation nette infrastructure vs logique métier

---

## 📐 Architecture

```
src/platform/authz/
│
├── core/                           # ❤️ DOMAINE PUR (0 dépendance infra)
│   ├── authorization.service.ts   # Moteur de décision RBAC
│   ├── decision.ts                # { allowed, code, details }
│   ├── types.ts                   # AuthContext, RbacContext, Scope
│   ├── scope-evaluator.ts         # Logique scopes (own/org/assigned/any)
│   └── permission-resolver.ts     # Résolution grants (V1: role, V2: overrides)
│
├── ports/                          # 🔌 INTERFACES (SPI)
│   ├── rbac-query.port.ts         # getTenantRoleForUserInOrg, getPlatformRoleForUser, getGrantsForTenantRole, getGrantsForPlatformRole
│   ├── membership.port.ts         # isMemberOfOrg, getPlatformOrgAccess
│   ├── module-gating.port.ts      # isModuleEnabledForOrg (MVP)
│   └── auth-context.port.ts       # 🆕 buildAuthContext (JWT minimal → AuthContext)
│
├── adapters/                       # 🔧 IMPLÉMENTATIONS
│   ├── db/
│   │   ├── prisma-rbac-query.adapter.ts
│   │   ├── prisma-membership.adapter.ts
│   │   ├── prisma-module-gating.adapter.ts
│   │   └── prisma-auth-context.adapter.ts  # 🆕 Nouveau
│   └── http/
│       ├── guards/
│       │   ├── require-permission.guard.ts
│       │   └── tenant-context.guard.ts     # (déjà dans STEP 2)
│       ├── decorators/
│       │   └── require-permission.decorator.ts
│       └── controllers/
│           ├── rbac-admin.controller.ts    # CRUD roles/assign
│           └── me-ability.controller.ts    # GET /me/ability
│
├── permission-registry.ts          # Registry centralisé des permissions
└── authz.module.ts                 # Module NestJS
```

### 🎨 Principes Architecturaux : Séparation Explicite Tenant/Platform

**Décision architecturale clé** : Les méthodes du port `RbacQueryPort` sont séparées explicitement entre tenant et platform, plutôt qu'une méthode unique avec paramètres optionnels.

**Avant (approche ambiguë)** :
```typescript
// ❌ Pas clair : orgId optionnel = tenant OU platform ?
resolveGrants(userId: string, orgId?: string): Promise<Grant[]>
```

**Après (approche explicite)** :
```typescript
// ✅ Clair : Deux flux distincts
getTenantRoleForUserInOrg(userId: string, orgId: string): Promise<TenantRole | null>
getPlatformRoleForUser(userId: string): Promise<PlatformRole | null>
getGrantsForTenantRole(roleId: string): Promise<Grant[]>
getGrantsForPlatformRole(roleId: string): Promise<Grant[]>
```

**Bénéfices** :
1. **Type Safety** : Impossible de confondre tenant role et platform role
2. **Clarté** : Le code auto-documente l'intention (tenant vs platform)
3. **Cache** : Clés différentes selon le contexte (userId:orgId vs userId)
4. **Sécurité** : Impossible de mélanger les contextes accidentellement
5. **Testabilité** : Tests plus explicites sur les deux flux

**Architecture du PermissionResolver** :
```
resolveGrantsForContext(authContext)
  ├── if mode='tenant' → resolveTenantGrants(userId, orgId)
  │     ├── getTenantRoleForUserInOrg() → { roleId, level }
  │     └── getGrantsForTenantRole(roleId) → [grants]
  │
  └── if mode='platform' → resolvePlatformGrants(userId)
        ├── getPlatformRoleForUser() → { roleId, tenantAccessScope }
        └── getGrantsForPlatformRole(roleId) → [grants]
```

**Intégration avec JWT minimal de STEP 2** :
- JWT contient : `{ sub, mode, currentOrgId? }`
- `AuthContextPort.buildAuthContext()` enrichit avec `isPlatform`, `isRoot` depuis DB
- `PermissionResolver` route vers tenant ou platform selon `authContext.mode`

---

## 🧠 Core : Logique Métier Pure

### 1. Types de Base

**`core/types.ts`**

```typescript
// Contexte d'autorisation (qui demande ?)
// 🔑 Construit à partir du JWT minimal + requête DB
export interface AuthContext {
  userId: string;              // Depuis JWT.sub
  mode: 'tenant' | 'platform'; // Depuis JWT.mode
  currentOrgId: string | null; // Depuis JWT.currentOrgId (si tenant)
  // Les champs ci-dessous sont chargés depuis la DB (pas dans le JWT)
  isPlatform: boolean;         // True si mode='platform' OU a un platform role
  isRoot: boolean;             // True si role platform is_root=true
}

/**
 * Types dérivés pour type safety
 * 
 * TenantContext : User en mode tenant avec une org sélectionnée
 * - Utilise un tenant_user_role (manager, admin, member, etc.)
 * - Peut avoir aussi un platform role en parallèle
 * - currentOrgId toujours défini
 * 
 * PlatformContext : User en mode platform sans org spécifique
 * - Utilise un platform_user_role (root, super_admin, support, etc.)
 * - Peut agir sur plusieurs orgs selon tenantAccessScope
 * - currentOrgId peut être null ou défini selon l'action
 * 
 * Exemple de flux:
 * 1. User multi-org login → JWT mode=tenant, currentOrgId=null → Doit appeler /switch-org
 * 2. User platform login → JWT mode=platform, currentOrgId=null → Peut agir directement
 * 3. User single-org login → JWT mode=tenant, currentOrgId='org1' → Peut agir directement
 */
export type TenantContext = AuthContext & {
  mode: 'tenant';
  currentOrgId: string; // TOUJOURS défini pour tenant
};

export type PlatformContext = AuthContext & {
  mode: 'platform';
  currentOrgId?: string; // Optionnel pour platform
};

// Contexte RBAC (sur quoi ?)
export interface RbacContext {
  resourceOwnerId?: string;      // Propriétaire de la ressource (ex: event.created_by)
  resourceOrgId?: string;         // Organisation de la ressource (ex: event.org_id)
  assignedUserIds?: string[];     // Users assignés (ex: event_access.user_id)
  teamIds?: string[];             // Teams assignés (futur)
}

// Grant = permission + scope limit
export interface Grant {
  key: string;              // 'event.create'
  scopeLimit: ScopeLimit;   // 'own' | 'org' | 'assigned' | 'any'
  moduleKey?: string;       // 'events' (optionnel)
}

// Scope limit (restrictions sur les ressources)
export enum ScopeLimit {
  OWN = 'own',           // Seulement ses propres ressources
  ASSIGNED = 'assigned', // Ressources assignées
  ANY = 'any',           // Toutes les ressources du tenant
}

// Tenant Access Scope (pour platform users)
export enum TenantAccessScope {
  TENANT_ANY = 'tenant_any',           // Accès à toutes les orgs
  TENANT_ASSIGNED = 'tenant_assigned', // Accès aux orgs assignées
}
```

### 2. Decision

**`core/decision.ts`**

```typescript
export enum DecisionCode {
  // Success
  OK = 'OK',

  // Context errors
  NO_TENANT_CONTEXT = 'NO_TENANT_CONTEXT',             // currentOrgId manquant
  NOT_TENANT_MEMBER = 'NOT_TENANT_MEMBER',             // User pas membre de l'org
  PLATFORM_TENANT_ACCESS_DENIED = 'PLATFORM_TENANT_ACCESS_DENIED', // Platform user sans accès à cette org

  // Permission errors
  MISSING_PERMISSION = 'MISSING_PERMISSION',           // Permission non accordée
  SCOPE_DENIED = 'SCOPE_DENIED',                       // Scope insuffisant (ex: own mais pas owner)

  // Module gating
  MODULE_DISABLED = 'MODULE_DISABLED',                 // Module désactivé pour l'org

  // Hierarchy errors
  HIERARCHY_VIOLATION = 'HIERARCHY_VIOLATION', // Cannot manage user with equal/higher role
}

export interface Decision {
  allowed: boolean;
  code: DecisionCode;
  details?: {
    reason?: string;
    requiredPermission?: string;
    actualScope?: ScopeLimit;
    requiredScope?: ScopeLimit;
    [key: string]: any;
  };
}

export class DecisionHelper {
  static allow(): Decision {
    return { allowed: true, code: DecisionCode.OK };
  }

  static deny(code: DecisionCode, details?: Decision['details']): Decision {
    return { allowed: false, code, details };
  }
}
```

### 3. Authorization Service (Cœur du Moteur)

**`core/authorization.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { RbacQueryPort } from '../ports/rbac-query.port';
import { MembershipPort } from '../ports/membership.port';
import { ModuleGatingPort } from '../ports/module-gating.port';
import { PermissionResolver } from './permission-resolver';
import { ScopeEvaluator } from './scope-evaluator';
import {
  AuthContext,
  RbacContext,
  Grant,
  ScopeLimit,
  TenantAccessScope,
} from './types';
import { Decision, DecisionCode, DecisionHelper } from './decision';

@Injectable()
export class AuthorizationService {
  constructor(
    private rbacQuery: RbacQueryPort,
    private membership: MembershipPort,
    private moduleGating: ModuleGatingPort,
    private permissionResolver: PermissionResolver,
    private scopeEvaluator: ScopeEvaluator,
  ) {}

  /**
   * Évalue si l'action est autorisée
   * @returns Decision (allowed + code + details)
   */
  async can(
    permissionKey: string,
    authContext: AuthContext,
    rbacContext: RbacContext = {},
  ): Promise<Decision> {
    // STEP 1: Vérifier le contexte tenant (si mode tenant)
    if (authContext.mode === 'tenant' && !authContext.currentOrgId) {
      return DecisionHelper.deny(DecisionCode.NO_TENANT_CONTEXT, {
        reason: 'No organization context provided - user must select org via /switch-org',
      });
    }

    // STEP 2: Vérifier le membership / tenant access
    const membershipCheck = await this.checkMembership(authContext);
    if (!membershipCheck.allowed) {
      return membershipCheck;
    }

    // STEP 3: Résoudre les grants selon le contexte (tenant ou platform)
    const grants = await this.permissionResolver.resolveGrantsForContext(authContext);

    // STEP 4: Trouver le grant correspondant
    const grant = grants.find((g) => g.key === permissionKey);
    if (!grant) {
      return DecisionHelper.deny(DecisionCode.MISSING_PERMISSION, {
        reason: `Permission '${permissionKey}' not granted`,
        requiredPermission: permissionKey,
      });
    }

    // STEP 5: Vérifier le module gating (si spécifié)
    if (grant.moduleKey) {
      const moduleEnabled = await this.moduleGating.isModuleEnabledForOrg(
        authContext.currentOrgId,
        grant.moduleKey,
      );
      if (!moduleEnabled) {
        return DecisionHelper.deny(DecisionCode.MODULE_DISABLED, {
          reason: `Module '${grant.moduleKey}' is disabled for this organization`,
          module: grant.moduleKey,
        });
      }
    }

    // STEP 6: Évaluer le scope
    const scopeCheck = this.scopeEvaluator.evaluate(
      grant.scopeLimit,
      authContext,
      rbacContext,
    );

    if (!scopeCheck.allowed) {
      return DecisionHelper.deny(DecisionCode.SCOPE_DENIED, {
        reason: scopeCheck.reason,
        actualScope: grant.scopeLimit,
        resourceOwnerId: rbacContext.resourceOwnerId,
      });
    }

    // ✅ Tout est OK
    return DecisionHelper.allow();
  }

  /**
   * Wrapper : évalue et throw si refusé
   */
  async assert(
    permissionKey: string,
    authContext: AuthContext,
    rbacContext: RbacContext = {},
  ): Promise<void> {
    const decision = await this.can(permissionKey, authContext, rbacContext);

    if (!decision.allowed) {
      throw new ForbiddenException({
        message: 'Access denied',
        code: decision.code,
        details: decision.details,
      });
    }
  }

  /**
   * Vérifier membership / tenant access
   */
  private async checkMembership(authContext: AuthContext): Promise<Decision> {
    const { userId, currentOrgId, isPlatform, isRoot } = authContext;

    // ROOT a accès à tout
    if (isRoot) {
      return DecisionHelper.allow();
    }

    // User tenant : vérifier membership
    if (!isPlatform) {
      const isMember = await this.membership.isMemberOfOrg(userId, currentOrgId!);
      if (!isMember) {
        return DecisionHelper.deny(DecisionCode.NOT_TENANT_MEMBER, {
          reason: 'User is not a member of this organization',
        });
      }
      return DecisionHelper.allow();
    }

    // Platform user : vérifier tenant access via getPlatformRoleForUser
    const platformRole = await this.rbacQuery.getPlatformRoleForUser(userId);
    
    if (!platformRole) {
      return DecisionHelper.deny(DecisionCode.PLATFORM_TENANT_ACCESS_DENIED, {
        reason: 'User does not have a platform role',
      });
    }

    // tenant_any : accès à toutes les orgs (ROOT, SUPER_ADMIN)
    if (platformRole.tenantAccessScope === TenantAccessScope.TENANT_ANY) {
      return DecisionHelper.allow();
    }

    // tenant_assigned : vérifier platform_user_org_access (SUPPORT)
    if (platformRole.tenantAccessScope === TenantAccessScope.TENANT_ASSIGNED) {
      const hasAccess = await this.membership.hasPlatformAccessToOrg(userId, currentOrgId!);
      if (!hasAccess) {
        return DecisionHelper.deny(DecisionCode.PLATFORM_TENANT_ACCESS_DENIED, {
          reason: 'Platform user does not have access to this organization',
        });
      }
      return DecisionHelper.allow();
    }

    // Cas par défaut : refusé
    return DecisionHelper.deny(DecisionCode.PLATFORM_TENANT_ACCESS_DENIED);
  }

  /**
   * Vérifier si un user peut gérer un autre user (hiérarchie)
   * @returns Decision
   */
  async canManageUser(
    managerId: string,
    targetUserId: string,
    orgId: string,
  ): Promise<Decision> {
    // 1. Charger le level du manager
    const managerLevel = await this.rbacQuery.getRoleLevel(managerId, orgId);
    if (managerLevel === null) {
      return DecisionHelper.deny(DecisionCode.MISSING_PERMISSION, {
        reason: 'Manager has no role in this organization',
      });
    }

    // 2. Charger le level du target
    const targetLevel = await this.rbacQuery.getRoleLevel(targetUserId, orgId);
    if (targetLevel === null) {
      return DecisionHelper.deny(DecisionCode.MISSING_PERMISSION, {
        reason: 'Target user has no role in this organization',
      });
    }

    // 3. Vérifier la hiérarchie (level plus petit = plus haut)
    if (managerLevel >= targetLevel) {
      return DecisionHelper.deny(DecisionCode.HIERARCHY_VIOLATION, {
        reason: 'Cannot manage a user with equal or higher role level',
        managerLevel,
        targetLevel,
      });
    }

    return DecisionHelper.allow();
  }

  /**
   * Vérifier si un user peut assigner un rôle (hiérarchie)
   */
  async canAssignRole(
    managerId: string,
    targetRoleId: string,
    orgId: string,
  ): Promise<Decision> {
    // 1. Charger le level du manager
    const managerLevel = await this.rbacQuery.getRoleLevel(managerId, orgId);
    if (managerLevel === null) {
      return DecisionHelper.deny(DecisionCode.MISSING_PERMISSION, {
        reason: 'Manager has no role in this organization',
      });
    }

    // 2. Charger le level du rôle cible
    const targetRole = await this.prisma.role.findUnique({
      where: { id: targetRoleId },
      select: { level: true, org_id: true },
    });

    if (!targetRole || targetRole.org_id !== orgId) {
      return DecisionHelper.deny(DecisionCode.MISSING_PERMISSION, {
        reason: 'Target role not found in this organization',
      });
    }

    // 3. Vérifier la hiérarchie
    if (managerLevel >= targetRole.level) {
      return DecisionHelper.deny(DecisionCode.HIERARCHY_VIOLATION, {
        reason: 'Cannot assign a role equal or higher than yours',
        managerLevel,
        targetLevel: targetRole.level,
      });
    }

    return DecisionHelper.allow();
  }

  /**
   * Wrapper : évalue et throw si refusé (pour la hiérarchie)
   */
  async assertDecision(decision: Decision): Promise<void> {
    if (!decision.allowed) {
      throw new ForbiddenException({
        message: 'Access denied',
        code: decision.code,
        details: decision.details,
      });
    }
  }
}
```

### 4. Permission Resolver

**`core/permission-resolver.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { RbacQueryPort } from '../ports/rbac-query.port';
import { Grant, AuthContext } from './types';

/**
 * Résout les grants (permissions + scopes) selon le contexte JWT
 * 
 * Architecture:
 * - resolveGrantsForContext() : Méthode publique qui route vers tenant ou platform
 * - resolveTenantGrants() : Logique privée pour les tenants
 * - resolvePlatformGrants() : Logique privée pour les platforms
 * 
 * Intégration avec JWT minimal de STEP 2:
 * - JWT contient: { sub, mode, currentOrgId?, iat, exp }
 * - Si mode='tenant' + currentOrgId: tenant grants
 * - Si mode='platform': platform grants
 * - Si mode='tenant' sans currentOrgId: requiert sélection d'org (/switch-org)
 * 
 * V1: Lecture depuis role_permissions (tenant + platform)
 * V2: Ajout des overrides (user_permissions)
 */
@Injectable()
export class PermissionResolver {
  constructor(private rbacQuery: RbacQueryPort) {}

  /**
   * Méthode publique : Résout les grants selon le contexte JWT
   * Route vers tenant ou platform selon authContext.mode
   */
  async resolveGrantsForContext(authContext: AuthContext): Promise<Grant[]> {
    if (authContext.mode === 'tenant' && authContext.currentOrgId) {
      return this.resolveTenantGrants(authContext.userId, authContext.currentOrgId);
    }

    if (authContext.mode === 'platform') {
      return this.resolvePlatformGrants(authContext.userId);
    }

    // Mode tenant sans currentOrgId: utilisateur multi-org sans sélection
    // L'AuthorizationService doit rejeter la requête avant d'arriver ici
    return [];
  }

  /**
   * Logique privée : Résolution des grants TENANT
   * 1. Récupérer le tenant role du user dans l'org
   * 2. Charger les permissions du role
   */
  private async resolveTenantGrants(userId: string, orgId: string): Promise<Grant[]> {
    // 1. Charger le tenant role
    const tenantRole = await this.rbacQuery.getTenantRoleForUserInOrg(userId, orgId);
    if (!tenantRole) {
      return []; // User pas membre de cette org
    }

    // 2. Charger les grants du role
    const roleGrants = await this.rbacQuery.getGrantsForTenantRole(tenantRole.roleId);

    // V2 (futur): Merger avec les overrides user_permissions
    // const overrides = await this.rbacQuery.getUserOverrides(userId, orgId);
    // return this.mergeGrants(roleGrants, overrides);

    return roleGrants;
  }

  /**
   * Logique privée : Résolution des grants PLATFORM
   * 1. Récupérer le platform role du user
   * 2. Charger les permissions du role
   * 3. Si tenantAccessScope='tenant_any': accès à TOUTES les orgs
   * 4. Si tenantAccessScope='tenant_assigned': vérifier platform_user_org_access
   */
  private async resolvePlatformGrants(userId: string): Promise<Grant[]> {
    // 1. Charger le platform role
    const platformRole = await this.rbacQuery.getPlatformRoleForUser(userId);
    if (!platformRole) {
      return []; // User n'a pas de rôle platform
    }

    // 2. Charger les grants du role
    const roleGrants = await this.rbacQuery.getGrantsForPlatformRole(platformRole.roleId);

    // Note: Le tenantAccessScope est utilisé plus tard dans AuthorizationService
    // pour vérifier si le platform user peut agir sur une org spécifique
    // - tenant_any: accès à toutes les orgs (ROOT, SUPER_ADMIN)
    // - tenant_assigned: accès uniquement aux orgs dans platform_user_org_access (SUPPORT)

    return roleGrants;
  }

  /**
   * V2 (futur): Merger les grants du role avec les overrides user_permissions
   * Exemple: Admin avec permission events:delete=none (override pour enlever)
   */
  private mergeGrants(roleGrants: Grant[], overrides: Grant[]): Grant[] {
    // TODO STEP 4: Implémenter la logique de merge
    // Pour l'instant, on retourne juste les grants du rôle
    return roleGrants;
  }
}
```

### 5. Scope Evaluator

**`core/scope-evaluator.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { AuthContext, RbacContext, ScopeLimit } from './types';

interface ScopeEvaluation {
  allowed: boolean;
  reason?: string;
}

/**
 * Évalue si le scope limit est respecté
 */
@Injectable()
export class ScopeEvaluator {
  evaluate(
    scopeLimit: ScopeLimit,
    authContext: AuthContext,
    rbacContext: RbacContext,
  ): ScopeEvaluation {
    switch (scopeLimit) {
      case ScopeLimit.ANY:
        // Accès à TOUTES les ressources du tenant actuel
        return { allowed: true };

      case ScopeLimit.OWN:
        // Accès uniquement si user est le propriétaire
        if (!rbacContext.resourceOwnerId) {
          return { allowed: true }; // Pas de ressource spécifique (ex: create)
        }
        if (rbacContext.resourceOwnerId === authContext.userId) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: 'Resource is not owned by the user',
        };

      case ScopeLimit.ASSIGNED:
        // Accès uniquement si user est assigné
        if (!rbacContext.assignedUserIds || rbacContext.assignedUserIds.length === 0) {
          return { allowed: true }; // Pas d'assignation spécifique
        }
        if (rbacContext.assignedUserIds.includes(authContext.userId)) {
          return { allowed: true };
        }
        return {
          allowed: false,
          reason: 'User is not assigned to this resource',
        };

      default:
        return {
          allowed: false,
          reason: 'Unknown scope limit',
        };
    }
  }
}
```

---

## 🔌 Ports (Interfaces SPI)

### 1. RbacQueryPort

**`ports/rbac-query.port.ts`**

```typescript
import { Grant, TenantAccessScope } from '../core/types';

/**
 * Port pour les requêtes RBAC
 * 
 * Conception avec séparation explicite tenant/platform:
 * - getTenantRoleForUserInOrg() : Récupérer le rôle TENANT d'un user dans une org
 * - getPlatformRoleForUser() : Récupérer le rôle PLATFORM global d'un user
 * - getGrantsForTenantRole() : Récupérer les permissions d'un tenant role
 * - getGrantsForPlatformRole() : Récupérer les permissions d'un platform role
 * 
 * Cette séparation permet:
 * 1. Type safety: Pas d'ambiguïté sur le type de rôle retourné
 * 2. Clarté: Deux flux distincts (tenant vs platform)
 * 3. Cache: Clés différentes (userId:orgId vs userId)
 * 4. Sécurité: Impossible de mélanger les contextes
 */
export abstract class RbacQueryPort {
  /**
   * Récupérer le rôle TENANT d'un user dans une org spécifique
   * @returns TenantUserRole avec le roleId, level, etc. ou null si pas membre
   */
  abstract getTenantRoleForUserInOrg(
    userId: string,
    orgId: string,
  ): Promise<{
    roleId: string;
    roleName: string;
    level: number;
  } | null>;

  /**
   * Récupérer le rôle PLATFORM global d'un user
   * @returns PlatformUserRole avec le roleId, tenantAccessScope, etc. ou null si pas de rôle platform
   */
  abstract getPlatformRoleForUser(userId: string): Promise<{
    roleId: string;
    roleName: string;
    tenantAccessScope: TenantAccessScope;
  } | null>;

  /**
   * Récupérer les grants (permissions + scopes) d'un TENANT role
   * @param roleId L'ID du tenant role (depuis tenant_user_roles)
   */
  abstract getGrantsForTenantRole(roleId: string): Promise<Grant[]>;

  /**
   * Récupérer les grants (permissions + scopes) d'un PLATFORM role
   * @param roleId L'ID du platform role (depuis platform_user_roles)
   */
  abstract getGrantsForPlatformRole(roleId: string): Promise<Grant[]>;

  /**
   * Récupérer le level d'un rôle dans une org
   * Utilisé pour vérifier la hiérarchie (ex: empêcher un manager d'assigner un rôle égal/supérieur)
   */
  abstract getRoleLevel(userId: string, orgId: string): Promise<number | null>;
}
```

### 2. MembershipPort

**`ports/membership.port.ts`**

```typescript
export abstract class MembershipPort {
  /**
   * Vérifier si un user est membre d'une org (via org_users)
   */
  abstract isMemberOfOrg(userId: string, orgId: string): Promise<boolean>;

  /**
   * Vérifier si un platform user a accès à une org (via platform_user_org_access)
   */
  abstract hasPlatformAccessToOrg(userId: string, orgId: string): Promise<boolean>;
}
```

### 3. ModuleGatingPort

**`ports/module-gating.port.ts`**

```typescript
export abstract class ModuleGatingPort {
  /**
   * Vérifier si un module est activé pour une org
   * V1: Retourne toujours true (pas de gating)
   * V2: Lecture depuis org_modules ou plan
   */
  abstract isModuleEnabledForOrg(orgId: string, moduleKey: string): Promise<boolean>;
}
```

### 4. AuthContextPort (NOUVEAU - nécessaire pour JWT minimal)

**`ports/auth-context.port.ts`**

```typescript
import { AuthContext } from '../core/types';
import { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';

/**
 * Port pour construire un AuthContext complet depuis un JWT minimal
 * 
 * Le JWT minimal ne contient que : { sub, mode, currentOrgId? }
 * Ce port charge les infos manquantes (isPlatform, isRoot) depuis la DB
 * 
 * Pourquoi un port ?
 * - Le core RBAC ne doit pas dépendre de Prisma
 * - Permet de cacher les résultats (1 requête DB par user par TTL)
 * - Testable avec un mock simple
 */
export abstract class AuthContextPort {
  /**
   * Construire AuthContext depuis JWT minimal
   * 
   * @param jwtPayload JWT minimal contenant { sub, mode, currentOrgId? }
   * @returns AuthContext complet avec isPlatform et isRoot chargés depuis DB
   */
  abstract buildAuthContext(jwtPayload: JwtPayload): Promise<AuthContext>;
}
```

---

## 🔧 Adapters DB (Prisma)

### 1. PrismaRbacQueryAdapter

**`adapters/db/prisma-rbac-query.adapter.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RbacQueryPort } from '../../ports/rbac-query.port';
import { Grant, ScopeLimit, TenantAccessScope } from '../../core/types';

@Injectable()
export class PrismaRbacQueryAdapter implements RbacQueryPort {
  constructor(private prisma: PrismaService) {}

  /**
   * Récupérer le rôle TENANT d'un user dans une org
   * Implémentation avec Prisma via tenant_user_roles
   */
  async getTenantRoleForUserInOrg(
    userId: string,
    orgId: string,
  ): Promise<{ roleId: string; roleName: string; level: number } | null> {
    const tenantRole = await this.prisma.tenantUserRole.findUnique({
      where: {
        user_id_org_id: { user_id: userId, org_id: orgId },
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
      },
    });

    if (!tenantRole) {
      return null;
    }

    return {
      roleId: tenantRole.role.id,
      roleName: tenantRole.role.name,
      level: tenantRole.role.level,
    };
  }

  /**
   * Récupérer le rôle PLATFORM global d'un user
   * Implémentation avec Prisma via platform_user_roles
   */
  async getPlatformRoleForUser(userId: string): Promise<{
    roleId: string;
    roleName: string;
    tenantAccessScope: TenantAccessScope;
  } | null> {
    const platformRole = await this.prisma.platformUserRole.findUnique({
      where: { user_id: userId },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            tenant_access_scope: true,
          },
        },
      },
    });

    if (!platformRole) {
      return null;
    }

    return {
      roleId: platformRole.role.id,
      roleName: platformRole.role.name,
      tenantAccessScope: platformRole.role.tenant_access_scope as TenantAccessScope,
    };
  }

  /**
   * Récupérer les grants d'un TENANT role
   * Implémentation avec Prisma via role_permissions
   */
  async getGrantsForTenantRole(roleId: string): Promise<Grant[]> {
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { role_id: roleId },
      include: {
        permission: true,
      },
    });

    return rolePermissions.map((rp) => ({
      key: rp.permission.key,
      scopeLimit: rp.scope_limit as ScopeLimit,
      moduleKey: rp.permission.module_key || undefined,
    }));
  }

  /**
   * Récupérer les grants d'un PLATFORM role
   * Implémentation identique à tenant (même table role_permissions)
   */
  async getGrantsForPlatformRole(roleId: string): Promise<Grant[]> {
    // Note: Les platform roles et tenant roles utilisent la même table role_permissions
    // La différence est dans la table de liaison (platform_user_roles vs tenant_user_roles)
    return this.getGrantsForTenantRole(roleId);
  }

  /**
   * Récupérer le level d'un user dans une org (pour la hiérarchie)
   */
  async getRoleLevel(userId: string, orgId: string): Promise<number | null> {
    const tenantRole = await this.getTenantRoleForUserInOrg(userId, orgId);
    return tenantRole?.level ?? null;
  }
}
              },
    });

    return rolePermissions.map((rp) => ({
      key: rp.permission.key,
      scopeLimit: rp.scope_limit as ScopeLimit,
      moduleKey: rp.permission.module_key || undefined,
    }));
  }

  /**
   * Récupérer les grants d'un PLATFORM role
   * Implémentation identique à tenant (même table role_permissions)
   */
  async getGrantsForPlatformRole(roleId: string): Promise<Grant[]> {
    // Note: Les platform roles et tenant roles utilisent la même table role_permissions
    // La différence est dans la table de liaison (platform_user_roles vs tenant_user_roles)
    return this.getGrantsForTenantRole(roleId);
  }

  /**
   * Récupérer le level d'un user dans une org (pour la hiérarchie)
   */
  async getRoleLevel(userId: string, orgId: string): Promise<number | null> {
    const tenantRole = await this.getTenantRoleForUserInOrg(userId, orgId);
    return tenantRole?.level ?? null;
  }
}
```

### 2. PrismaMembershipAdapter

**`adapters/db/prisma-membership.adapter.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MembershipPort } from '../../ports/membership.port';

@Injectable()
export class PrismaMembershipAdapter implements MembershipPort {
  constructor(private prisma: PrismaService) {}

  async isMemberOfOrg(userId: string, orgId: string): Promise<boolean> {
    const membership = await this.prisma.orgUser.findUnique({
      where: {
        user_id_org_id: { user_id: userId, org_id: orgId },
      },
    });
    return !!membership;
  }

  async hasPlatformAccessToOrg(userId: string, orgId: string): Promise<boolean> {
    const access = await this.prisma.platformUserOrgAccess.findUnique({
      where: {
        user_id_org_id: { user_id: userId, org_id: orgId },
      },
    });
    return !!access;
  }
}
```

### 3. PrismaModuleGatingAdapter

**`adapters/db/prisma-module-gating.adapter.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { ModuleGatingPort } from '../../ports/module-gating.port';

/**
 * MVP: Pas de gating, tous les modules sont activés
 * V2: Lire depuis org_modules ou plan
 */
@Injectable()
export class PrismaModuleGatingAdapter implements ModuleGatingPort {
  async isModuleEnabledForOrg(orgId: string, moduleKey: string): Promise<boolean> {
    // V1: Tous les modules sont activés
    return true;

    // V2 (futur):
    // const orgModule = await this.prisma.orgModule.findUnique({
    //   where: { org_id_module_key: { org_id: orgId, module_key: moduleKey } },
    // });
    // return orgModule?.enabled ?? false;
  }
}
```

### 4. PrismaAuthContextAdapter (NOUVEAU - pour JWT minimal)

**`adapters/db/prisma-auth-context.adapter.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthContextPort } from '../../ports/auth-context.port';
import { AuthContext } from '../../core/types';
import { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';

/**
 * Construit un AuthContext complet depuis un JWT minimal
 * 
 * Le JWT minimal contient : { sub, mode, currentOrgId? }
 * Cet adapter charge isPlatform et isRoot depuis la DB
 * 
 * ⚠️ IMPORTANT : Cet adapter est wrappé par CachedAuthContextAdapter
 * Ne pas utiliser directement - toujours passer par le cache
 */
@Injectable()
export class PrismaAuthContextAdapter implements AuthContextPort {
  constructor(private prisma: PrismaService) {}

  async buildAuthContext(jwtPayload: JwtPayload): Promise<AuthContext> {
    const userId = jwtPayload.sub;
    const mode = jwtPayload.mode;
    const currentOrgId = jwtPayload.currentOrgId || null;

    // Par défaut
    let isPlatform = mode === 'platform';
    let isRoot = false;

    // Charger le rôle platform (si existe)
    // Note: Cette requête est cachée par CachedAuthContextAdapter
    const platformRole = await this.prisma.platformUserRole.findUnique({
      where: { user_id: userId },
      include: {
        role: true,
      },
    });

    if (platformRole) {
      isPlatform = true;
      isRoot = platformRole.role.is_root || false;
    }

    return {
      userId,
      mode,
      currentOrgId,
      isPlatform,
      isRoot,
    };
  }
}
```

### 5. CachedAuthContextAdapter (✅ IMPLÉMENTÉ EN STEP 3)

**`adapters/cache/cached-auth-context.adapter.ts`** (NOUVEAU)

> **🔑 AMÉLIORATION STEP 3** : Cache Redis implémenté dès maintenant (pas en V2)  
> Réduit la charge DB de ~1000 requêtes/min à ~10 requêtes/min (99% cache hit)

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AuthContextPort } from '../../ports/auth-context.port';
import { AuthContext } from '../../core/types';
import { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { PrismaAuthContextAdapter } from '../db/prisma-auth-context.adapter';

/**
 * Adapter avec cache Redis pour buildAuthContext
 * 
 * Stratégie de cache :
 * - Clé: `auth_context:${userId}`
 * - TTL: 5 minutes (300s)
 * - Invalidation: Lors de changements de rôle (voir invalidateAuthContext)
 * 
 * Performance attendue :
 * - Cache hit rate: 95-99% (la plupart des requêtes utilisent le cache)
 * - P99 latency: <5ms (cache) vs ~50ms (DB)
 * - Réduction DB load: ~99% sur les requêtes buildAuthContext
 */
@Injectable()
export class CachedAuthContextAdapter implements AuthContextPort {
  constructor(
    private prismaAdapter: PrismaAuthContextAdapter,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async buildAuthContext(jwtPayload: JwtPayload): Promise<AuthContext> {
    const cacheKey = this.getCacheKey(jwtPayload.sub);
    
    // 1. Essayer le cache (TTL: 5 min)
    const cached = await this.cacheManager.get<AuthContext>(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. Cache miss → charger depuis DB
    const context = await this.prismaAdapter.buildAuthContext(jwtPayload);
    
    // 3. Mettre en cache avec TTL 5 minutes
    await this.cacheManager.set(cacheKey, context, 300_000); // 300 secondes = 5 min
    
    return context;
  }

  /**
   * Invalider le cache pour un user spécifique
   * À appeler lors de changements de rôle platform
   */
  async invalidateAuthContext(userId: string): Promise<void> {
    const cacheKey = this.getCacheKey(userId);
    await this.cacheManager.del(cacheKey);
  }

  /**
   * Invalider le cache pour plusieurs users
   * À appeler lors de propagations de rôles en masse
   */
  async invalidateMultiple(userIds: string[]): Promise<void> {
    const keys = userIds.map((id) => this.getCacheKey(id));
    await Promise.all(keys.map((key) => this.cacheManager.del(key)));
  }

  private getCacheKey(userId: string): string {
    return `auth_context:${userId}`;
  }
}
```

### 6. Configuration du Cache Module

**`src/platform/authz/authz.module.ts`** (MODIFIER)

```typescript
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

// Core
import { AuthorizationService } from './core/authorization.service';
import { PermissionResolver } from './core/permission-resolver';
import { ScopeEvaluator } from './core/scope-evaluator';

// Ports
import { RbacQueryPort } from './ports/rbac-query.port';
import { MembershipPort } from './ports/membership.port';
import { ModuleGatingPort } from './ports/module-gating.port';
import { AuthContextPort } from './ports/auth-context.port';

// Adapters DB
import { PrismaRbacQueryAdapter } from './adapters/db/prisma-rbac-query.adapter';
import { PrismaMembershipAdapter } from './adapters/db/prisma-membership.adapter';
import { PrismaModuleGatingAdapter } from './adapters/db/prisma-module-gating.adapter';
import { PrismaAuthContextAdapter } from './adapters/db/prisma-auth-context.adapter';

// Adapters Cache
import { CachedAuthContextAdapter } from './adapters/cache/cached-auth-context.adapter';

// Adapters HTTP
import { RequirePermissionGuard } from './adapters/http/guards/require-permission.guard';
import { RbacAdminController } from './adapters/http/controllers/rbac-admin.controller';

@Module({
  imports: [
    // Configuration du cache Redis
    CacheModule.registerAsync({
      isGlobal: false, // Localisé au module authz
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
          },
          password: process.env.REDIS_PASSWORD,
          ttl: 300_000, // TTL par défaut 5 min (peut être overridé par adapter)
        }),
      }),
    }),
  ],
  providers: [
    // Core services
    AuthorizationService,
    PermissionResolver,
    ScopeEvaluator,

    // Adapters DB
    PrismaRbacQueryAdapter,
    PrismaMembershipAdapter,
    PrismaModuleGatingAdapter,
    PrismaAuthContextAdapter, // Adapter DB brut

    // Adapters Cache
    CachedAuthContextAdapter, // Wrapper avec cache

    // Bindings des ports
    {
      provide: RbacQueryPort,
      useClass: PrismaRbacQueryAdapter,
    },
    {
      provide: MembershipPort,
      useClass: PrismaMembershipAdapter,
    },
    {
      provide: ModuleGatingPort,
      useClass: PrismaModuleGatingAdapter,
    },
    {
      provide: AuthContextPort,
      useClass: CachedAuthContextAdapter, // ✅ Utilise la version cachée
    },

    // Guards
    RequirePermissionGuard,
  ],
  controllers: [RbacAdminController],
  exports: [
    AuthorizationService,
    RequirePermissionGuard,
    AuthContextPort, // Export pour utilisation externe
    CachedAuthContextAdapter, // Export pour invalidation manuelle
  ],
})
export class AuthzModule {}
```

### 7. Variables d'Environnement

**`.env`** (AJOUTER)

```bash
# Redis Configuration (pour cache AuthContext)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here
```

**`.env.example`** (AJOUTER)

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### 8. Installation des Dépendances

**`package.json`** (AJOUTER)

```bash
npm install cache-manager cache-manager-redis-yet redis
npm install --save-dev @types/cache-manager
```

---

## 🔍 Utilisation de l'Invalidation du Cache

### Cas 1 : Changement de Rôle Platform

Lorsqu'un user se voit assigner ou retirer un rôle platform, invalider son cache :

```typescript
@Injectable()
export class RbacAdminService {
  constructor(
    private prisma: PrismaService,
    private cachedAuthContext: CachedAuthContextAdapter,
  ) {}

  async assignPlatformRole(userId: string, roleId: string) {
    // 1. Assigner le rôle
    await this.prisma.platformUserRole.upsert({
      where: { user_id: userId },
      create: { user_id: userId, role_id: roleId },
      update: { role_id: roleId },
    });

    // 2. ✅ Invalider le cache AuthContext
    await this.cachedAuthContext.invalidateAuthContext(userId);
  }

  async revokePlatformRole(userId: string) {
    // 1. Supprimer le rôle
    await this.prisma.platformUserRole.delete({
      where: { user_id: userId },
    });

    // 2. ✅ Invalider le cache AuthContext
    await this.cachedAuthContext.invalidateAuthContext(userId);
  }
}
```

### Cas 2 : Propagation en Masse (STEP 5)

Lors de la propagation de rôles platform à plusieurs users :

```typescript
@Injectable()
export class PropagationService {
  constructor(
    private prisma: PrismaService,
    private cachedAuthContext: CachedAuthContextAdapter,
  ) {}

  async propagatePlatformRole(userIds: string[], roleId: string) {
    // 1. Assigner les rôles en masse
    await this.prisma.platformUserRole.createMany({
      data: userIds.map((userId) => ({
        user_id: userId,
        role_id: roleId,
      })),
      skipDuplicates: true,
    });

    // 2. ✅ Invalider le cache pour tous les users affectés
    await this.cachedAuthContext.invalidateMultiple(userIds);
  }
}
```

### Cas 3 : Auto-Invalidation par TTL

Pour les changements de rôle qui ne nécessitent pas d'invalidation immédiate (ex: changements rarement critiques), le TTL de 5 minutes garantit une cohérence éventuelle automatique.

---

## 📊 Monitoring du Cache

### Métriques à Suivre

**`src/platform/authz/adapters/cache/cached-auth-context.adapter.ts`** (AJOUTER)

```typescript
// ...existing code...

/**
 * Adapter avec cache Redis + métriques
 */
@Injectable()
export class CachedAuthContextAdapter implements AuthContextPort {
  // Compteurs pour monitoring
  private cacheHits = 0;
  private cacheMisses = 0;
  
  constructor(
    private prismaAdapter: PrismaAuthContextAdapter,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async buildAuthContext(jwtPayload: JwtPayload): Promise<AuthContext> {
    const cacheKey = this.getCacheKey(jwtPayload.sub);
    
    const cached = await this.cacheManager.get<AuthContext>(cacheKey);
    if (cached) {
      this.cacheHits++;
      return cached;
    }

    this.cacheMisses++;
    const context = await this.prismaAdapter.buildAuthContext(jwtPayload);
    await this.cacheManager.set(cacheKey, context, 300_000);
    
    return context;
  }

  /**
   * Récupérer les métriques de cache (pour health check / monitoring)
   */
  getMetrics() {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;

    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      total,
      hitRate: `${hitRate.toFixed(2)}%`,
    };
  }

  /**
   * Reset des métriques (pour tests ou monitoring périodique)
   */
  resetMetrics() {
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  private getCacheKey(userId: string): string {
    return `auth_context:${userId}`;
  }
}
```

### Endpoint de Monitoring

**`src/platform/authz/adapters/http/controllers/rbac-admin.controller.ts`** (AJOUTER)

```typescript
// filepath: /Users/rabiegharghar/Desktop/ems/attendee-ems-back/src/platform/authz/adapters/http/controllers/rbac-admin.controller.ts
// ...existing code...

@Controller('rbac')
@UseGuards(JwtAuthGuard, RequirePermissionGuard)
export class RbacAdminController {
  constructor(
    private prisma: PrismaService,
    private cachedAuthContext: CachedAuthContextAdapter, // ✅ Injecter
  ) {}

  // ...existing code...

  /**
   * Métriques du cache AuthContext
   * Nécessite permission platform (ROOT uniquement)
   */
  @Get('cache/metrics')
  @RequirePermission('platform.monitoring')
  async getCacheMetrics() {
    return this.cachedAuthContext.getMetrics();
  }

  /**
   * Invalider le cache d'un user spécifique
   * Utile après modification manuelle en DB
   */
  @Post('cache/invalidate/:userId')
  @RequirePermission('platform.cache.invalidate')
  async invalidateUserCache(@Param('userId') userId: string) {
    await this.cachedAuthContext.invalidateAuthContext(userId);
    return { message: 'Cache invalidated for user', userId };
  }
}
```

---

## 🎯 Checklist Mise à Jour

### Phase 1 : Infrastructure Cache
- [ ] Installer dépendances Redis (`cache-manager`, `cache-manager-redis-yet`)
- [ ] Configurer variables d'environnement Redis (`.env`)
- [ ] Setup Redis local (Docker ou installation native)
- [ ] Tester connexion Redis

### Phase 2 : Implémentation Adapters
- [ ] Créer `PrismaAuthContextAdapter` (adapter DB brut)
- [ ] Créer `CachedAuthContextAdapter` (wrapper avec cache)
- [ ] Configurer `AuthzModule` avec `CacheModule`
- [ ] Binder `AuthContextPort` sur `CachedAuthContextAdapter`

### Phase 3 : Monitoring
- [ ] Ajouter métriques dans `CachedAuthContextAdapter`
- [ ] Créer endpoint `GET /rbac/cache/metrics`
- [ ] Créer endpoint `POST /rbac/cache/invalidate/:userId`

### Phase 4 : Invalidation
- [ ] Implémenter `invalidateAuthContext()` dans les services
- [ ] Appeler lors d'assignation de rôle platform
- [ ] Appeler lors de révocation de rôle platform
- [ ] Appeler lors de propagations en masse (STEP 5)

### Phase 5 : Tests
- [ ] Test unitaire `CachedAuthContextAdapter`
- [ ] Test invalidation manuelle
- [ ] Test TTL automatique (attendre 5 min)
- [ ] Test métriques cache hit/miss
- [ ] Load test (vérifier 95%+ hit rate)

---

## 📈 Performance Attendue

### Avant Cache (DB direct)

```
Requêtes /me/ability par seconde : 1000
Temps moyen buildAuthContext : 50ms
Load DB platform_user_roles : ~1000 queries/s
P99 latency : ~150ms
```

### Après Cache Redis (STEP 3)

```
Requêtes /me/ability par seconde : 1000
Cache hit rate : 95-99%
Temps moyen buildAuthContext :
  - Cache hit : <5ms
  - Cache miss : ~50ms (DB)
Load DB platform_user_roles : ~10-50 queries/s (99% reduction)
P99 latency : ~10ms
```

---

## 📝 Notes de Mise à Jour (Janvier 2025)

### Décision Architecturale : Séparation Explicite Tenant/Platform

Suite à une revue architecturale, les méthodes du `RbacQueryPort` ont été refactorisées pour séparer explicitement les flux tenant et platform :

**Changements dans RbacQueryPort** :
- ❌ Supprimé : `getGrantsForRole(userId, orgId?)` (ambiguë)
- ❌ Supprimé : `getPlatformTenantAccessScope(userId)` (remplacé)
- ✅ Ajouté : `getTenantRoleForUserInOrg(userId, orgId)` (explicite)
- ✅ Ajouté : `getPlatformRoleForUser(userId)` (explicite)
- ✅ Ajouté : `getGrantsForTenantRole(roleId)` (séparé)
- ✅ Ajouté : `getGrantsForPlatformRole(roleId)` (séparé)

**Changements dans PermissionResolver** :
- ❌ Supprimé : `resolveGrants(userId, orgId)` (ancienne API)
- ✅ Ajouté : `resolveGrantsForContext(authContext)` (nouvelle API)
- ✅ Ajouté : `resolveTenantGrants(userId, orgId)` (privé)
- ✅ Ajouté : `resolvePlatformGrants(userId)` (privé)

**Changements dans AuthorizationService** :
- ✅ `can()` : Utilise maintenant `permissionResolver.resolveGrantsForContext(authContext)`
- ✅ `checkMembership()` : Utilise `getPlatformRoleForUser()` au lieu de `getPlatformTenantAccessScope()`

**Changements dans types.ts** :
- ✅ Ajouté : `TenantContext` (type dérivé pour type safety)
- ✅ Ajouté : `PlatformContext` (type dérivé pour type safety)

**Bénéfices** :
1. **Type Safety** : Les types `TenantContext` et `PlatformContext` garantissent l'utilisation correcte
2. **Clarté** : Le code auto-documente les flux tenant vs platform
3. **Cache** : Clés de cache différentes selon le contexte (userId:orgId vs userId)
4. **Testabilité** : Tests plus explicites et moins de cas limites
5. **Évolutivité** : Facilite l'ajout de nouvelles fonctionnalités tenant/platform

**Intégration avec STEP 2 (JWT Minimal)** :
- JWT minimal : `{ sub, mode, currentOrgId? }`
- AuthContextPort enrichit avec `isPlatform`, `isRoot` depuis DB
- PermissionResolver route vers tenant ou platform selon `authContext.mode`
- Cache AuthContext avec TTL 5min pour éviter stale data

**Références** :
- Discussion : ChatGPT feedback sur la séparation tenant/platform
- Document de progression : [PROGRESS_STEP1_STEP2.md](./PROGRESS_STEP1_STEP2.md)
- Tests E2E : `test/step2-jwt-multi-org.e2e-spec.ts` (9/9 passing)

---

## ➡️ Prochaine Étape

**STEP 4** : Refactor Services & Application Layer  
→ Voir [STEP_4_REFACTOR_SERVICES.md](./STEP_4_REFACTOR_SERVICES.md)

Le cache AuthContext est opérationnel → on peut utiliser le core RBAC dans tous les services ! 🎯

---

## 📚 Références

- [NestJS Cache Module](https://docs.nestjs.com/techniques/caching)
- [cache-manager](https://www.npmjs.com/package/cache-manager)
- [cache-manager-redis-yet](https://www.npmjs.com/package/cache-manager-redis-yet)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)