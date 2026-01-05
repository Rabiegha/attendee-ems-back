# STEP 5 : Provisioning & Propagation Automatique

> **Statut** : 📋 **DOCUMENTATION PRÉPARATOIRE**  
> **Prérequis** : ✅ STEP 1-4 complétés  
> **Durée estimée** : 2-3 jours (implémentation future)  
> **Priorité** : 🟡 **MOYEN** (amélioration scalabilité)

## 🎯 Objectif

Automatiser la **gestion des rôles et permissions à grande échelle** :
- **Provisioning** : Créer automatiquement les rôles/permissions pour une nouvelle org
- **Propagation** : Mettre à jour en masse les permissions sur toutes les orgs
- **Templates** : Définir des templates de rôles réutilisables

## ❓ Pourquoi ce STEP ?

**Sans automatisation** :
- ❌ Créer manuellement les rôles pour chaque nouvelle org (fastidieux)
- ❌ Mettre à jour les permissions org par org (erreurs, incohérences)
- ❌ Difficile de garantir la cohérence entre les orgs

**Avec automatisation** :
- ✅ Nouvelle org → rôles créés automatiquement
- ✅ Nouvelle permission → propagée à toutes les orgs en 1 commande
- ✅ Templates réutilisables (preset "Events Only", "Full Access", etc.)

---

## 📐 Architecture

```
src/platform/provisioning/
├── core/
│   ├── provisioning.service.ts      # Logique de provisioning
│   ├── propagation.service.ts       # Logique de propagation
│   └── template-registry.ts         # Templates de rôles
├── templates/
│   ├── default-roles.template.ts    # Rôles par défaut (ADMIN, MANAGER, etc.)
│   ├── events-only.template.ts      # Preset "Events Only"
│   └── full-access.template.ts      # Preset "Full Access"
├── commands/
│   ├── provision-org.command.ts     # CLI: provision nouvelle org
│   └── propagate-permission.command.ts # CLI: propager permission
└── provisioning.module.ts
```

---

## 🧩 Concepts Clés

### 1. Role Template

Un template définit un rôle réutilisable :

```typescript
interface RoleTemplate {
  code: string;           // 'ADMIN', 'MANAGER', etc.
  name: string;           // 'Administrator'
  level: number;          // Hiérarchie (1 = plus haut)
  permissions: Array<{
    key: string;          // 'event.create'
    scopeLimit: ScopeLimit; // 'org', 'own', 'assigned', 'any'
  }>;
}
```

### 2. Provisioning

Créer automatiquement les rôles pour une nouvelle org :

```typescript
await provisioningService.provisionOrg('new-org-id', {
  template: 'default', // Utilise le template par défaut
  // OU
  roles: [customRole1, customRole2], // Rôles custom
});
```

### 3. Propagation

Ajouter une nouvelle permission à tous les rôles ADMIN de toutes les orgs :

```typescript
await propagationService.propagatePermission({
  permissionKey: 'analytics.view',
  targetRoles: ['ADMIN', 'MANAGER'], // Codes des rôles
  scopeLimit: 'org',
  filter: {
    // Optionnel: filtrer les orgs
    planLevel: 'pro', // Seulement les orgs Pro/Enterprise
  },
});
```

---

## 📝 Implémentation V1 (MVP)

### 1. Template Registry

**`templates/default-roles.template.ts`**

