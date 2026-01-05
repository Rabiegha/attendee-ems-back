# 🎯 Plan Final - Refactoring RBAC Multi-Tenant

> **Version** : 2.0  
> **Date** : 4 Janvier 2026  
> **Status** : ✅ STEP 1 complété, STEP 2-6 documentés

## 📋 Vue d'Ensemble

Ce document présente le plan **séquentiel et progressif** pour migrer l'application vers une architecture RBAC multi-tenant hexagonale.

**Principe** : **Pas de retour en arrière** → Chaque STEP est validé avant de passer au suivant.

---

## 🗺️ Roadmap Complète

### ✅ STEP 1 : Multi-Tenant Database (COMPLÉTÉ)

**Objectif** : Base de données multi-tenant avec contraintes strictes  
**Statut** : ✅ **FAIT** (4 Janvier 2026)  
**Durée réelle** : 1 jour

**Résultats** :
- ✅ Migration appliquée : User → OrgUser + TenantUserRole
- ✅ 22/22 tests d'intégration passés
- ✅ 21/21 validations DB passées
- ✅ Triggers check_platform_role et check_tenant_role actifs
- ✅ Seeders adaptés au nouveau modèle

**Fichiers clés** :
- [STEP_1_MULTITENANT.md](./STEP_1_MULTITENANT.md) - Documentation complète + REX
- `prisma/schema.prisma` - Nouveau modèle
- `test/step1-multitenant.spec.ts` - Tests de validation

**Leçons apprises** :
- Les seeders doivent gérer les transactions pour créer User + OrgUser + TenantUserRole atomiquement
- Les queries doivent toujours joindre `org_users` pour vérifier l'appartenance
- Prisma warnings sur `onDelete: SetNull` sont de faux positifs (bug Prisma)

---

### 📋 STEP 2 : JWT Multi-Organisation (À IMPLÉMENTER)

**Objectif** : JWT avec currentOrgId et switch d'organisation  
**Statut** : 📋 **DOCUMENTÉ** (prêt à implémenter)  
**Durée estimée** : 1-2 jours

**Ce qui sera fait** :
1. Refactor `JwtPayload` avec `currentOrgId` et `availableOrgs[]`
2. Créer `TenantContextGuard` pour injecter le contexte org
3. Endpoint `/auth/switch-org/:orgId`
4. Gestion refresh tokens avec currentOrgId
5. Tests d'intégration (switch org, context injection)

**Dépendances** :
- ✅ STEP 1 complété
- Besoin de mettre à jour tous les services qui utilisent JWT

**Validation** :
- [ ] Tests JWT avec currentOrgId
- [ ] Test switch org entre 2 orgs
- [ ] Test context injection dans guards

**Documentation** : [STEP_2_JWT_MULTI_ORG.md](./STEP_2_JWT_MULTI_ORG.md)

---

### 📋 STEP 3 : Core RBAC Hexagonal (À IMPLÉMENTER)

**Objectif** : Core RBAC avec architecture hexagonale (Ports & Adapters)  
**Statut** : 📋 **DOCUMENTÉ** (prêt à implémenter)  
**Durée estimée** : 2-3 jours

**Ce qui sera fait** :
1. Créer `AuthorizationService` (core domain)
2. Implémenter `ScopeEvaluator` et `PermissionResolver`
3. Définir interfaces SPI (RbacQueryPort, MembershipPort, ModuleGatingPort)
4. Créer adapters Prisma
5. Créer `RequirePermissionGuard` et `@RequirePermission` decorator
6. Tests unitaires du core (sans DB)

**Architecture** :
```
src/platform/authz/
├── core/               # Logique domaine (pas de dépendances externes)
│   ├── authorization.service.ts
│   ├── scope-evaluator.ts
│   └── permission-resolver.ts
├── spi/                # Interfaces (ports)
│   ├── rbac-query.port.ts
│   └── membership.port.ts
├── infrastructure/     # Adapters (Prisma, cache, etc.)
│   ├── prisma-rbac.adapter.ts
│   └── prisma-membership.adapter.ts
├── guards/
│   └── require-permission.guard.ts
└── decorators/
    └── require-permission.decorator.ts
```

**Dépendances** :
- ✅ STEP 1 complété
- ✅ STEP 2 complété (pour currentOrgId)

**Validation** :
- [ ] Tests unitaires AuthorizationService
- [ ] Tests unitaires ScopeEvaluator (own, org, assigned, any)
- [ ] Tests intégration guard + decorator
- [ ] Test isolation du core (pas de PrismaService direct)

