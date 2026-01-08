# 📋 Plan Complet : Roadmap RBAC Multi-tenant

> **Document maître** consolidant tous les STEPS du refactor  
> **Durée totale estimée** : 16 jours (3 semaines)  
> **Date de création** : 8 Janvier 2026  
> **Dernière mise à jour** : 8 Janvier 2026

---

## 🎯 Vue d'Ensemble

### Objectif Global

Transformer l'application d'un modèle **single-tenant simple** vers un système **multi-tenant avec RBAC granulaire**, hiérarchie de rôles, gestion de permissions par scope, et module gating (plans).

### État Actuel

| Composant | État | Statut |
|-----------|------|--------|
| **STEP 1** : Multi-tenant DB | ✅ Complété | Migrations + Seeds + Tests OK |
| **STEP 2** : JWT Multi-org | ❌ À faire | JWT minimal + switch org |
| **STEP 3** : Core RBAC Hexagonal | ❌ À faire | Moteur d'autorisation pur |
| **STEP 4** : Refactor Services | ❌ À faire | Adapter code applicatif |
| **STEP 5** : Provisioning | ❌ À faire | Automatisation (optionnel) |
| **STEP 6** : Module Gating | ❌ À faire | Plans & Features (optionnel) |
| **Frontend Ability** | ❌ À faire | Infrastructure permissions |
| **Frontend RBAC UI** | ❌ À faire | Pages gestion rôles |

---

## 📊 Roadmap Complète (16 jours)

### 🗓️ Semaine 1 : Backend Foundation (Jours 1-5)

#### Jour 1-2 : STEP 2 (JWT Multi-org)

**Objectif** : Permettre aux users de switcher entre leurs organisations avec JWT minimal

**Tâches Jour 1 (Interfaces & JWT Minimal)** :
- [ ] Créer `jwt-payload.interface.ts` (JWT minimal : sub, mode, currentOrgId)
- [ ] Créer `user-ability.interface.ts` (réponse /me/ability)
- [ ] Créer `switch-org.dto.ts`
- [ ] Modifier `AuthService.generateJwtForOrg()` (JWT minimal)
- [ ] Modifier `AuthService.login()` (logique tenant/platform)
- [ ] Tests unitaires JWT

**Tâches Jour 2 (Endpoints Ability)** :
- [ ] Créer `AuthService.getUserAbility()` ⚠️ **CLÉ**
- [ ] Créer `AuthService.getAvailableOrgs()`
- [ ] Créer `AuthService.switchOrg()`
- [ ] Endpoint `GET /auth/me/ability` ⚠️ **CRITIQUE**
- [ ] Endpoint `GET /auth/me/orgs`
- [ ] Endpoint `POST /auth/switch-org`
- [ ] Guard `TenantContextGuard`
- [ ] Tests E2E endpoints

**Livrables** :
- ✅ JWT contient `currentOrgId` et `mode`
- ✅ Endpoint `/me/ability` retourne permissions dynamiques
- ✅ Switch org fonctionnel

**Références** :
- [STEP_2_JWT_MULTI_ORG.md](./STEP_2_JWT_MULTI_ORG.md)

---

#### Jour 3-5 : STEP 3 (Core RBAC Hexagonal)

**Objectif** : Construire le moteur d'autorisation RBAC pur avec cache Redis

**Tâches Jour 3 (Core + Ports)** :
- [ ] Créer `core/types.ts` (AuthContext, RbacContext, Grant, ScopeLimit)
- [ ] Créer `core/decision.ts` (Decision, DecisionCode, DecisionHelper)
- [ ] Créer `core/authorization.service.ts` (moteur RBAC)
- [ ] Créer `core/scope-evaluator.ts` (logique scopes)
- [ ] Créer `core/permission-resolver.ts`
- [ ] Créer `ports/rbac-query.port.ts`
- [ ] Créer `ports/membership.port.ts`
- [ ] Créer `ports/auth-context.port.ts` ⚠️ **NOUVEAU**
- [ ] Tests unitaires Core

