# STEP 3 - Analyse des Écarts (Gap Analysis)

> **Date** : 9 janvier 2026  
> **Statut** : ✅ **CORE IMPLÉMENTÉ** avec quelques divergences vs doc

## 🎯 Résumé Exécutif

Le **cœur du STEP 3 est implémenté** et fonctionnel avec l'architecture hexagonale. Cependant, il y a des **divergences** entre la documentation (STEP_3_CORE_RBAC.md) et l'implémentation actuelle, ainsi que quelques **fonctionnalités manquantes**.

**Note importante** : La majorité des divergences sont dues au **refactor récent** (renommage `TenantAccessScope` → `PlatformAccessLevel`, `tenant_any`/`tenant_assigned` → `GLOBAL`/`LIMITED`). La documentation n'a pas été mise à jour.

---

## ✅ Ce qui est FAIT

### Core Business Logic
- ✅ `authorization.service.ts` - Moteur RBAC principal
- ✅ `decision.ts` - Types Decision + helper `Decisions`
- ✅ `types.ts` - AuthContext, RbacContext, Grant, TenantRole, PlatformRole
- ✅ `scope-evaluator.ts` - Évaluation des scopes (own/org/assigned/any)
- ✅ `permission-resolver.ts` - Résolution des grants (tenant + platform)

### Ports (Interfaces)
- ✅ `rbac-query.port.ts` - Avec séparation tenant/platform
- ✅ `membership.port.ts` - isMemberOfOrg, getPlatformOrgAccess
- ✅ `module-gating.port.ts` - isModuleEnabledForOrg
- ✅ `auth-context.port.ts` - buildAuthContext (JWT minimal → AuthContext complet)

### Adapters DB (Prisma)
- ✅ `prisma-rbac-query.adapter.ts` - Implémentation complète
- ✅ `prisma-membership.adapter.ts` - Implémentation complète
- ✅ `prisma-module-gating.adapter.ts` - Implémentation complète
- ✅ `prisma-auth-context.adapter.ts` - Implémentation complète

### HTTP Layer
- ✅ `require-permission.guard.ts` - Guard NestJS
- ✅ `require-permission.decorator.ts` - Decorators @RequirePermission, @RequireAllPermissions, @RequireAnyPermission
- ✅ `me-ability.controller.ts` - GET /me/ability
- ✅ `rbac-admin.controller.ts` - CRUD roles/assignations

### Infrastructure
- ✅ `authz.module.ts` - Configuration NestJS avec DI
- ✅ Migration DB pour `access_level` (PlatformAccessLevel)
- ✅ Seeds mis à jour avec GLOBAL/LIMITED

---

## ⚠️ Divergences Doc vs Code

### 1. Nomenclature `Scope` (MINEUR - Clarification nécessaire)

**Documentation** :
```typescript
// Doc utilise un enum
export enum ScopeLimit {
  OWN = 'own',
  ASSIGNED = 'assigned',
  ANY = 'any',
}
```

**Implémentation actuelle** :
```typescript
// Code utilise un type string
export type Scope = 'own' | 'org' | 'assigned' | 'any';
```

**Impact** : Aucun sur la fonctionnalité, mais confusion potentielle.

**Recommandation** : 
- **Option A** : Changer le code pour utiliser `enum ScopeLimit` (type safety ++)
- **Option B** : Mettre à jour la doc pour refléter `type Scope` (pragmatique)

**Décision suggérée** : Option B (garder le type, plus flexible)

---

### 2. Nomenclature `TenantAccessScope` → `PlatformAccessLevel` (MAJEUR - Doc obsolète)

**Documentation (obsolète)** :
```typescript
export enum TenantAccessScope {
  TENANT_ANY = 'tenant_any',
  TENANT_ASSIGNED = 'tenant_assigned',
}

interface PlatformRole {
  tenantAccessScope: TenantAccessScope;
}
```

**Implémentation actuelle (après refactor)** :
```typescript
// Database : enum PlatformAccessLevel { GLOBAL, LIMITED }
// TypeScript : 
interface PlatformRole {
  orgAccessLevel: 'GLOBAL' | 'LIMITED';
}
```

**Impact** : Documentation STEP_3_CORE_RBAC.md est obsolète.