```typescript
import { RoleTemplate } from '../core/types';
import { ScopeLimit } from '@/platform/authz/core/types';
import { PERMISSIONS } from '@/platform/authz/permission-registry';

export const DEFAULT_ROLES: RoleTemplate[] = [
  {
    code: 'ADMIN',
    name: 'Administrator',
    level: 1,
    permissions: [
      // Events
      { key: PERMISSIONS.EVENT_CREATE, scopeLimit: ScopeLimit.ORG },
      { key: PERMISSIONS.EVENT_READ, scopeLimit: ScopeLimit.ORG },
      { key: PERMISSIONS.EVENT_UPDATE, scopeLimit: ScopeLimit.ORG },
      { key: PERMISSIONS.EVENT_DELETE, scopeLimit: ScopeLimit.ORG },
      
      // Attendees
      { key: PERMISSIONS.ATTENDEE_CREATE, scopeLimit: ScopeLimit.ORG },
      { key: PERMISSIONS.ATTENDEE_READ, scopeLimit: ScopeLimit.ORG },
      { key: PERMISSIONS.ATTENDEE_UPDATE, scopeLimit: ScopeLimit.ORG },
      { key: PERMISSIONS.ATTENDEE_DELETE, scopeLimit: ScopeLimit.ORG },
      
      // Users
      { key: PERMISSIONS.USER_CREATE, scopeLimit: ScopeLimit.ORG },
      { key: PERMISSIONS.USER_READ, scopeLimit: ScopeLimit.ORG },
      { key: PERMISSIONS.USER_UPDATE, scopeLimit: ScopeLimit.ORG },
      { key: PERMISSIONS.USER_DELETE, scopeLimit: ScopeLimit.ORG },
      
      // RBAC
      { key: PERMISSIONS.RBAC_ROLE_READ, scopeLimit: ScopeLimit.ORG },
      { key: PERMISSIONS.RBAC_ROLE_ASSIGN, scopeLimit: ScopeLimit.ORG },
      
      // Badges
      { key: PERMISSIONS.BADGE_CREATE, scopeLimit: ScopeLimit.ORG },
      { key: PERMISSIONS.BADGE_READ, scopeLimit: ScopeLimit.ORG },
      { key: PERMISSIONS.BADGE_PRINT, scopeLimit: ScopeLimit.ORG },
    ],
  },
  {
    code: 'MANAGER',
    name: 'Manager',
    level: 2,
    permissions: [
      // Events
      { key: PERMISSIONS.EVENT_CREATE, scopeLimit: ScopeLimit.OWN },
      { key: PERMISSIONS.EVENT_READ, scopeLimit: ScopeLimit.ORG },
      { key: PERMISSIONS.EVENT_UPDATE, scopeLimit: ScopeLimit.OWN },
      { key: PERMISSIONS.EVENT_DELETE, scopeLimit: ScopeLimit.OWN },
      
      // Attendees
      { key: PERMISSIONS.ATTENDEE_CREATE, scopeLimit: ScopeLimit.ORG },
      { key: PERMISSIONS.ATTENDEE_READ, scopeLimit: ScopeLimit.ORG },
      { key: PERMISSIONS.ATTENDEE_UPDATE, scopeLimit: ScopeLimit.ORG },
      
      // Badges
      { key: PERMISSIONS.BADGE_READ, scopeLimit: ScopeLimit.ORG },
      { key: PERMISSIONS.BADGE_PRINT, scopeLimit: ScopeLimit.ASSIGNED },
    ],
  },
  {
    code: 'VIEWER',
    name: 'Viewer',
    level: 5,
    permissions: [
      { key: PERMISSIONS.EVENT_READ, scopeLimit: ScopeLimit.ORG },
      { key: PERMISSIONS.ATTENDEE_READ, scopeLimit: ScopeLimit.ORG },
      { key: PERMISSIONS.BADGE_READ, scopeLimit: ScopeLimit.ORG },
    ],
  },
];
```

### 2. Provisioning Service

