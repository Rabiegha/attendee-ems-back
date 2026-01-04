# Refactor RBAC / Multi-tenant

## Vue d'ensemble

Ce dossier contient toute la documentation et les ressources pour le refactor complet du système RBAC (Role-Based Access Control) et l'implémentation du multi-tenant.

Le refactor est divisé en plusieurs étapes (steps) pour minimiser les risques et faciliter le testing.

---

## Structure du Refactor

```
STEP 1: Multi-tenant Model (DB-level) ✅ [CE DOCUMENT]
  ├─ Nouveau modèle de données avec contraintes DB strictes
  ├─ Support natif du multi-tenant (user dans N orgs)
  ├─ Séparation rôles tenant / rôles platform
  └─ Garanties d'intégrité au niveau PostgreSQL

STEP 2: Authorization Service (Application-level) 🚧 [À VENIR]
  ├─ Service centralisé d'autorisation
  ├─ Logique de vérification des permissions
  ├─ Guards et decorators NestJS
  └─ Context switching (org active)

STEP 3: Role Propagation (Template system) 🚧 [À VENIR]
  ├─ Templates de rôles platform
  ├─ Propagation automatique vers les orgs
  ├─ Synchronisation des permissions
  └─ Audit trail des changements

STEP 4: Advanced RBAC (Feature flags, conditions) 🚧 [À VENIR]
  ├─ Permissions conditionnelles
  ├─ Feature flags par org
  ├─ Time-based permissions
  └─ Data-level security
```

---

## STEP 1 : Multi-tenant Model ✅

### Status : PRÊT POUR IMPLÉMENTATION

### Documents

| Fichier | Description |
|---------|-------------|
| [STEP_1_MULTITENANT.md](./STEP_1_MULTITENANT.md) | 📖 Documentation complète du modèle |
| [STEP_1_EXECUTION_GUIDE.md](./STEP_1_EXECUTION_GUIDE.md) | 🚀 Guide d'exécution pas à pas |
| [STEP_1_DIAGRAMS.md](./STEP_1_DIAGRAMS.md) | 📊 Diagrammes visuels (ERD, flux, etc.) |

### Fichiers

| Fichier | Type | Description |
|---------|------|-------------|
| [schema.prisma](../../prisma/schema.prisma) | Schema | Modèle Prisma mis à jour |
| [migration.sql](../../prisma/migrations/STEP1_MULTITENANT_REFACTOR/migration.sql) | Migration | Migration SQL avec contraintes |
| [step1-multitenant.seed.ts](../../prisma/seeds/step1-multitenant.seed.ts) | Seed | Seed idempotent des rôles |
| [step1-multitenant.spec.ts](../../test/step1-multitenant.spec.ts) | Tests | Tests de validation |

### Ce qui change

#### Avant (Single-tenant)
```typescript
// User appartient à 1 seule org avec 1 rôle
users:
  - id
  - org_id (FK)
  - role_id (FK)
  - email (unique dans org)
```

#### Après (Multi-tenant)
```typescript
// User global avec N orgs et N rôles
users:
  - id
  - email (unique global)

org_users:
  - user_id, org_id (membership)

tenant_user_roles:
  - user_id, org_id, role_id (1 rôle par org)

platform_user_roles:
  - user_id, role_id (1 rôle platform max)
```

### Nouveaux Modèles

1. **OrgUser** : Membership (user ↔ org)
2. **TenantUserRole** : Assignation rôles tenant (1 par org)
3. **PlatformUserRole** : Assignation rôle platform (1 max global)
4. **PlatformUserOrgAccess** : Accès platform assigned

### Garanties DB

- ✅ Email unique global
- ✅ 1 rôle tenant actif par user par org (UNIQUE)
- ✅ 1 rôle platform max par user (UNIQUE)
- ✅ User doit être membre de l'org avant d'avoir un rôle (FK composite)
- ✅ Rôle doit appartenir à l'org (FK composite)
- ✅ Triggers empêchent les cross-assignments (tenant ↔ platform)