**Documentation** : [STEP_3_CORE_RBAC.md](./STEP_3_CORE_RBAC.md)

---

### 📋 STEP 4 : Refactor Services (À IMPLÉMENTER)

**Objectif** : Migrer tous les services vers le nouveau modèle RBAC  
**Statut** : 📋 **DOCUMENTÉ** (prêt à implémenter)  
**Durée estimée** : 3-5 jours

**Ce qui sera fait** :
1. **Phase 1** : UsersService (référence)
   - Créer `create()` avec transaction (User + OrgUser + TenantUserRole)
   - Refactor `findAll()`, `findOne()` avec joins org_users
   - Refactor `update()` avec gestion rôles

2. **Phase 2** : Services critiques
   - EventsService
   - AttendeesService
   - RegistrationService

3. **Phase 3** : Services secondaires
   - BadgesService
   - CheckInsService
   - StatisticsService

4. **Phase 4** : Validation
   - Tous les tests E2E passent
   - Documentation API mise à jour

**Pattern de migration** :
```typescript
// AVANT
@Post()
async create(@Body() dto: CreateDto) {
  return this.service.create(dto);
}

// APRÈS
@Post()
@UseGuards(TenantContextGuard, RequirePermissionGuard)
@RequirePermission('resource.create')
async create(
  @Body() dto: CreateDto,
  @CurrentUser() user: JwtPayload
) {
  return this.service.create(user.currentOrgId, dto);
}
```

**Dépendances** :
- ✅ STEP 1, 2, 3 complétés

**Validation** :
- [ ] Tous les tests E2E passent
- [ ] Aucun accès direct à prisma.user sans join org_users
- [ ] Toutes les routes ont @RequirePermission
- [ ] Documentation Swagger mise à jour

**Documentation** : [STEP_4_REFACTOR_SERVICES.md](./STEP_4_REFACTOR_SERVICES.md)

---

### 🔧 STEP 5 : Provisioning (DOCUMENTATION PRÉPARATOIRE)

**Objectif** : Automatiser la gestion des rôles/permissions à grande échelle  
**Statut** : 🔧 **PRÉPARATOIRE** (non critique)  
**Priorité** : 🟡 **MOYEN**  
**Durée estimée** : 2-3 jours

**Ce qui sera fait** :
1. `ProvisioningService` (créer rôles pour nouvelle org)
2. `PropagationService` (propager permissions à toutes les orgs)
3. Templates de rôles (ADMIN, MANAGER, VIEWER)
4. CLI commands :
   - `npm run cli provision-org <org-id>`
   - `npm run cli propagate-permission <permission> --roles ADMIN,MANAGER`

**Cas d'usage** :
- Nouvelle org → Provisionner automatiquement 3 rôles par défaut
- Nouvelle feature → Propager la permission à tous les ADMIN

**Dépendances** :
- ✅ STEP 1-4 complétés

**Validation** :
- [ ] Provision nouvelle org → 3 rôles créés
- [ ] Propagation permission → X rôles mis à jour
- [ ] CLI commands fonctionnent

**Documentation** : [STEP_5_PROVISIONING.md](./STEP_5_PROVISIONING.md)

---

### 🔧 STEP 6 : Module Gating (DOCUMENTATION PRÉPARATOIRE)

**Objectif** : Restreindre l'accès aux modules selon le plan de l'organisation  
**Statut** : 🔧 **PRÉPARATOIRE** (non critique)  
**Priorité** : 🟡 **MOYEN** (monétisation)  
**Durée estimée** : 2-3 jours

**Ce qui sera fait** :
1. `ModuleGatingService` (vérifier accès module)
2. Plans (FREE, PRO, ENTERPRISE) avec modules inclus
3. `RequireModuleGuard` et `@RequireModule` decorator
4. Limites par plan (maxEvents, maxAttendees, etc.)

**Exemple** :
```typescript
@Controller('badges')
@UseGuards(TenantContextGuard, RequireModuleGuard, RequirePermissionGuard)
export class BadgesController {
  @RequireModule(AppModule.BADGES)  // ← Module gating
  @RequirePermission('badge.create') // ← RBAC
  @Post()
  async createBadge() { ... }
}
```

**Plans** :
- **FREE** : Events + Attendees (max 3 events, 100 attendees)
- **PRO** : + Badges + Analytics (max 50 events, 5000 attendees)
- **ENTERPRISE** : + Advanced Analytics + Integrations (unlimited)