**`core/provisioning.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RoleTemplate } from './types';
import { DEFAULT_ROLES } from '../templates/default-roles.template';

@Injectable()
export class ProvisioningService {
  constructor(private prisma: PrismaService) {}

  /**
   * Provisionner une nouvelle organisation avec des rôles par défaut
   */
  async provisionOrg(orgId: string, options: ProvisionOptions = {}) {
    const templates = options.customRoles || DEFAULT_ROLES;

    return this.prisma.$transaction(async (tx) => {
      const createdRoles: string[] = [];

      for (const template of templates) {
        // 1. Créer le rôle
        const role = await tx.role.create({
          data: {
            org_id: orgId,
            code: template.code,
            name: template.name,
            level: template.level,
            is_platform: false,
            is_root: false,
          },
        });

        createdRoles.push(role.id);

        // 2. Assigner les permissions
        for (const perm of template.permissions) {
          // Trouver la permission globale
          const permission = await tx.permission.findUnique({
            where: { key: perm.key },
          });

          if (!permission) {
            console.warn(`Permission ${perm.key} not found, skipping`);
            continue;
          }

          // Créer la relation role_permission
          await tx.rolePermission.create({
            data: {
              role_id: role.id,
              permission_id: permission.id,
              scope_limit: perm.scopeLimit,
            },
          });
        }
      }

      return {
        orgId,
        rolesCreated: createdRoles.length,
        roleIds: createdRoles,
      };
    });
  }

  /**
   * Vérifier si une org est déjà provisionnée
   */
  async isOrgProvisioned(orgId: string): Promise<boolean> {
    const rolesCount = await this.prisma.role.count({
      where: { org_id: orgId },
    });
    return rolesCount > 0;
  }

  /**
   * Re-provisionner une org (écraser les rôles existants)
   */
  async reprovisionOrg(orgId: string, options: ProvisionOptions = {}) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Supprimer les rôles existants
      await tx.rolePermission.deleteMany({
        where: {
          role: { org_id: orgId },
        },
      });
      await tx.tenantUserRole.deleteMany({
        where: { org_id: orgId },
      });
      await tx.role.deleteMany({
        where: { org_id: orgId },
      });

      // 2. Provisionner à nouveau
      return this.provisionOrg(orgId, options);
    });
  }
}

interface ProvisionOptions {
  customRoles?: RoleTemplate[];
}
```

### 3. Propagation Service

**`core/propagation.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { ScopeLimit } from '@/platform/authz/core/types';

@Injectable()
export class PropagationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Propager une nouvelle permission à tous les rôles spécifiés
   */
  async propagatePermission(options: PropagatePermissionOptions) {
    const { permissionKey, targetRoleCodes, scopeLimit, filter } = options;

    // 1. Trouver la permission
    const permission = await this.prisma.permission.findUnique({
      where: { key: permissionKey },
    });

    if (!permission) {
      throw new NotFoundException(`Permission ${permissionKey} not found`);
    }

    // 2. Trouver les rôles cibles
    const roles = await this.prisma.role.findMany({
      where: {
        code: { in: targetRoleCodes },
        org_id: { not: null }, // Seulement rôles tenant
        ...(filter?.orgIds ? { org_id: { in: filter.orgIds } } : {}),
      },
    });

    // 3. Ajouter la permission à chaque rôle
    const created = [];
    for (const role of roles) {
      // Vérifier si déjà existant
      const existing = await this.prisma.rolePermission.findUnique({
        where: {
          role_id_permission_id: {
            role_id: role.id,
            permission_id: permission.id,
          },
        },
      });

      if (!existing) {
        await this.prisma.rolePermission.create({
          data: {
            role_id: role.id,
            permission_id: permission.id,
            scope_limit: scopeLimit,
          },
        });
        created.push(role.id);
      }
    }

    return {
      permissionKey,
      rolesUpdated: created.length,
      roleIds: created,
    };
  }

  /**
   * Retirer une permission de tous les rôles spécifiés
   */
  async revokePermission(options: RevokePermissionOptions) {
    const { permissionKey, targetRoleCodes, filter } = options;

    const permission = await this.prisma.permission.findUnique({
      where: { key: permissionKey },
    });

    if (!permission) {
      throw new NotFoundException(`Permission ${permissionKey} not found`);
    }

    const roles = await this.prisma.role.findMany({
      where: {
        code: { in: targetRoleCodes },
        org_id: { not: null },
        ...(filter?.orgIds ? { org_id: { in: filter.orgIds } } : {}),
      },
    });

    const roleIds = roles.map((r) => r.id);

    const result = await this.prisma.rolePermission.deleteMany({
      where: {
        role_id: { in: roleIds },
        permission_id: permission.id,
      },
    });

    return {
      permissionKey,
      rolesUpdated: result.count,
    };
  }

  /**
   * Mettre à jour le scope d'une permission pour tous les rôles
   */
  async updatePermissionScope(options: UpdateScopeOptions) {
    const { permissionKey, targetRoleCodes, newScopeLimit, filter } = options;

    const permission = await this.prisma.permission.findUnique({
      where: { key: permissionKey },
    });

    if (!permission) {
      throw new NotFoundException(`Permission ${permissionKey} not found`);
    }

    const roles = await this.prisma.role.findMany({
      where: {
        code: { in: targetRoleCodes },
        org_id: { not: null },
        ...(filter?.orgIds ? { org_id: { in: filter.orgIds } } : {}),
      },
    });

    const updated = [];
    for (const role of roles) {
      await this.prisma.rolePermission.update({
        where: {
          role_id_permission_id: {
            role_id: role.id,
            permission_id: permission.id,
          },
        },
        data: {
          scope_limit: newScopeLimit,
        },
      });
      updated.push(role.id);
    }

    return {
      permissionKey,
      newScopeLimit,
      rolesUpdated: updated.length,
    };
  }
}

interface PropagatePermissionOptions {
  permissionKey: string;
  targetRoleCodes: string[];
  scopeLimit: ScopeLimit;
  filter?: {
    orgIds?: string[];
  };
}

interface RevokePermissionOptions {
  permissionKey: string;
  targetRoleCodes: string[];
  filter?: {
    orgIds?: string[];
  };
}

interface UpdateScopeOptions {
  permissionKey: string;
  targetRoleCodes: string[];
  newScopeLimit: ScopeLimit;
  filter?: {
    orgIds?: string[];
  };
}
```