### Quick Start

```bash
# 1. Backup
pg_dump -U postgres -d attendee_ems > backup.sql

# 2. Générer le client Prisma
npx prisma generate

# 3. Appliquer la migration
npx prisma migrate deploy

# 4. Seed les rôles
npm run seed:step1

# 5. Valider
npx prisma studio
npm test -- step1-multitenant.spec.ts
```

📖 **Documentation complète** : [STEP_1_MULTITENANT.md](./STEP_1_MULTITENANT.md)  
🚀 **Guide d'exécution** : [STEP_1_EXECUTION_GUIDE.md](./STEP_1_EXECUTION_GUIDE.md)

---

## STEP 2 : Authorization Service 🚧

### Status : À VENIR

### Objectifs

- Service centralisé pour vérifier les permissions
- Guards NestJS pour protéger les routes
- Decorators pour injecter le contexte (user, org, role)
- Context switching (changer d'org active dans l'UI)

### Architecture Prévue

```typescript
@Injectable()
export class AuthorizationService {
  // Vérifier si user a permission dans org
  async can(
    userId: string,
    orgId: string,
    permission: string,
    scope: PermissionScope,
  ): Promise<boolean>;

  // Obtenir toutes les permissions d'un user dans une org
  async getUserPermissions(userId: string, orgId: string): Promise<Permission[]>;

  // Vérifier si user est root (bypass all)
  async isRoot(userId: string): Promise<boolean>;
}
```

### Guards Prévus

```typescript
@UseGuards(PermissionGuard)
@RequirePermission('events.write', 'org')
async createEvent(@CurrentUser() user, @CurrentOrg() org, @Body() dto) {
  // ...
}
```

---

## STEP 3 : Role Propagation 🚧

### Status : À VENIR

### Objectifs

- Templates de rôles platform (propagés automatiquement)
- Lors de la création d'une org : auto-créer les rôles clés
- Synchronisation des permissions depuis le template
- Audit trail des changements

### Exemples

```typescript
// Créer une org → auto-créer les rôles Admin/Manager/Staff/Viewer
await orgService.create({ name: 'New Org', slug: 'new-org' });

// Résultat : 4 rôles tenant créés automatiquement
// - Admin (level 1, managed_by_template: true)
// - Manager (level 2, managed_by_template: true)
// - Staff (level 3, managed_by_template: true)
// - Viewer (level 4, managed_by_template: true)
```

---

## STEP 4 : Advanced RBAC 🚧

### Status : À VENIR

### Objectifs

- Permissions conditionnelles (ex: can edit own events only)
- Feature flags par org (ex: beta features)
- Time-based permissions (ex: temporary access)
- Data-level security (ex: row-level security)

---

## Migration Path

### Phase 1 : Préparation ✅
- [x] Analyser l'architecture actuelle
- [x] Concevoir le nouveau modèle
- [x] Documenter les décisions (DECISION_NO_CASL.md, etc.)
- [x] Définir le plan en steps

### Phase 2 : STEP 1 - Multi-tenant Model ✅
- [x] Créer le nouveau schéma Prisma
- [x] Créer la migration SQL avec contraintes
- [x] Créer le seed idempotent
- [x] Créer les tests de validation
- [x] Documenter

### Phase 3 : STEP 2 - Authorization Service 🚧
- [ ] Implémenter AuthorizationService
- [ ] Créer les guards NestJS
- [ ] Créer les decorators
- [ ] Adapter les controllers existants
- [ ] Tests d'intégration

### Phase 4 : STEP 3 - Role Propagation 🚧
- [ ] Implémenter le système de templates
- [ ] Propagation auto lors de la création d'org
- [ ] Synchronisation des permissions
- [ ] Audit trail

### Phase 5 : STEP 4 - Advanced RBAC 🚧
- [ ] Permissions conditionnelles
- [ ] Feature flags
- [ ] Time-based permissions
- [ ] Data-level security