**Dépendances** :
- ✅ STEP 1-5 complétés

**Validation** :
- [ ] Test accès badge (FREE → 403, PRO → 200)
- [ ] Test limites (maxEvents dépassé → 403)
- [ ] Frontend masque menus selon plan

**Documentation** : [STEP_6_MODULE_GATING.md](./STEP_6_MODULE_GATING.md)

---

## 📊 Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1 : Fondation Multi-Tenant (1-2 semaines)                │
├─────────────────────────────────────────────────────────────────┤
│ ✅ STEP 1 : DB multi-tenant          │ 1j     │ FAIT           │
│ ⏳ STEP 2 : JWT multi-org             │ 1-2j   │ À FAIRE        │
│ ⏳ STEP 3 : Core RBAC hexagonal       │ 2-3j   │ À FAIRE        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Phase 2 : Implémentation (2-3 semaines)                        │
├─────────────────────────────────────────────────────────────────┤
│ ⏳ STEP 4 : Refactor services         │ 3-5j   │ À FAIRE        │
│ ⏳ Tests E2E complets                 │ 2j     │ À FAIRE        │
│ ⏳ Documentation API                  │ 1j     │ À FAIRE        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Phase 3 : Optimisation (optionnel, non bloquant)               │
├─────────────────────────────────────────────────────────────────┤
│ ⏳ STEP 5 : Provisioning              │ 2-3j   │ OPTIONNEL      │
│ ⏳ STEP 6 : Module Gating             │ 2-3j   │ OPTIONNEL      │
│ ⏳ Analytics & Monitoring             │ 1-2j   │ OPTIONNEL      │
└─────────────────────────────────────────────────────────────────┘
```

**Total Phase 1+2** : 8-13 jours (2-3 semaines)  
**Total avec Phase 3** : 13-21 jours (3-4 semaines)

---

## ✅ Checklist Globale

### Phase 1 : Fondation (Critical Path)
- [x] **STEP 1** : DB multi-tenant ✅
- [ ] **STEP 2** : JWT multi-org
  - [ ] JwtPayload avec currentOrgId
  - [ ] TenantContextGuard
  - [ ] Endpoint /auth/switch-org
  - [ ] Tests JWT
- [ ] **STEP 3** : Core RBAC
  - [ ] AuthorizationService
  - [ ] ScopeEvaluator
  - [ ] Interfaces SPI
  - [ ] Adapters Prisma
  - [ ] RequirePermissionGuard
  - [ ] Tests unitaires core

### Phase 2 : Implémentation (Critical Path)
- [ ] **STEP 4** : Refactor services
  - [ ] Phase 1: UsersService
  - [ ] Phase 2: EventsService, AttendeesService
  - [ ] Phase 3: BadgesService, CheckInsService
  - [ ] Phase 4: Tests E2E + Documentation

### Phase 3 : Optimisation (Optionnel)
- [ ] **STEP 5** : Provisioning
  - [ ] ProvisioningService
  - [ ] PropagationService
  - [ ] Templates de rôles
  - [ ] CLI commands
- [ ] **STEP 6** : Module Gating
  - [ ] ModuleGatingService
  - [ ] Plans (FREE, PRO, ENTERPRISE)
  - [ ] RequireModuleGuard
  - [ ] Limites par plan

---

## 🎯 Principes de Migration

### 1. Séquentiel (Pas de Retour en Arrière)

Chaque STEP doit être **complètement terminé et validé** avant de passer au suivant :

```
STEP 1 → Tests ✅ → Validation ✅ → Documentation ✅
   ↓
STEP 2 → Tests ✅ → Validation ✅ → Documentation ✅
   ↓