---

## 🔧 CLI Commands

### 1. Provision Org Command

**`commands/provision-org.command.ts`**

```typescript
import { Command, CommandRunner, Option } from 'nest-commander';
import { ProvisioningService } from '../core/provisioning.service';

@Command({
  name: 'provision-org',
  description: 'Provision a new organization with default roles',
})
export class ProvisionOrgCommand extends CommandRunner {
  constructor(private provisioningService: ProvisioningService) {
    super();
  }

  async run(passedParams: string[], options?: ProvisionOrgOptions): Promise<void> {
    const orgId = passedParams[0];

    if (!orgId) {
      console.error('❌ orgId is required');
      process.exit(1);
    }

    console.log(`🔧 Provisioning organization: ${orgId}`);

    const result = await this.provisioningService.provisionOrg(orgId, {
      customRoles: options?.template === 'default' ? undefined : [],
    });

    console.log(`✅ Provisioned ${result.rolesCreated} roles`);
    console.log(`   Role IDs: ${result.roleIds.join(', ')}`);
  }

  @Option({
    flags: '-t, --template <template>',
    description: 'Template to use (default, events-only, full-access)',
    defaultValue: 'default',
  })
  parseTemplate(val: string): string {
    return val;
  }
}

interface ProvisionOrgOptions {
  template?: string;
}
```

**Usage :**
```bash
# Provisionner une nouvelle org avec le template par défaut
npm run cli provision-org <org-id>

# Avec un template spécifique
npm run cli provision-org <org-id> --template events-only
```

### 2. Propagate Permission Command

**`commands/propagate-permission.command.ts`**

