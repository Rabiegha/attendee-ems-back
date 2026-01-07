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
│   ├── rbac-query.port.ts         # getRoleForUserInOrg, getGrantsForRole
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
    // STEP 1: Vérifier le contexte tenant (si nécessaire)
    if (!authContext.currentOrgId) {
      return DecisionHelper.deny(DecisionCode.NO_TENANT_CONTEXT, {
        reason: 'No organization context provided',
      });
    }

    // STEP 2: Vérifier le membership / tenant access
    const membershipCheck = await this.checkMembership(authContext);
    if (!membershipCheck.allowed) {
      return membershipCheck;
    }

    // STEP 3: Résoudre les grants (permissions + scopes)
    const grants = await this.permissionResolver.resolveGrants(
      authContext.userId,
      authContext.currentOrgId,
    );

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

    // Platform user : vérifier tenant access
    const tenantAccessScope = await this.rbacQuery.getPlatformTenantAccessScope(userId);

    if (tenantAccessScope === TenantAccessScope.TENANT_ANY) {
      return DecisionHelper.allow();
    }

    if (tenantAccessScope === TenantAccessScope.TENANT_ASSIGNED) {
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
import { Grant } from './types';

/**
 * Résout les grants (permissions + scopes) d'un user dans une org
 * V1: Lecture depuis role_permissions
 * V2: Ajout des overrides (user_permissions)
 */
@Injectable()
export class PermissionResolver {
  constructor(private rbacQuery: RbacQueryPort) {}

  async resolveGrants(userId: string, orgId: string): Promise<Grant[]> {
    // V1: Charger les grants depuis le rôle
    const roleGrants = await this.rbacQuery.getGrantsForRole(userId, orgId);

    // V2 (futur): Merger avec les overrides
    // const overrides = await this.rbacQuery.getUserOverrides(userId, orgId);
    // return this.mergeGrants(roleGrants, overrides);

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

export abstract class RbacQueryPort {
  /**
   * Récupérer les grants (permissions + scopes) d'un user dans une org
   */
  abstract getGrantsForRole(userId: string, orgId: string): Promise<Grant[]>;

  /**
   * Récupérer le tenant access scope d'un platform user
   */
  abstract getPlatformTenantAccessScope(userId: string): Promise<TenantAccessScope | null>;

  /**
   * Récupérer le level d'un rôle dans une org
   * Utilisé pour vérifier la hiérarchie
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

  async getGrantsForRole(userId: string, orgId: string): Promise<Grant[]> {
    // 1. Récupérer le rôle tenant
    const tenantRole = await this.prisma.tenantUserRole.findUnique({
      where: {
        user_id_org_id: { user_id: userId, org_id: orgId },
      },
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

    if (tenantRole) {
      return tenantRole.role.rolePermissions.map((rp) => ({
        key: rp.permission.key,
        scopeLimit: rp.scope_limit as ScopeLimit,
        moduleKey: rp.permission.module_key || undefined,
      }));
    }

    // 2. Fallback sur platform role (si pas de tenant role)
    const platformRole = await this.prisma.platformUserRole.findUnique({
      where: { user_id: userId },
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

    if (platformRole) {
      return platformRole.role.rolePermissions.map((rp) => ({
        key: rp.permission.key,
        scopeLimit: rp.scope_limit as ScopeLimit,
        moduleKey: rp.permission.module_key || undefined,
      }));
    }

    return [];
  }

  async getPlatformTenantAccessScope(userId: string): Promise<TenantAccessScope | null> {
    const platformRole = await this.prisma.platformUserRole.findUnique({
      where: { user_id: userId },
      select: { scope: true },
    });

    if (!platformRole) {
      return null;
    }

    return platformRole.scope === 'global'
      ? TenantAccessScope.TENANT_ANY
      : TenantAccessScope.TENANT_ASSIGNED;
  }

  async getRoleLevel(userId: string, orgId: string): Promise<number | null> {
    const tenantRole = await this.prisma.tenantUserRole.findUnique({
      where: {
        user_id_org_id: { user_id: userId, org_id: orgId },
      },
      include: {
        role: {
          select: { level: true },
        },
      },
    });

    return tenantRole?.role.level ?? null;
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
 * Performance :
 * - 1 requête DB par appel
 * - Cacheable (ex: Redis, TTL 5 min)
 * - Index DB sur users.id + platform_user_roles.user_id
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
    // Note: Cette requête est cacheable (user_id est stable)
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

**Optimisation future (V2)** :
```typescript
// Ajouter un cache Redis
@Injectable()
export class CachedAuthContextAdapter implements AuthContextPort {
  constructor(
    private prismaAdapter: PrismaAuthContextAdapter,
    private cache: CacheService,
  ) {}

  async buildAuthContext(jwtPayload: JwtPayload): Promise<AuthContext> {
    const cacheKey = `auth_context:${jwtPayload.sub}`;
    
    // Essayer le cache (TTL: 5 min)
    const cached = await this.cache.get<AuthContext>(cacheKey);
    if (cached) return cached;

    // Charger depuis DB
    const context = await this.prismaAdapter.buildAuthContext(jwtPayload);
    
    // Mettre en cache
    await this.cache.set(cacheKey, context, 300); // 5 min TTL
    
    return context;
  }
}
```

---

## 🎨 Adapters HTTP

### 1. RequirePermissionGuard

**`adapters/http/guards/require-permission.guard.ts`**

```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationService } from '../../../core/authorization.service';
import { AuthContext, RbacContext } from '../../../core/types';
import { AuthContextPort } from '../../../ports/auth-context.port';
import { PERMISSION_KEY, RBAC_CONTEXT_KEY } from '../decorators/require-permission.decorator';
import { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';

/**
 * Guard NestJS pour vérifier les permissions RBAC
 * 
 * Flux :
 * 1. Extrait le JWT minimal depuis request.user
 * 2. Appelle authContextPort.buildAuthContext() pour obtenir AuthContext complet
 * 3. Extrait RbacContext depuis metadata ou request
 * 4. Appelle authorizationService.can() pour évaluer la permission
 * 5. Lance une exception si refusé
 */
@Injectable()
export class RequirePermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authz: AuthorizationService,
    private authContextPort: AuthContextPort, // 🆕 Injecter le port
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissionKey = this.reflector.get<string>(PERMISSION_KEY, context.getHandler());
    if (!permissionKey) {
      return true; // Pas de restriction
    }

    const request = context.switchToHttp().getRequest();
    const jwtPayload: JwtPayload = request.user; // JWT minimal

    if (!jwtPayload) {
      throw new UnauthorizedException('No JWT payload');
    }

    // 🔑 Construire AuthContext depuis JWT minimal + DB
    // Cette ligne fait 1 requête DB (cacheable)
    const authContext: AuthContext = await this.authContextPort.buildAuthContext(jwtPayload);

    // RbacContext optionnel (ex: resourceOwnerId injecté par le controller)
    const rbacContext: RbacContext = this.reflector.get<RbacContext>(
      RBAC_CONTEXT_KEY, 
      context.getHandler()
    ) || request['rbacContext'] || {};

    // Appeler le core RBAC (throw si refusé)
    await this.authz.assert(permissionKey, authContext, rbacContext);

    return true;
  }
}
```

**Performance** :
- 1 requête DB par requête HTTP (pour charger `isPlatform`/`isRoot`)
- Cacheable avec Redis (TTL 5 min) → 0 requête DB pour 99% des cas
- Index DB sur `platform_user_roles.user_id` → requête < 1ms

### 2. Decorator RequirePermission

**`adapters/http/decorators/require-permission.decorator.ts`**

```typescript
import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permission';
export const RBAC_CONTEXT_KEY = 'rbacContext';

export const RequirePermission = (key: string) => SetMetadata(PERMISSION_KEY, key);
```

### 3. Controller RBAC Admin (Minimal)

**`adapters/http/controllers/rbac-admin.controller.ts`**

```typescript
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { RequirePermissionGuard } from '../guards/require-permission.guard';
import { PrismaService } from '@/prisma/prisma.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';

@Controller('rbac')
@UseGuards(JwtAuthGuard, RequirePermissionGuard)
export class RbacAdminController {
  constructor(private prisma: PrismaService) {}

  /**
   * Lister les rôles de l'org
   */
  @Get('roles')
  @RequirePermission('rbac.role.read')
  async getRoles(@CurrentUser() user: JwtPayload) {
    return this.prisma.role.findMany({
      where: { org_id: user.currentOrgId },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });
  }

  /**
   * Assigner un rôle à un user (minimal)
   */
  @Post('assign-role')
  @RequirePermission('rbac.role.assign')
  async assignRole(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { userId: string; roleId: string },
  ) {
    // Vérifier que le rôle appartient à l'org
    const role = await this.prisma.role.findFirst({
      where: { id: dto.roleId, org_id: user.currentOrgId },
    });

    if (!role) {
      throw new NotFoundException('Role not found in this organization');
    }

    // Upsert le rôle tenant
    return this.prisma.tenantUserRole.upsert({
      where: {
        user_id_org_id: { user_id: dto.userId, org_id: user.currentOrgId },
      },
      create: {
        user_id: dto.userId,
        org_id: user.currentOrgId,
        role_id: dto.roleId,
      },
      update: {
        role_id: dto.roleId,
      },
    });
  }
}
```

> **⚠️ Note** : L'endpoint `GET /me/ability` est déjà implémenté dans **STEP 2** (`AuthController.getMyAbility()`).  
> Pas besoin de le dupliquer ici. Ce controller RBAC Admin gère uniquement la gestion des rôles.

---

## 🔝 Hiérarchie des Rôles (Role Hierarchy)

### Concept

La hiérarchie des rôles empêche un utilisateur de gérer des utilisateurs ayant un rôle égal ou supérieur au sien.

**Règle** : `level` plus PETIT = rôle plus HAUT dans la hiérarchie

```
Admin (level=1)     ← Plus haut
  ↓
Manager (level=2)
  ↓
Staff (level=3)
  ↓
Viewer (level=5)    ← Plus bas
```

**Exemples** :
- ✅ Admin (level=1) peut gérer Manager (level=2)
- ✅ Manager (level=2) peut gérer Staff (level=3)
- ❌ Manager (level=2) CANNOT gérer Admin (level=1)
- ❌ Manager (level=2) CANNOT gérer un autre Manager (level=2)

### Port : getRoleLevel()

**`ports/rbac-query.port.ts`**

```typescript
// filepath: /Users/rabiegharghar/Desktop/ems/attendee-ems-back/src/platform/authz/ports/rbac-query.port.ts
// ...existing code...

export abstract class RbacQueryPort {
  // ...existing code...

  /**
   * Récupérer le level d'un rôle dans une org
   * Utilisé pour vérifier la hiérarchie
   */
  abstract getRoleLevel(userId: string, orgId: string): Promise<number | null>;
}
```

### Adapter : PrismaRbacQueryAdapter

**`adapters/db/prisma-rbac-query.adapter.ts`**

```typescript
// filepath: /Users/rabiegharghar/Desktop/ems/attendee-ems-back/src/platform/authz/adapters/db/prisma-rbac-query.adapter.ts
// ...existing code...

@Injectable()
export class PrismaRbacQueryAdapter implements RbacQueryPort {
  // ...existing code...

  async getRoleLevel(userId: string, orgId: string): Promise<number | null> {
    const tenantRole = await this.prisma.tenantUserRole.findUnique({
      where: {
        user_id_org_id: { user_id: userId, org_id: orgId },
      },
      include: {
        role: {
          select: { level: true },
        },
      },
    });

    return tenantRole?.role.level ?? null;
  }
}
```

### Core : Nouvelles Méthodes dans AuthorizationService

**`core/authorization.service.ts`**

```typescript
// filepath: /Users/rabiegharghar/Desktop/ems/attendee-ems-back/src/platform/authz/core/authorization.service.ts
// ...existing code...

@Injectable()
export class AuthorizationService {
  // ...existing code...

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
import { Grant } from './types';

/**
 * Résout les grants (permissions + scopes) d'un user dans une org
 * V1: Lecture depuis role_permissions
 * V2: Ajout des overrides (user_permissions)
 */
@Injectable()
export class PermissionResolver {
  constructor(private rbacQuery: RbacQueryPort) {}

  async resolveGrants(userId: string, orgId: string): Promise<Grant[]> {
    // V1: Charger les grants depuis le rôle
    const roleGrants = await this.rbacQuery.getGrantsForRole(userId, orgId);

    // V2 (futur): Merger avec les overrides
    // const overrides = await this.rbacQuery.getUserOverrides(userId, orgId);
    // return this.mergeGrants(roleGrants, overrides);

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

export abstract class RbacQueryPort {
  /**
   * Récupérer les grants (permissions + scopes) d'un user dans une org
   */
  abstract getGrantsForRole(userId: string, orgId: string): Promise<Grant[]>;

  /**
   * Récupérer le tenant access scope d'un platform user
   */
  abstract getPlatformTenantAccessScope(userId: string): Promise<TenantAccessScope | null>;

  /**
   * Récupérer le level d'un rôle dans une org
   * Utilisé pour vérifier la hiérarchie
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

  async getGrantsForRole(userId: string, orgId: string): Promise<Grant[]> {
    // 1. Récupérer le rôle tenant
    const tenantRole = await this.prisma.tenantUserRole.findUnique({
      where: {
        user_id_org_id: { user_id: userId, org_id: orgId },
      },
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

    if (tenantRole) {
      return tenantRole.role.rolePermissions.map((rp) => ({
        key: rp.permission.key,
        scopeLimit: rp.scope_limit as ScopeLimit,
        moduleKey: rp.permission.module_key || undefined,
      }));
    }

    // 2. Fallback sur platform role (si pas de tenant role)
    const platformRole = await this.prisma.platformUserRole.findUnique({
      where: { user_id: userId },
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

    if (platformRole) {
      return platformRole.role.rolePermissions.map((rp) => ({
        key: rp.permission.key,
        scopeLimit: rp.scope_limit as ScopeLimit,
        moduleKey: rp.permission.module_key || undefined,
      }));
    }

    return [];
  }

  async getPlatformTenantAccessScope(userId: string): Promise<TenantAccessScope | null> {
    const platformRole = await this.prisma.platformUserRole.findUnique({
      where: { user_id: userId },
      select: { scope: true },
    });

    if (!platformRole) {
      return null;
    }

    return platformRole.scope === 'global'
      ? TenantAccessScope.TENANT_ANY
      : TenantAccessScope.TENANT_ASSIGNED;
  }

  async getRoleLevel(userId: string, orgId: string): Promise<number | null> {
    const tenantRole = await this.prisma.tenantUserRole.findUnique({
      where: {
        user_id_org_id: { user_id: userId, org_id: orgId },
      },
      include: {
        role: {
          select: { level: true },
        },
      },
    });

    return tenantRole?.role.level ?? null;
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
 * Performance :
 * - 1 requête DB par appel
 * - Cacheable (ex: Redis, TTL 5 min)
 * - Index DB sur users.id + platform_user_roles.user_id
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
    // Note: Cette requête est cacheable (user_id est stable)
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

**Optimisation future (V2)** :
```typescript
// Ajouter un cache Redis
@Injectable()
export class CachedAuthContextAdapter implements AuthContextPort {
  constructor(
    private prismaAdapter: PrismaAuthContextAdapter,
    private cache: CacheService,
  ) {}

  async buildAuthContext(jwtPayload: JwtPayload): Promise<AuthContext> {
    const cacheKey = `auth_context:${jwtPayload.sub}`;
    
    // Essayer le cache (TTL: 5 min)
    const cached = await this.cache.get<AuthContext>(cacheKey);
    if (cached) return cached;

    // Charger depuis DB
    const context = await this.prismaAdapter.buildAuthContext(jwtPayload);
    
    // Mettre en cache
    await this.cache.set(cacheKey, context, 300); // 5 min TTL
    
    return context;
  }
}
```

---

## 🎨 Adapters HTTP

### 1. RequirePermissionGuard

**`adapters/http/guards/require-permission.guard.ts`**

```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationService } from '../../../core/authorization.service';
import { AuthContext, RbacContext } from '../../../core/types';
import { AuthContextPort } from '../../../ports/auth-context.port';
import { PERMISSION_KEY, RBAC_CONTEXT_KEY } from '../decorators/require-permission.decorator';
import { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';

/**
 * Guard NestJS pour vérifier les permissions RBAC
 * 
 * Flux :
 * 1. Extrait le JWT minimal depuis request.user
 * 2. Appelle authContextPort.buildAuthContext() pour obtenir AuthContext complet
 * 3. Extrait RbacContext depuis metadata ou request
 * 4. Appelle authorizationService.can() pour évaluer la permission
 * 5. Lance une exception si refusé
 */
@Injectable()
export class RequirePermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authz: AuthorizationService,
    private authContextPort: AuthContextPort, // 🆕 Injecter le port
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissionKey = this.reflector.get<string>(PERMISSION_KEY, context.getHandler());
    if (!permissionKey) {
      return true; // Pas de restriction
    }

    const request = context.switchToHttp().getRequest();
    const jwtPayload: JwtPayload = request.user; // JWT minimal

    if (!jwtPayload) {
      throw new UnauthorizedException('No JWT payload');
    }

    // 🔑 Construire AuthContext depuis JWT minimal + DB
    // Cette ligne fait 1 requête DB (cacheable)
    const authContext: AuthContext = await this.authContextPort.buildAuthContext(jwtPayload);

    // RbacContext optionnel (ex: resourceOwnerId injecté par le controller)
    const rbacContext: RbacContext = this.reflector.get<RbacContext>(
      RBAC_CONTEXT_KEY, 
      context.getHandler()
    ) || request['rbacContext'] || {};

    // Appeler le core RBAC (throw si refusé)
    await this.authz.assert(permissionKey, authContext, rbacContext);

    return true;
  }
}
```

**Performance** :
- 1 requête DB par requête HTTP (pour charger `isPlatform`/`isRoot`)
- Cacheable avec Redis (TTL 5 min) → 0 requête DB pour 99% des cas
- Index DB sur `platform_user_roles.user_id` → requête < 1ms

### 2. Decorator RequirePermission

**`adapters/http/decorators/require-permission.decorator.ts`**

```typescript
import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permission';
export const RBAC_CONTEXT_KEY = 'rbacContext';

export const RequirePermission = (key: string) => SetMetadata(PERMISSION_KEY, key);
```

### 3. Controller RBAC Admin (Minimal)

**`adapters/http/controllers/rbac-admin.controller.ts`**

```typescript
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { RequirePermissionGuard } from '../guards/require-permission.guard';
import { PrismaService } from '@/prisma/prisma.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';

@Controller('rbac')
@UseGuards(JwtAuthGuard, RequirePermissionGuard)
export class RbacAdminController {
  constructor(private prisma: PrismaService) {}

  /**
   * Lister les rôles de l'org
   */
  @Get('roles')
  @RequirePermission('rbac.role.read')
  async getRoles(@CurrentUser() user: JwtPayload) {
    return this.prisma.role.findMany({
      where: { org_id: user.currentOrgId },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });
  }

  /**
   * Assigner un rôle à un user (minimal)
   */
  @Post('assign-role')
  @RequirePermission('rbac.role.assign')
  async assignRole(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { userId: string; roleId: string },
  ) {
    // Vérifier que le rôle appartient à l'org
    const role = await this.prisma.role.findFirst({
      where: { id: dto.roleId, org_id: user.currentOrgId },
    });

    if (!role) {
      throw new NotFoundException('Role not found in this organization');
    }

    // Upsert le rôle tenant
    return this.prisma.tenantUserRole.upsert({
      where: {
        user_id_org_id: { user_id: dto.userId, org_id: user.currentOrgId },
      },
      create: {
        user_id: dto.userId,
        org_id: user.currentOrgId,
        role_id: dto.roleId,
      },
      update: {
        role_id: dto.roleId,
      },
    });
  }
}
```

> **⚠️ Note** : L'endpoint `GET /me/ability` est déjà implémenté dans **STEP 2** (`AuthController.getMyAbility()`).  
> Pas besoin de le dupliquer ici. Ce controller RBAC Admin gère uniquement la gestion des rôles.

---

## 🔝 Hiérarchie des Rôles (Role Hierarchy)

### Concept

La hiérarchie des rôles empêche un utilisateur de gérer des utilisateurs ayant un rôle égal ou supérieur au sien.

**Règle** : `level` plus PETIT = rôle plus HAUT dans la hiérarchie

```
Admin (level=1)     ← Plus haut
  ↓
Manager (level=2)
  ↓
Staff (level=3)
  ↓
Viewer (level=5)    ← Plus bas
```

**Exemples** :
- ✅ Admin (level=1) peut gérer Manager (level=2)
- ✅ Manager (level=2) peut gérer Staff (level=3)
- ❌ Manager (level=2) CANNOT gérer Admin (level=1)
- ❌ Manager (level=2) CANNOT gérer un autre Manager (level=2)

### Port : getRoleLevel()

**`ports/rbac-query.port.ts`**

```typescript
// filepath: /Users/rabiegharghar/Desktop/ems/attendee-ems-back/src/platform/authz/ports/rbac-query.port.ts
// ...existing code...

export abstract class RbacQueryPort {
  // ...existing code...

  /**
   * Récupérer le level d'un rôle dans une org
   * Utilisé pour vérifier la hiérarchie
   */
  abstract getRoleLevel(userId: string, orgId: string): Promise<number | null>;
}
```

### Adapter : PrismaRbacQueryAdapter

**`adapters/db/prisma-rbac-query.adapter.ts`**

```typescript
// filepath: /Users/rabiegharghar/Desktop/ems/attendee-ems-back/src/platform/authz/adapters/db/prisma-rbac-query.adapter.ts
// ...existing code...

@Injectable()
export class PrismaRbacQueryAdapter implements RbacQueryPort {
  // ...existing code...

  async getRoleLevel(userId: string, orgId: string): Promise<number | null> {
    const tenantRole = await this.prisma.tenantUserRole.findUnique({
      where: {
        user_id_org_id: { user_id: userId, org_id: orgId },
      },
      include: {
        role: {
          select: { level: true },
        },
      },
    });

    return tenantRole?.role.level ?? null;
  }
}
```

### Core : Nouvelles Méthodes dans AuthorizationService

**`core/authorization.service.ts`**

```typescript
// filepath: /Users/rabiegharghar/Desktop/ems/attendee-ems-back/src/platform/authz/core/authorization.service.ts
// ...existing code...

@Injectable()
export class AuthorizationService {
  // ...existing code...

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
import { Grant } from './types';

/**
 * Résout les grants (permissions + scopes) d'un user dans une org
 * V1: Lecture depuis role_permissions
 * V2: Ajout des overrides (user_permissions)
 */
@Injectable()
export class PermissionResolver {
  constructor(private rbacQuery: RbacQueryPort) {}

  async resolveGrants(userId: string, orgId: string): Promise<Grant[]> {
    // V1: Charger les grants depuis le rôle
    const roleGrants = await this.rbacQuery.getGrantsForRole(userId, orgId);

    // V2 (futur): Merger avec les overrides
    // const overrides = await this.rbacQuery.getUserOverrides(userId, orgId);
    // return this.mergeGrants(roleGrants, overrides);

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

export abstract class RbacQueryPort {
  /**
   * Récupérer les grants (permissions + scopes) d'un user dans une org
   */
  abstract getGrantsForRole(userId: string, orgId: string): Promise<Grant[]>;

  /**
   * Récupérer le tenant access scope d'un platform user
   */
  abstract getPlatformTenantAccessScope(userId: string): Promise<TenantAccessScope | null>;

  /**
   * Récupérer le level d'un rôle dans une org
   * Utilisé pour vérifier la hiérarchie
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

  async getGrantsForRole(userId: string, orgId: string): Promise<Grant[]> {
    // 1. Récupérer le rôle tenant
    const tenantRole = await this.prisma.tenantUserRole.findUnique({
      where: {
        user_id_org_id: { user_id: userId, org_id: orgId },
      },
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

    if (tenantRole) {
      return tenantRole.role.rolePermissions.map((rp) => ({
        key: rp.permission.key,
        scopeLimit: rp.scope_limit as ScopeLimit,
        moduleKey: rp.permission.module_key || undefined,
      }));
    }

    // 2. Fallback sur platform role (si pas de tenant role)
    const platformRole = await this.prisma.platformUserRole.findUnique({
      where: { user_id: userId },
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

    if (platformRole) {
      return platformRole.role.rolePermissions.map((rp) => ({
        key: rp.permission.key,
        scopeLimit: rp.scope_limit as ScopeLimit,
        moduleKey: rp.permission.module_key || undefined,
      }));
    }

    return [];
  }

  async getPlatformTenantAccessScope(userId: string): Promise<TenantAccessScope | null> {
    const platformRole = await this.prisma.platformUserRole.findUnique({
      where: { user_id: userId },
      select: { scope: true },
    });

    if (!platformRole) {
      return null;
    }

    return platformRole.scope === 'global'
      ? TenantAccessScope.TENANT_ANY
      : TenantAccessScope.TENANT_ASSIGNED;
  }

  async getRoleLevel(userId: string, orgId: string): Promise<number | null> {
    const tenantRole = await this.prisma.tenantUserRole.findUnique({
      where: {
        user_id_org_id: { user_id: userId, org_id: orgId },
      },
      include: {
        role: {
          select: { level: true },
        },
      },
    });

    return tenantRole?.role.level ?? null;
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
export class PrismaModuleGatingAdapter implements ModuleG