**Tâches Jour 4 (Adapters DB + Cache Redis)** :
- [ ] Créer `PrismaRbacQueryAdapter`
- [ ] Créer `PrismaMembershipAdapter`
- [ ] Créer `PrismaModuleGatingAdapter`
- [ ] Créer `PrismaAuthContextAdapter`
- [ ] **Installer Redis** (`cache-manager`, `redis`) ⚠️
- [ ] Créer `CachedAuthContextAdapter` ⚠️ **IMPORTANT**
- [ ] Configurer `AuthzModule` avec Redis
- [ ] Variables d'environnement (`.env` : REDIS_HOST, REDIS_PORT)
- [ ] Tests adapters

**Tâches Jour 5 (Guards + Permission Registry)** :
- [ ] Créer `RequirePermissionGuard`
- [ ] Créer `@RequirePermission` decorator
- [ ] Créer `permission-registry.ts` (toutes les permissions)
- [ ] Créer `RbacAdminController` (minimal)
- [ ] Endpoint `GET /rbac/roles`
- [ ] Endpoint `POST /rbac/assign-role`
- [ ] Endpoint `GET /rbac/cache/metrics` (monitoring)
- [ ] Endpoint `POST /rbac/cache/invalidate/:userId`
- [ ] Tests E2E guards

**Livrables** :
- ✅ Moteur RBAC opérationnel
- ✅ Cache Redis avec 95%+ hit rate
- ✅ Guards `@RequirePermission` fonctionnels
- ✅ Hiérarchie de rôles (canManageUser, canAssignRole)

**Références** :
- [STEP_3_CORE_RBAC.md](./STEP_3_CORE_RBAC.md)

---

### 🗓️ Semaine 2 : Backend Services + Frontend Ability (Jours 6-13)

#### Jour 6-10 : STEP 4 (Refactor Services)

**Objectif** : Adapter tous les services pour utiliser le nouveau modèle multi-tenant

**Tâches Jour 6 (AuthService + UsersService)** :
- [ ] Adapter `AuthService.validateUserById()` (charger relations multi-tenant)
- [ ] Adapter `UsersService.create()` (transaction 3 étapes)
- [ ] Adapter `UsersService.findAll()` (jointure org_users)
- [ ] Adapter `UsersService.findOne()` (include relations)
- [ ] Adapter `UsersService.update()` (mise à jour TenantUserRole)
- [ ] Créer `UsersService.assignRoleToUser()` (avec hiérarchie) ⚠️
- [ ] Tests unitaires

**Tâches Jour 7 (EventsService)** :
- [ ] Adapter `EventsService.create()`
- [ ] Adapter `EventsService.findAll()`
- [ ] Adapter `EventsService.update()`
- [ ] Adapter `EventsService.delete()`
- [ ] Adapter `EventsController` (`@RequirePermission`)
- [ ] Tests E2E events

**Tâches Jour 8 (RegistrationsService)** :
- [ ] Adapter `RegistrationsService.create()`
- [ ] Adapter `RegistrationsService.findAll()`
- [ ] Adapter `RegistrationsService.update()`
- [ ] Adapter `RegistrationsController`
- [ ] Tests E2E registrations

**Tâches Jour 9 (BadgesService + OrgsService)** :
- [ ] Adapter `BadgesService.create()`
- [ ] Adapter `BadgesService.findAll()`
- [ ] Adapter `BadgesController`
- [ ] Adapter `OrganizationsService` (minimal)
- [ ] Tests E2E

**Tâches Jour 10 (Cleanup + Validation)** :
- [ ] Supprimer anciens guards (`RoleGuard`, etc.)
- [ ] Supprimer anciens decorators
- [ ] Valider compilation (`npm run build`)
- [ ] Valider tests (`npm test`)
- [ ] Valider E2E (`npm run test:e2e`)
- [ ] Documentation Swagger
- [ ] Update Postman collections

**Livrables** :
- ✅ Tous les services utilisent le nouveau modèle
- ✅ Tests passent (unitaires + E2E)
- ✅ Aucune régression

**Références** :
- [STEP_4_REFACTOR_SERVICES.md](./STEP_4_REFACTOR_SERVICES.md)

---