```typescript
import { Command, CommandRunner, Option } from 'nest-commander';
import { PropagationService } from '../core/propagation.service';
import { ScopeLimit } from '@/platform/authz/core/types';

@Command({
  name: 'propagate-permission',
  description: 'Propagate a permission to all specified roles across all orgs',
})
export class PropagatePermissionCommand extends CommandRunner {
  constructor(private propagationService: PropagationService) {
    super();
  }

  async run(passedParams: string[], options?: PropagateOptions): Promise<void> {
    const permissionKey = passedParams[0];
    const targetRoles = options?.roles?.split(',') || [];
    const scopeLimit = (options?.scope as ScopeLimit) || ScopeLimit.ORG;

    if (!permissionKey || targetRoles.length === 0) {
      console.error('❌ permissionKey and --roles are required');
      process.exit(1);
    }

    console.log(`🔧 Propagating permission: ${permissionKey}`);
    console.log(`   Target roles: ${targetRoles.join(', ')}`);
    console.log(`   Scope: ${scopeLimit}`);

    const result = await this.propagationService.propagatePermission({
      permissionKey,
      targetRoleCodes: targetRoles,
      scopeLimit,
    });

    console.log(`✅ Updated ${result.rolesUpdated} roles`);
  }

  @Option({
    flags: '-r, --roles <roles>',
    description: 'Comma-separated list of role codes (ADMIN,MANAGER)',
  })
  parseRoles(val: string): string {
    return val;
  }

  @Option({
    flags: '-s, --scope <scope>',
    description: 'Scope limit (own, org, assigned, any)',
    defaultValue: 'org',
  })
  parseScope(val: string): string {
    return val;
  }
}

interface PropagateOptions {
  roles?: string;
  scope?: string;
}
```

**Usage :**
```bash
# Propager une nouvelle permission aux rôles ADMIN et MANAGER
npm run cli propagate-permission analytics.view --roles ADMIN,MANAGER --scope org
```

---

## 📊 Cas d'Usage

### Cas 1 : Nouvelle Organisation

```bash
# 1. Créer l'org dans la DB
INSERT INTO organizations (name, slug) VALUES ('Acme Inc', 'acme-inc');

# 2. Provisionner les rôles
npm run cli provision-org <org-id>

# Résultat : 3 rôles créés (ADMIN, MANAGER, VIEWER) avec toutes les permissions
```

### Cas 2 : Nouvelle Feature (Permission)

```typescript
// 1. Ajouter la permission dans la DB
await prisma.permission.create({
  data: {
    key: 'analytics.view',
    name: 'View Analytics',
    description: 'Access to analytics dashboard',
    module_key: 'analytics',
  },
});

// 2. Propager aux rôles ADMIN de toutes les orgs
npm run cli propagate-permission analytics.view --roles ADMIN --scope org
```

### Cas 3 : Changement de Scope

```bash
# Passer event.update de 'own' à 'org' pour tous les MANAGER
npm run cli update-scope event.update --roles MANAGER --scope org
```

---

## 📚 Documentation Complète (Future V2)

### Features Avancées (V2)

1. **Templates Personnalisables**
   - Preset "Events Only" (sans badges, sans analytics)
   - Preset "Full Access" (toutes les features)
   - Templates custom par client

2. **Propagation Conditionnelle**
   - Propager seulement aux orgs Pro/Enterprise
   - Exclure certaines orgs
   - Dry-run mode (preview avant propagation)

3. **Rollback**
   - Annuler une propagation
   - Restaurer un état précédent

4. **Audit & Logs**
   - Historique des propagations
   - Qui a propagé quoi et quand

---

## ✅ Checklist

- [ ] Créer `RoleTemplate` interface
- [ ] Créer templates par défaut (ADMIN, MANAGER, VIEWER)
- [ ] Implémenter `ProvisioningService`
- [ ] Implémenter `PropagationService`
- [ ] Créer CLI commands
- [ ] Tester provisioning nouvelle org
- [ ] Tester propagation permission
- [ ] Documentation CLI

---

## ➡️ Prochaine Étape

**STEP 6** : Module Gating (Plans)  
→ Voir [STEP_6_MODULE_GATING.md](./STEP_6_MODULE_GATING.md)

---

## 📚 Références

- [NestJS CLI](https://docs.nestjs.com/cli/overview)
- [nest-commander](https://www.npmjs.com/package/nest-commander)
- [Database Seeding Patterns](https://www.prisma.io/docs/guides/migrate/seed-database)
