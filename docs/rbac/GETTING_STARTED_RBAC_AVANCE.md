# Guide de démarrage rapide RBAC Avancé

Ce guide vous accompagne pas à pas pour démarrer l'implémentation du système RBAC avancé avec Guards séparés.

---

## 📋 Prérequis

- Node.js 18+
- PostgreSQL 14+
- NestJS 10+
- Prisma 5+

---

## 🚀 Phase 0 : Préparation (Jour 1)

### 1. Lire la documentation

Lire dans l'ordre :
1. `ARCHITECTURE_RBAC.md` - Vision d'ensemble (30 min)
2. `PLAN_IMPLEMENTATION_RBAC_AVANCE.md` - Plan détaillé (45 min)
3. Ce guide - Getting started (15 min)

### 2. Comprendre l'architecture

**Pipeline de Guards :**
```
Request → JwtAuthGuard → TenantContextGuard → ModuleGatingGuard → RequirePermissionGuard → Controller
```

**Services clés :**
- `RbacService` : Logique d'autorisation centrale
- `ModulesService` : Gating par plan/modules
- `PermissionRegistry` : Source de vérité TypeScript

### 3. Créer une branche de travail

```bash
git checkout -b feature/rbac-avance
```

---

## 🗄️ Phase 1 : Modèle de données (Jours 2-4)

### Étape 1 : Vérifier le schéma Prisma

Vérifier que ces tables existent dans `prisma/schema.prisma` :

```prisma
model OrgUser {
  id         String   @id @default(uuid())
  org_id     String
  user_id    String
  status     String   @default("active")
  is_default Boolean  @default(false)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@unique([user_id, org_id])
}

model UserRole {
  id         String   @id @default(uuid())
  user_id    String
  org_id     String
  role_id    String
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@unique([user_id, org_id, role_id])
}

model Role {
  id                        String   @id @default(uuid())
  org_id                    String?
  code                      String
  name                      String
  description               String?
  
  // Nouveaux champs RBAC
  rank                      Int      @default(0)
  is_platform               Boolean  @default(false)
  is_root                   Boolean  @default(false)
  role_type                 String   @default("custom")
  is_locked                 Boolean  @default(false)
  managed_by_template       Boolean  @default(false)
  permission_ceiling_scope  String   @default("own")
  
  created_at                DateTime @default(now())
  updated_at                DateTime @updatedAt

  @@unique([org_id, code])
}

model Permission {
  code                  String   @id
  description           String?
  resource              String
  action                String
  
  // Nouveaux champs RBAC
  module_key            String
  allowed_scopes        String[] @default([])
  default_scope_ceiling String   @default("own")
  
  created_at            DateTime @default(now())
  updated_at            DateTime @updatedAt
}

model RolePermission {
  role_id         String
  permission_code String
  
  // Nouveau champ
  scope           String   @default("own")
  conditions      Json?
  
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  @@id([role_id, permission_code])
}
```

### Étape 2 : Créer les migrations

```bash
# Ajouter les nouveaux champs aux tables existantes
npx prisma migrate dev --name add_rbac_fields
```

Contenu de la migration :

```sql
-- Ajouter champs RBAC à Role
ALTER TABLE "roles" ADD COLUMN "rank" INTEGER DEFAULT 0;
ALTER TABLE "roles" ADD COLUMN "is_platform" BOOLEAN DEFAULT false;
ALTER TABLE "roles" ADD COLUMN "is_root" BOOLEAN DEFAULT false;
ALTER TABLE "roles" ADD COLUMN "role_type" TEXT DEFAULT 'custom';
ALTER TABLE "roles" ADD COLUMN "is_locked" BOOLEAN DEFAULT false;
ALTER TABLE "roles" ADD COLUMN "managed_by_template" BOOLEAN DEFAULT false;
ALTER TABLE "roles" ADD COLUMN "permission_ceiling_scope" TEXT DEFAULT 'own';

-- Ajouter champs RBAC à Permission
ALTER TABLE "permissions" ADD COLUMN "module_key" TEXT;
ALTER TABLE "permissions" ADD COLUMN "allowed_scopes" TEXT[] DEFAULT '{}';
ALTER TABLE "permissions" ADD COLUMN "default_scope_ceiling" TEXT DEFAULT 'own';

-- Ajouter champs RBAC à RolePermission
ALTER TABLE "role_permissions" ADD COLUMN "scope" TEXT DEFAULT 'own';

-- Créer indexes
CREATE INDEX "idx_role_rank" ON "roles"("rank");
CREATE INDEX "idx_role_type" ON "roles"("role_type");
CREATE INDEX "idx_permission_module" ON "permissions"("module_key");
```

### Étape 3 : Mettre à jour le seeder de rôles

Éditer `prisma/seeders/roles.seeder.ts` :

```typescript
// AVANT (à remplacer)
{
  code: 'ADMIN',
  name: 'Administrateur',
  level: 1,  // ❌ À remplacer
  org_id: orgId
}

// APRÈS
{
  code: 'ADMIN',
  name: 'Administrateur',
  rank: 1,  // ✅ Nouveau
  role_type: 'tenant_admin',
  is_platform: false,
  is_root: false,
  is_locked: true,
  managed_by_template: true,
  permission_ceiling_scope: 'any',
  org_id: orgId
}
```