#### Jour 11-13 : Frontend Ability (Infrastructure Permissions)

**Objectif** : Charger et vérifier les permissions côté front

**Tâches Jour 11 (Infrastructure)** :
- [ ] Créer `AbilityContext` ou `abilitySlice` (Redux/Context API)
- [ ] Créer hook `usePermissions()` (can, hasModule, canWithScope)
- [ ] Appeler `/me/ability` après login/switch
- [ ] Stocker grants + modules dans state global
- [ ] Tests hooks

**Tâches Jour 12 (Composants Réutilisables)** :
- [ ] Créer composant `<Can permission="...">` 
- [ ] Créer composant `<RequireModule module="...">`
- [ ] Tester dans quelques pages
- [ ] Tests components

**Tâches Jour 13 (Intégration Globale)** :
- [ ] Adapter Sidebar (masquer menus selon modules/permissions)
- [ ] Adapter EventsList (boutons conditionnels)
- [ ] Adapter BadgesPage (upgrade prompt si module désactivé)
- [ ] Adapter toutes les pages principales
- [ ] Tests E2E frontend

**Livrables** :
- ✅ Hook `usePermissions()` opérationnel
- ✅ Composants `<Can>` et `<RequireModule>` fonctionnels
- ✅ UI affiche/cache selon permissions

---

### 🗓️ Semaine 3 : Frontend RBAC UI + Polissage (Jours 14-16)

#### Jour 14-15 : Frontend RBAC UI (Pages Admin)

**Objectif** : Interface de gestion des rôles pour les admins

**Tâches Jour 14 (Pages Rôles)** :
- [ ] Page `/rbac/roles` (liste des rôles avec level)
- [ ] Page `/rbac/roles/create` (formulaire création)
- [ ] Page `/rbac/roles/:id/edit` (formulaire édition)
- [ ] Service `rbacApi.ts` (CRUD rôles)
- [ ] Tests pages

**Tâches Jour 15 (Pages Assignation)** :
- [ ] Page `/rbac/users` (liste users avec rôles actuels)
- [ ] Modal/Page assignation de rôle
- [ ] Vérification hiérarchie côté front (désactiver rôles non assignables)
- [ ] Gestion erreurs `HIERARCHY_VIOLATION`
- [ ] Tests E2E RBAC UI

**Livrables** :
- ✅ Admin peut créer/modifier des rôles
- ✅ Admin peut assigner des rôles (avec respect hiérarchie)
- ✅ Messages d'erreur clairs

---

#### Jour 16 : Polissage Final

**Tâches** :
- [ ] Fix bugs trouvés
- [ ] Améliorer messages d'erreur (backend + front)
- [ ] Ajouter tooltips (hiérarchie, modules désactivés)
- [ ] Améliorer UX (loaders, confirmations)
- [ ] Tests de bout en bout (scénarios complets)
- [ ] Documentation utilisateur
- [ ] Démo interne

**Livrables** :
- ✅ Application stable et testée
- ✅ Documentation complète
- ✅ Prêt pour déploiement

---

## 🎯 Livrables Finaux (Fin Semaine 3)

### Backend

| Feature | Description | Statut |
|---------|-------------|--------|
| **Multi-tenant DB** | User peut appartenir à N orgs | ✅ Fait (STEP 1) |
| **JWT Multi-org** | Switch entre orgs avec JWT minimal | ✅ À livrer |
| **Core RBAC** | Moteur d'autorisation hexagonal | ✅ À livrer |
| **Cache Redis** | Cache AuthContext (99% hit rate) | ✅ À livrer |
| **Services Adaptés** | Events, Badges, Users, etc. | ✅ À livrer |
| **Hiérarchie** | Admin > Manager > Staff > Viewer | ✅ À livrer |
| **Scopes** | any, own, assigned | ✅ À livrer |
| **Module Gating** | Plans (Free/Pro/Enterprise) | 🟡 Optionnel |
| **Provisioning** | Auto-création rôles | 🟡 Optionnel |

### Frontend