**Action requise** : 
- ✅ Mise à jour déjà effectuée dans le code
- ❌ Documentation pas encore mise à jour

---

### 3. Naming `DecisionHelper` vs `Decisions` (MINEUR)

**Documentation** :
```typescript
export class DecisionHelper {
  static allow(): Decision;
  static deny(code, details): Decision;
}
```

**Implémentation actuelle** :
```typescript
export class Decisions {
  static allow(): Decision;
  static denyNoPermission(key): Decision;
  static denyScopeMismatch(key, scope, reason): Decision;
  static denyNoRole(): Decision;
  static denyNoOrgAccess(orgId): Decision;
}
```

**Impact** : Le code actuel est **meilleur** (méthodes spécifiques vs générique).

**Recommandation** : Mettre à jour la doc pour refléter `Decisions` avec ses méthodes spécifiques.

---

## ❌ Fonctionnalités Manquantes

### 1. Méthodes de Hiérarchie (IMPORTANT)

**Documentation prévoit** :
```typescript
class AuthorizationService {
  async canManageUser(managerId, targetUserId, orgId): Promise<Decision>
  async canAssignRole(managerId, targetRoleId, orgId): Promise<Decision>
}
```

**Implémentation actuelle** : ❌ Pas implémenté

**Impact** : Impossible de gérer la hiérarchie des rôles (niveau).

**Action requise** : Implémenter ces méthodes si nécessaire pour le MVP.

---

### 2. Méthode `assert()` (PRATIQUE)

**Documentation prévoit** :
```typescript
class AuthorizationService {
  async assert(permission, authContext, rbacContext): Promise<void>
  // Wrapper qui throw ForbiddenException si refusé
}
```

**Implémentation actuelle** : ❌ Pas implémenté

**Impact** : Les controllers doivent faire :
```typescript
const decision = await authzService.can(...);
if (!decision.allowed) throw new ForbiddenException(...);
```

Au lieu de simplement :
```typescript
await authzService.assert(...); // Throw automatique
```

**Action requise** : Ajouter cette méthode pour simplifier le code.

---

### 3. Decorator `@CurrentAuth()` (PRATIQUE)

**Documentation prévoit** :
```typescript
@Get('events')
async listEvents(@CurrentAuth() authContext: AuthContext) {
  // Pas besoin de construire manuellement l'AuthContext
}
```

**Implémentation actuelle** : ❌ Pas implémenté

**Impact** : Les controllers doivent faire :
```typescript
const jwtPayload = req.user;
const authContext = await this.authContextPort.buildAuthContext(jwtPayload);
```

**Action requise** : Créer le decorator pour simplifier l'usage.

---

### 4. Support `@RequireAllPermissions` / `@RequireAnyPermission` (COMPLET)

**Documentation prévoit** : Decorators définis

**Implémentation actuelle** : 
- ✅ Decorators créés dans `require-permission.decorator.ts`
- ❌ Guard ne les supporte PAS (seul `@RequirePermission` fonctionne)

**Impact** : Les decorators existent mais ne font rien.

**Action requise** : Mettre à jour `RequirePermissionGuard` pour gérer ces cas.

---

### 5. Extraction `RbacContext` (MVP)

**Documentation prévoit** :
```typescript
private extractRbacContext(request: Request): RbacContext {
  // Extraire resourceOwnerId, assignedUserIds depuis params/body
}
```

**Implémentation actuelle** :
```typescript
private extractRbacContext(request: Request): any {
  // MVP: contexte vide
  // TODO: Extraire depuis params/body/query
  const context: any = {};
  if (request.params.id) context.resourceId = request.params.id;
  if (request.params.orgId) context.resourceOrgId = request.params.orgId;
  return context;
}
```

**Impact** : Les scopes `own` et `assigned` ne fonctionnent pas complètement (pas de `resourceOwnerId` ni `assignedUserIds`).

**Action requise** : Implémenter l'extraction complète (peut-être via metadata du decorator ?).

---

### 6. Tests Unitaires (CRITIQUE)

**Documentation prévoit** : Tests avec mocks des ports

**Implémentation actuelle** : ❌ Aucun test `.spec.ts` trouvé

**Impact** : Impossible de valider le comportement RBAC sans tests manuels.