Définir les 3 rôles clés :

```typescript
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
```

### Étape 4 : Mettre à jour le seeder de permissions

Éditer `prisma/seeders/permissions.seeder.ts` :

```typescript
// AVANT
{
  code: 'event.read',
  description: 'Lire les événements',
  resource: 'event',
  action: 'read'
}

// APRÈS
{
  code: 'event.read',
  description: 'Lire les événements',
  resource: 'event',
  action: 'read',
  module_key: 'events',  // ✅ Ajouté
  allowed_scopes: ['own', 'assigned', 'team', 'org', 'any'],  // ✅ Ajouté
  default_scope_ceiling: 'org'  // ✅ Ajouté
}
```

### Étape 5 : Lancer les migrations et seeders

```bash
# Appliquer les migrations
npx prisma migrate dev

# Lancer les seeders
npm run seed

# Vérifier en BDD
npx prisma studio
```

**✅ Checklist Phase 1 :**
- [ ] Migrations créées et appliquées
- [ ] Champs RBAC ajoutés aux tables
- [ ] Seeders mis à jour
- [ ] `npm run seed` fonctionne
- [ ] App démarre sans erreur

---

## 📝 Phase 2 : PermissionRegistry (Jours 5-8)

### Étape 1 : Créer les types TypeScript

Créer `src/rbac/rbac.types.ts` :

```typescript
export type Scope = 'own' | 'assigned' | 'team' | 'org' | 'any';

export type RoleType =
  | 'tenant_admin'
  | 'tenant_manager'
  | 'tenant_staff'
  | 'support_L1'
  | 'support_L2'
  | 'custom';

export interface RbacContext {
  resourceTenantId?: string;
  actorTenantId: string;
  resourceOwnerId?: string;
  actorUserId: string;
  resourceTeamId?: string;
  actorTeamIds?: string[];
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

### Étape 2 : Créer le PermissionRegistry

Créer `src/rbac/permission-registry.ts` :

```typescript
import { PermissionDefinition, RoleType, Scope } from './rbac.types';

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
    description: 'Lire les événements',
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
    description: 'Créer un événement',
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
    description: 'Modifier un événement',
  },
  'event.delete': {
    module: 'events',
    allowedScopes: ['any'],
    defaultScopeCeiling: 'any',
    defaultScopesByRoleType: {
      tenant_admin: 'any',
    },
    description: 'Supprimer un événement',
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
    description: 'Lire les participants',
  },

  // TODO: Ajouter les 315+ permissions...
};

/**
 * Helper pour extraire le module d'une permission
 */
export function getModuleFromPermission(permissionKey: string): string {
  const def = PERMISSION_REGISTRY[permissionKey];
  if (!def) {
    throw new Error(`Permission ${permissionKey} not found in registry`);
  }
  return def.module;
}

/**
 * Helper pour valider un scope pour une permission
 */