| Feature | Description | Statut |
|---------|-------------|--------|
| **Ability Hook** | `usePermissions()` | ✅ À livrer |
| **Composants** | `<Can>`, `<RequireModule>` | ✅ À livrer |
| **Sidebar Adapté** | Menus selon permissions | ✅ À livrer |
| **Pages RBAC** | Gestion rôles/assignation | ✅ À livrer |
| **Org Switcher** | Dropdown switch org | 🟡 Optionnel |
| **Upgrade Prompts** | Modal "Upgrade to Pro" | 🟡 Optionnel |

---

## 📋 Checklist de Validation Globale

### Backend

- [ ] **Compilation** : `npm run build` ✅
- [ ] **Tests unitaires** : `npm test` ✅
- [ ] **Tests E2E** : `npm run test:e2e` ✅
- [ ] **Redis fonctionne** : cache hit rate > 95% ✅
- [ ] **Permissions fonctionnent** : `@RequirePermission` bloque ✅
- [ ] **Scopes fonctionnent** : any/own/assigned testés ✅
- [ ] **Hiérarchie fonctionne** : manager ne peut pas modifier admin ✅
- [ ] **Switch org fonctionne** : nouveau JWT généré ✅
- [ ] **Aucune régression** : features existantes OK ✅

### Frontend

- [ ] **Login fonctionne** : JWT reçu + ability chargée ✅
- [ ] **Switch org fonctionne** : UI mise à jour ✅
- [ ] **Menus affichés** : selon permissions ✅
- [ ] **Boutons désactivés** : selon permissions ✅
- [ ] **Upgrade prompts** : affichés si module désactivé ✅
- [ ] **Page RBAC fonctionne** : CRUD rôles OK ✅
- [ ] **Assignation fonctionne** : hiérarchie respectée ✅
- [ ] **Messages d'erreur** : clairs et utiles ✅
- [ ] **UX fluide** : loaders, confirmations ✅

---

## 🚀 Commandes Utiles

### Backend

```bash
# Compilation
npm run build

# Tests unitaires
npm test

# Tests E2E
npm run test:e2e

# Seed DB (STEP 1 déjà fait)
npm run seed:step1

# Prisma Studio (visualiser DB)
npx prisma studio

# Redis (Docker)
docker run -d -p 6379:6379 redis:7

# Vérifier connexion Redis
redis-cli ping  # Devrait retourner "PONG"
```

### Frontend

```bash
# Dev
npm run dev

# Build
npm run build

# Tests
npm test

# Tests E2E
npm run test:e2e
```

---

## 📊 Estimation Réaliste des Temps

### Par Développeur Solo

| STEP | Estimation Initiale | Estimation Réaliste | Facteur Risque |
|------|---------------------|---------------------|----------------|
| STEP 1 | ✅ Fait | ✅ Fait | - |
| STEP 2 | 2 jours | **2-3 jours** | Tests E2E longs |
| STEP 3 | 3 jours | **3-4 jours** | Setup Redis + tests cache |
| STEP 4 | 5 jours | **7-10 jours** | Beaucoup de services à adapter |
| Frontend Ability | 3 jours | **3-4 jours** | Intégration Redux/Context |
| Frontend RBAC UI | 2 jours | **2-3 jours** | UX hiérarchie complexe |
| Polissage | 1 jour | **2-3 jours** | Bugs imprévus |

**Total Solo** : 19-27 jours réels (~4-5 semaines)

### Par Équipe de 2 Devs

| Dev | Tâches Parallélisables | Durée |
|-----|------------------------|-------|
| **Dev 1** | Backend (STEP 2-4) | 12-17 jours |
| **Dev 2** | Frontend (Ability + RBAC UI) | 5-7 jours |

**Total Équipe** : 12-17 jours (~3 semaines)

---

## ⚠️ Points Critiques à Ne Pas Oublier

### 1. Redis (Jour 4) ⚠️ **CRITIQUE**