STEP 3 → ...
```

### 2. Validation Stricte

Chaque STEP a ses critères de validation :
- **Tests automatisés** (unitaires + intégration)
- **Validation manuelle** (scripts, commandes)
- **Documentation** (REX, leçons apprises)

### 3. Isolation

Les STEP sont **indépendants** :
- STEP 1 : DB uniquement (pas de code métier)
- STEP 2 : JWT uniquement (pas de guards)
- STEP 3 : Core RBAC uniquement (pas de services)
- STEP 4 : Services (utilise STEP 1+2+3)

### 4. Testabilité

Chaque composant doit être **testable isolément** :
- Core RBAC : tests unitaires sans DB
- Adapters : tests avec DB
- Services : tests avec mocks

---

## 🗂️ Structure Finale

```
src/
├── platform/
│   ├── authz/                      # STEP 3 (Core RBAC)
│   │   ├── core/
│   │   │   ├── authorization.service.ts
│   │   │   ├── scope-evaluator.ts
│   │   │   └── permission-resolver.ts
│   │   ├── spi/
│   │   │   ├── rbac-query.port.ts
│   │   │   └── membership.port.ts
│   │   ├── infrastructure/
│   │   │   ├── prisma-rbac.adapter.ts
│   │   │   └── prisma-membership.adapter.ts
│   │   ├── guards/
│   │   │   ├── tenant-context.guard.ts      # STEP 2
│   │   │   └── require-permission.guard.ts  # STEP 3
│   │   └── decorators/
│   │       └── require-permission.decorator.ts
│   │
│   ├── provisioning/               # STEP 5 (Optionnel)
│   │   ├── core/
│   │   │   ├── provisioning.service.ts
│   │   │   └── propagation.service.ts
│   │   ├── templates/
│   │   │   └── default-roles.template.ts
│   │   └── commands/
│   │       └── provision-org.command.ts
│   │
│   └── module-gating/              # STEP 6 (Optionnel)
│       ├── core/
│       │   ├── module-gating.service.ts
│       │   └── plan-registry.ts
│       └── guards/
│           └── require-module.guard.ts
│
├── users/                          # STEP 4
│   ├── users.service.ts            # Refactoré (transactions)
│   └── users.controller.ts         # Refactoré (@RequirePermission)
│
├── events/                         # STEP 4
├── attendees/                      # STEP 4
└── ...

prisma/
├── schema.prisma                   # STEP 1 ✅
├── migrations/
│   └── STEP1_MULTITENANT_REFACTOR/
└── seeders/
    └── users.seeder.ts             # STEP 1 ✅ (refactoré)

test/
├── step1-multitenant.spec.ts       # STEP 1 ✅
├── step2-jwt-multi-org.spec.ts     # STEP 2 (à créer)
└── step3-core-rbac.spec.ts         # STEP 3 (à créer)
```

---

## 📚 Documentation Complète

### Par STEP
- [STEP_1_MULTITENANT.md](./STEP_1_MULTITENANT.md) ✅
- [STEP_2_JWT_MULTI_ORG.md](./STEP_2_JWT_MULTI_ORG.md)
- [STEP_3_CORE_RBAC.md](./STEP_3_CORE_RBAC.md)
- [STEP_4_REFACTOR_SERVICES.md](./STEP_4_REFACTOR_SERVICES.md)
- [STEP_5_PROVISIONING.md](./STEP_5_PROVISIONING.md)
- [STEP_6_MODULE_GATING.md](./STEP_6_MODULE_GATING.md)

### Guides
- [INDEX.md](./INDEX.md) - Navigation complète
- [STEP_1_EXECUTION_GUIDE.md](./STEP_1_EXECUTION_GUIDE.md) ✅
- [STEP_1_DIAGRAMS.md](./STEP_1_DIAGRAMS.md) ✅

---

## 🚀 Commencer Maintenant

**STEP 1 est complété ✅**, voici comment continuer :

### Prochaine Action : STEP 2 (JWT Multi-Org)

```bash
# 1. Lire la documentation
cat docs/refactor/STEP_2_JWT_MULTI_ORG.md

# 2. Créer la branche
git checkout -b feature/step2-jwt-multi-org

# 3. Commencer l'implémentation
# - Refactor JwtPayload
# - Créer TenantContextGuard
# - Endpoint /auth/switch-org
# - Tests

# 4. Valider
npm test -- step2-jwt-multi-org.spec.ts
```

**Documentation** : [STEP_2_JWT_MULTI_ORG.md](./STEP_2_JWT_MULTI_ORG.md)

---

## 🎉 Conclusion

Ce plan garantit :
- ✅ **Pas de retour en arrière** (séquentiel validé)
- ✅ **Testabilité** (chaque composant isolé)
- ✅ **Maintenabilité** (architecture hexagonale)
- ✅ **Scalabilité** (multi-tenant + RBAC + module gating)

**Let's go! 🚀**

---

**Dernière mise à jour** : 4 Janvier 2026  
**Version** : 2.0  
**Auteur** : GitHub Copilot  
**Status** : ✅ Plan validé, STEP 1 complété