export function isScopeAllowed(
  permissionKey: string,
  scope: Scope,
): boolean {
  const def = PERMISSION_REGISTRY[permissionKey];
  return def?.allowedScopes.includes(scope) ?? false;
}
```

### Étape 3 : Créer le script de synchronisation

Créer `scripts/sync-permissions.ts` :

```typescript
import { PrismaClient } from '@prisma/client';
import { PERMISSION_REGISTRY } from '../src/rbac/permission-registry';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Synchronisation des permissions...');

  let created = 0;
  let updated = 0;

  for (const [key, def] of Object.entries(PERMISSION_REGISTRY)) {
    const result = await prisma.permission.upsert({
      where: { code: key },
      create: {
        code: key,
        description: def.description || '',
        resource: key.split('.')[0],
        action: key.split('.').slice(1).join('.'),
        module_key: def.module,
        allowed_scopes: def.allowedScopes,
        default_scope_ceiling: def.defaultScopeCeiling,
      },
      update: {
        description: def.description || '',
        module_key: def.module,
        allowed_scopes: def.allowedScopes,
        default_scope_ceiling: def.defaultScopeCeiling,
      },
    });

    if (result.created_at === result.updated_at) {
      created++;
    } else {
      updated++;
    }
  }

  console.log(`✅ Permissions synchronisées : ${created} créées, ${updated} mises à jour`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors de la synchronisation :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Ajouter le script dans `package.json` :

```json
{
  "scripts": {
    "permissions:sync": "ts-node scripts/sync-permissions.ts"
  }
}
```

### Étape 4 : Tester le script

```bash
npm run permissions:sync
```

**✅ Checklist Phase 2 :**
- [ ] Types créés dans `rbac.types.ts`
- [ ] `PERMISSION_REGISTRY` créé avec 10+ permissions
- [ ] Script `sync-permissions.ts` fonctionne
- [ ] `npm run permissions:sync` exécute sans erreur

---

## ⚙️ Phase 3 : Services d'autorisation (Jours 9-15)

### Étape 1 : Créer ModulesService

Créer `src/rbac/modules.service.ts` :

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
      include: {
        plan: {
          include: {
            plan_modules: {
              where: { module_key: moduleKey },
            },
          },
        },
      },
    });

    if (!org?.plan) {
      return false; // Pas de plan = accès refusé
    }

    // 3. Vérifier si module dans le plan
    const planModule = org.plan.plan_modules[0];
    return planModule?.is_included_by_default ?? false;
  }

  async getEnabledModules(tenantId: string): Promise<string[]> {
    const org = await this.prisma.organization.findUnique({
      where: { id: tenantId },
      include: {
        plan: {
          include: { plan_modules: true },
        },
        org_module_overrides: true,
      },
    });

    if (!org?.plan) return [];

    const modules = new Set<string>();

    // Modules du plan
    for (const pm of org.plan.plan_modules) {
      if (pm.is_included_by_default) {
        modules.add(pm.module_key);
      }
    }

    // Appliquer overrides
    for (const override of org.org_module_overrides) {
      if (override.forced_status === 'enabled') {
        modules.add(override.module_key);
      } else if (override.forced_status === 'disabled') {
        modules.delete(override.module_key);
      }
    }

    return Array.from(modules);
  }
}
```

### Étape 2 : Créer RbacService

Créer `src/rbac/rbac.service.ts` - Voir le code complet dans `PLAN_IMPLEMENTATION_RBAC_AVANCE.md` Phase 3, section "Créer RbacService".

**Points clés :**
- ✅ Pas de dépendance à CASL - 100% custom
- ✅ Gestion complète des scopes (own, team, org, any)
- ✅ Vérification des modules activés
- ✅ Support multi-org et users plateforme
- ✅ Messages d'erreur clairs et explicites

### Étape 3 : Créer le module RBAC

Créer `src/rbac/rbac.module.ts` :

```typescript
import { Module } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { ModulesService } from './modules.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [RbacService, ModulesService],
  exports: [RbacService, ModulesService],
})
export class RbacModule {}
```

Importer dans `AppModule` :

```typescript
@Module({
  imports: [
    // ... autres imports
    RbacModule,
  ],
})
export class AppModule {}
```

### Étape 4 : Tester les services

Créer `scripts/test-authorization.ts` :

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RbacService } from '../src/rbac/rbac.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const rbacService = app.get(RbacService);

  // Test 1: User root
  console.log('Test 1: User root');
  const rootUser = {
    id: 'user-1',
    email: 'root@example.com',
    currentOrgId: 'org-1',
    is_root: true,
  };
  const canRoot = await rbacService.can(rootUser, 'event.delete', {
    actorTenantId: 'org-1',
    actorUserId: 'user-1',
  });
  console.log(`  ✅ Root can delete event: ${canRoot}`); // Devrait être true

  // Test 2: User admin
  console.log('Test 2: User admin');
  const adminUser = {
    id: 'user-2',
    email: 'admin@example.com',
    currentOrgId: 'org-1',
  };
  const canAdmin = await rbacService.can(adminUser, 'event.read', {
    actorTenantId: 'org-1',
    actorUserId: 'user-2',
    resourceTenantId: 'org-1',
  });
  console.log(`  ✅ Admin can read event: ${canAdmin}`);

  await app.close();
}

main();
```

```bash
ts-node scripts/test-authorization.ts
```

**✅ Checklist Phase 3 :**
- [ ] `ModulesService` créé
- [ ] `RbacService` créé
- [ ] Module RBAC créé et importé
- [ ] Tests manuels passent

---

## 🛡️ Phase 4 : Guards (Jours 16-20)

Voir `PLAN_IMPLEMENTATION_RBAC_AVANCE.md` Phase 4 pour les détails complets.

**Fichiers à créer :**
- `src/common/guards/tenant-context.guard.ts`
- `src/common/guards/module-gating.guard.ts`
- `src/common/guards/require-permission.guard.ts`
- `src/common/decorators/require-permission.decorator.ts`
- `src/common/decorators/require-module.decorator.ts`
- `src/common/decorators/scope-context.decorator.ts`

---

## 🎯 Phase 5 : Module pilote Events (Jours 21-24)

**Exemple de migration :**

```typescript
// src/modules/events/events.controller.ts

// AVANT
@Get()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('event.read')
async findAll() { }

// APRÈS
@Get()
@UseGuards(
  JwtAuthGuard,
  TenantContextGuard,
  ModuleGatingGuard,
  RequirePermissionGuard,
)
@RequirePermission('event.read')
async findAll() { }
```

---

## 📚 Ressources

- **Documentation :** `docs/ARCHITECTURE_RBAC.md`
- **Plan détaillé :** `docs/PLAN_IMPLEMENTATION_RBAC_AVANCE.md`
- **Schéma Prisma :** `prisma/schema.prisma`
- **Seeders :** `prisma/seeders/`

---

**Prêt à commencer ? 🚀**

Commencez par la Phase 1, puis progressez phase par phase en validant chaque checklist.