**Action requise** : Créer les tests unitaires pour :
- `authorization.service.spec.ts`
- `scope-evaluator.spec.ts`
- `permission-resolver.spec.ts`

---

## 📊 Tableau Récapitulatif

| Composant | Statut | Doc | Code | Action |
|-----------|--------|-----|------|--------|
| **Core Services** | | | | |
| authorization.service.ts | ✅ | ✅ | ✅ | Ajouter `assert()`, `canManageUser()`, `canAssignRole()` |
| decision.ts | ✅ | ⚠️ | ✅ | Doc : renommer `DecisionHelper` → `Decisions` |
| types.ts | ✅ | ⚠️ | ✅ | Doc : mettre à jour `TenantAccessScope` → `PlatformAccessLevel` |
| scope-evaluator.ts | ✅ | ✅ | ✅ | RAS |
| permission-resolver.ts | ✅ | ✅ | ✅ | RAS |
| **Ports** | | | | |
| rbac-query.port.ts | ✅ | ✅ | ✅ | RAS |
| membership.port.ts | ✅ | ✅ | ✅ | RAS |
| module-gating.port.ts | ✅ | ✅ | ✅ | RAS |
| auth-context.port.ts | ✅ | ✅ | ✅ | RAS |
| **Adapters DB** | | | | |
| prisma-rbac-query.adapter.ts | ✅ | ✅ | ✅ | RAS |
| prisma-membership.adapter.ts | ✅ | ✅ | ✅ | RAS |
| prisma-module-gating.adapter.ts | ✅ | ✅ | ✅ | RAS |
| prisma-auth-context.adapter.ts | ✅ | ✅ | ✅ | RAS |
| **HTTP Layer** | | | | |
| require-permission.guard.ts | ⚠️ | ✅ | ⚠️ | Ajouter support `@RequireAll/Any` |
| require-permission.decorator.ts | ✅ | ✅ | ✅ | RAS |
| @CurrentAuth decorator | ❌ | ✅ | ❌ | À créer |
| me-ability.controller.ts | ✅ | ✅ | ✅ | RAS |
| rbac-admin.controller.ts | ✅ | ✅ | ✅ | RAS |
| **Tests** | | | | |
| Tests unitaires | ❌ | ✅ | ❌ | À créer |
| **Documentation** | | | | |
| STEP_3_CORE_RBAC.md | ⚠️ | ⚠️ | - | Mettre à jour `TenantAccessScope` → `PlatformAccessLevel` |

**Légende** :
- ✅ Complet
- ⚠️ Partiellement implémenté ou doc obsolète
- ❌ Manquant

---

## 🎯 Priorisation des Actions

### 🔴 Priorité HAUTE (MVP Bloquant)
1. **Mettre à jour la documentation** : Remplacer tous les `TenantAccessScope.TENANT_ANY/TENANT_ASSIGNED` par `PlatformAccessLevel.GLOBAL/LIMITED`
2. **Implémenter `extractRbacContext()`** : Pour que les scopes `own` et `assigned` fonctionnent
3. **Tests unitaires critiques** : Au moins `authorization.service.spec.ts` pour valider le flow

### 🟡 Priorité MOYENNE (Post-MVP)
4. **Ajouter `assert()` method** : Pour simplifier les controllers
5. **Créer decorator `@CurrentAuth()`** : Pour injection AuthContext
6. **Support `@RequireAll/Any`** : Mettre à jour le guard

### 🟢 Priorité BASSE (Nice to Have)
7. **Méthodes hiérarchie** : `canManageUser()`, `canAssignRole()` si besoin
8. **Normaliser naming** : `ScopeLimit` enum vs `Scope` type (décider)

---

## 🚀 Conclusion

**Le STEP 3 est fonctionnel** pour le cas d'usage de base :
- ✅ Architecture hexagonale en place
- ✅ Core business logic implémenté
- ✅ Ports et adapters fonctionnels
- ✅ Guards et decorators de base

**Manquements principaux** :
- Documentation obsolète (nomenclature)
- Extraction RbacContext incomplète (MVP)
- Pas de tests unitaires
- Quelques méthodes helper manquantes

**Recommandation** : Mettre à jour la doc en priorité pour éviter la confusion, puis compléter l'extraction RbacContext et ajouter les tests.