```bash
# Installation
npm install cache-manager cache-manager-redis-yet redis

# Docker
docker run -d -p 6379:6379 --name redis-rbac redis:7

# .env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

**Sans Redis** : Le système fonctionne mais perf dégradées (~1000 queries/s DB au lieu de ~10)

### 2. Permission Registry (Jour 5) ⚠️ **CRITIQUE**

Créer le registry centralisé de TOUTES les permissions :

```typescript
// permission-registry.ts
export const PERMISSIONS = {
  // Events
  EVENT_CREATE: 'event.create',
  EVENT_READ: 'event.read',
  EVENT_UPDATE: 'event.update',
  EVENT_DELETE: 'event.delete',
  
  // Attendees
  ATTENDEE_CREATE: 'attendee.create',
  // ...
  
  // RBAC
  RBAC_ROLE_READ: 'rbac.role.read',
  RBAC_ROLE_ASSIGN: 'rbac.role.assign',
  // ...
};
```

**Seed en DB** :
```typescript
await prisma.permission.createMany({
  data: Object.values(PERMISSIONS).map(key => ({
    key,
    name: key.replace('.', ' ').toUpperCase(),
  })),
  skipDuplicates: true,
});
```

### 3. Tests E2E (Jour 10, 13, 15) ⚠️ **CRITIQUE**

Vérifier TOUS les scénarios :

```typescript
// Backend
✅ Login tenant/platform
✅ Switch org
✅ Permissions (allow/deny)
✅ Scopes (any/own/assigned)
✅ Hiérarchie (admin > manager)

// Frontend
✅ Affichage conditionnel (menus, boutons)
✅ Upgrade prompts (module désactivé)
✅ Assignation rôles (hiérarchie respectée)
```

---

## 🎯 Stratégie de Négociation (+1 Semaine)

### Arguments pour le Management

1. **Qualité vs Rapidité** :
   - MVP en 3 jours = dette technique massive
   - Plan complet = architecture solide, scalable

2. **ROI Long Terme** :
   - Économie de temps sur les futures features (provisioning, module gating)
   - Moins de bugs en production

3. **Livraison Progressive** :
   - Fin Semaine 1 : Backend RBAC opérationnel (démo possible)
   - Fin Semaine 2 : Frontend intégré (démo complète)
   - Fin Semaine 3 : Production-ready

4. **Plan B** (si refus) :
   - Livrer MVP Semaine 1 (Backend STEP 2-3 + Frontend minimal)
   - Finaliser STEP 4-6 en Semaine 2-3 (après validation client)

---

## 📚 Documents de Référence

| Document | Description | Lien |
|----------|-------------|------|
| **STEP 1** | Multi-tenant DB (✅ fait) | [STEP_1_MULTITENANT.md](./STEP_1_MULTITENANT.md) |
| **STEP 2** | JWT Multi-org | [STEP_2_JWT_MULTI_ORG.md](./STEP_2_JWT_MULTI_ORG.md) |
| **STEP 3** | Core RBAC Hexagonal | [STEP_3_CORE_RBAC.md](./STEP_3_CORE_RBAC.md) |
| **STEP 4** | Refactor Services | [STEP_4_REFACTOR_SERVICES.md](./STEP_4_REFACTOR_SERVICES.md) |
| **STEP 5** | Provisioning (optionnel) | [STEP_5_PROVISIONING.md](./STEP_5_PROVISIONING.md) |
| **STEP 6** | Module Gating (optionnel) | [STEP_6_MODULE_GATING.md](./STEP_6_MODULE_GATING.md) |

---

## 🎯 Prochaines Actions Immédiates

1. **Valider le plan** avec l'équipe/management
2. **Négocier +1 semaine** (arguments ci-dessus)
3. **Setup Redis local** (docker)
4. **Créer branche Git** : `feature/rbac-multitenant`
5. **Démarrer STEP 2** (Jour 1)

---

## 📞 Support & Questions

Si blocage sur un point, référez-vous aux documents STEP correspondants ou contactez l'architecte projet.

**Points de validation** :
- Fin STEP 2 : Démo JWT + switch org
- Fin STEP 3 : Démo RBAC + hiérarchie
- Fin STEP 4 : Validation tests E2E
- Fin Frontend : Démo UI complète

---

**Dernière mise à jour** : 8 Janvier 2026  
**Auteur** : GitHub Copilot  
**Version** : 1.0  
**Statut** : 📋 Plan validé, prêt pour exécution