---

## Principes de Design

### 1. Fiabilité > Facilité
- Les invariants sont garantis au niveau DB (contraintes, triggers)
- Pas de logique métier critique uniquement dans l'application
- Les FK composites empêchent les incohérences

### 2. Séparation des Responsabilités
- Rôles tenant ≠ rôles platform (2 tables séparées)
- Chaque table a une responsabilité unique et claire
- Pas de colonnes nullable complexes

### 3. Explicit > Implicit
- Les relations sont explicites (FK composites)
- Les contraintes sont nommées et documentées
- Les triggers ont des noms clairs

### 4. Testabilité
- Chaque étape est testable indépendamment
- Tests unitaires + tests d'intégration
- Scripts de validation inclus

### 5. Documentation
- Chaque décision est documentée
- Exemples de code inclus
- Diagrammes visuels fournis

---

## Décisions Architecturales

| Décision | Document | Raison |
|----------|----------|--------|
| Pas de CASL | [DECISION_NO_CASL.md](../DECISION_NO_CASL.md) | Simplicité, contrôle, performance |
| 2 tables d'assignation | [STEP_1_MULTITENANT.md](./STEP_1_MULTITENANT.md) | Contraintes DB fiables (pas de NULL) |
| FK composites | [STEP_1_MULTITENANT.md](./STEP_1_MULTITENANT.md) | Garantir les invariants au niveau DB |
| Triggers de validation | [migration.sql](../../prisma/migrations/STEP1_MULTITENANT_REFACTOR/migration.sql) | Empêcher cross-assignments |

---

## Tests

### Tests Unitaires
```bash
# Tests du modèle multi-tenant
npm test -- step1-multitenant.spec.ts

# Tests de l'authorization service (STEP 2)
npm test -- authorization.service.spec.ts
```

### Tests d'Intégration
```bash
# Tests E2E avec le nouveau modèle
npm run test:e2e
```

### Tests Manuels
```bash
# Ouvrir Prisma Studio pour inspecter les données
npx prisma studio
```

---

## Ressources

### Documentation Interne
- [ARCHITECTURE_RBAC.md](../ARCHITECTURE_RBAC.md) : Architecture générale
- [DECISION_NO_CASL.md](../DECISION_NO_CASL.md) : Pourquoi pas CASL
- [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) : Schéma DB complet
- [GETTING_STARTED_RBAC.md](../GETTING_STARTED_RBAC.md) : Guide de démarrage

### Documentation Externe
- [Prisma Docs](https://www.prisma.io/docs) : Documentation Prisma
- [PostgreSQL Docs](https://www.postgresql.org/docs/) : Documentation PostgreSQL
- [NestJS RBAC](https://docs.nestjs.com/security/authorization) : Authorization NestJS

---

## Support

### Questions Fréquentes

**Q: Pourquoi 2 tables d'assignation au lieu d'1 seule ?**  
R: Les FK composites ne fonctionnent pas avec des colonnes nullable. 2 tables séparées permettent des contraintes UNIQUE et FK fiables.

**Q: Que se passe-t-il si je supprime un user ?**  
R: Cascade automatique : tous ses memberships, rôles tenant, rôle platform et accès platform sont supprimés.

**Q: Un user peut-il avoir à la fois un rôle tenant et un rôle platform ?**  
R: Oui ! Un user peut avoir N rôles tenant (1 par org) + 1 rôle platform.

**Q: Comment vérifier si un user est root ?**  
R: Vérifier si `platform_user_roles.role.is_root = true`. Si oui, bypass toute la logique d'autorisation.

### Contact

Pour toute question ou problème :
- Consulter la documentation complète
- Exécuter les tests de validation
- Ouvrir un ticket avec les logs d'erreur

---

**Dernière mise à jour** : 4 Janvier 2026  
**Version** : 1.0  
**Auteur** : GitHub Copilot
