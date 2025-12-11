# Plan : Implémentation RBAC Multi-Tenant Complète

Vous disposez déjà d'une **base RBAC exceptionnelle** (schéma complet, 315+ permissions, guards). L'objectif est d'**activer les fonctionnalités avancées** (multi-tenant, gating modules, propagation auto) et de **centraliser l'autorisation**.

## Phase 0 – Figer l'architecture (1 doc, 1 schéma)

**Objectif :** Tout ce qu'on a dit tient dans un endroit clair, pour ne pas se perdre après.

### Tâches

1. **Créer/Consolider `docs/ARCHITECTURE_RBAC.md`** avec :
   - Le Brainstorming complet (vision architecturale)
   - La liste des tables "RBAC & plans" : `users`, `org_users`, `user_roles`, `roles`, `permissions`, `role_permissions`, `plans`, `modules`, `plan_modules`, `org_module_overrides`, `platform_user_org_access`
   - Les invariants importants :
     - Un user tenant ne sort jamais de son org
     - Seul `is_root` peut créer/assigner un rôle root
     - Les rôles clés sont `is_locked = true`
     - Les rôles custom ont `managed_by_template = false`
   - Les types de rôles : `tenant_admin`, `tenant_manager`, `tenant_staff`, `support_L1`, `support_L2`, `custom`
   - La hiérarchie des rangs (SUPER_ADMIN=0, ADMIN=1, MANAGER=2, etc.)

2. **Mettre à jour le DBML** (ou documenter) avec ces tables/colonnes :
   - Toutes les tables RBAC existent déjà dans `prisma/schema.prisma`
   - Documenter les relations composites et les FK importantes
   - Ajouter des diagrammes si nécessaire (Mermaid, DBML)

### Done quand

- ✅ Doc d'archi écrit et complet dans `docs/ARCHITECTURE_RBAC.md`
- ✅ DBML/Schéma reflète bien la structure cible (déjà le cas avec `schema.prisma`)

---

## Phase 1 – Modèle de données RBAC (sans changer la logique métier)

**Objectif :** Mettre les tables et colonnes en place, remplir les champs manquants, sans encore réécrire tout le système d'auth.

### Tâches

1. **Vérifier/Ajuster les tables suivantes** (déjà existantes) :
   - ✅ `OrgUser` - Appartenance multi-org
   - ✅ `UserRole` - Rôles assignés par org
   - ✅ `PlatformUserOrgAccess` - Accès plateforme aux orgs
   - ✅ `Plan`, `Module`, `PlanModule`, `OrgModuleOverride` - Gating modules

2. **Remplir les colonnes manquantes dans les seeders** :
   - Dans `Role` : 
     - `rank` (0 pour SUPER_ADMIN, 1 pour ADMIN, etc.)
     - `is_platform` (true pour rôles support)
     - `is_root` (true uniquement pour SUPER_ADMIN)
     - `role_type` (tenant_admin, tenant_manager, tenant_staff, support_L1, support_L2, custom)
     - `is_locked` (true pour rôles clés Admin/Manager/Staff)
     - `permission_ceiling_scope` (any, org, team, own)
     - `managed_by_template` (true pour rôles gérés automatiquement)
   - Dans `Permission` :
     - `module_key` (déjà présent mais vérifier cohérence)
     - `allowed_scopes` (array des scopes autorisés)
     - `default_scope_ceiling` (plafond par défaut)
   - Dans `RolePermission` :
     - `scope` (scope effectif pour cette assignation)

3. **Vérifier les FK et indexes** :
   - FK composites sur `UserRole` (user_id, org_id) → `OrgUser` (user_id, org_id)
   - FK composites sur `UserRole` (role_id, org_id) → `Role` (id, org_id)
   - Indexes sur (plan_id, module_key), (org_id, module_key), etc.

### Done quand

- ✅ Toutes les migrations passent
- ✅ Les seeders remplissent tous les champs RBAC avancés
- ✅ L'app continue de tourner avec l'ancien système d'auth (pas encore touché)

---

## Phase 2 – Nouveau cœur d'auth backend (sans l'utiliser partout)

**Objectif :** Avoir un module TypeScript qui sait répondre à "est-ce que ce user peut faire X sur Y ?".

### Tâches

1. **Créer `src/rbac/permission-registry.ts`** avec :
   ```typescript
   export const PERMISSION_REGISTRY = {
     'event.read': {
       module: 'events',
       allowedScopes: ['own', 'assigned', 'org', 'any'],
       defaultScopeCeiling: 'org',
       defaultScopesByRoleType: {
         tenant_admin: 'any',
         tenant_manager: 'org',
         tenant_staff: 'team',
         support_L1: 'assigned',
         custom: 'own',
       }
     },
     // ... 315+ permissions
   };
   ```

2. **Créer `src/rbac/authorization.service.ts`** avec :
   - Types : `Scope = 'own' | 'team' | 'org' | 'any'`
   - `SCOPE_ORDER = ['own', 'team', 'org', 'any']`
   - `scopeCovers(scopeLimit: Scope, ctx: ScopeContext): boolean` - Logique de vérification scope
   - `getBestScopeForPermission(user, permissionKey, orgId): Scope | null` - Lit user_roles → roles → role_permissions
   - `isModuleEnabledForTenant(tenantId, moduleKey): boolean` - Lit plans, plan_modules, org_module_overrides
   - `can(user, permissionKey, ctx): boolean` :
     1. Gère `is_root` (accès total)
     2. Gère tenant vs plateforme (org limit, platform_user_org_access)
     3. Vérifie le module (isModuleEnabledForTenant)
     4. Vérifie la permission + scope (getBestScopeForPermission + scopeCovers)
   - `requirePermission()` - Middleware HTTP qui wrap can()

3. **Créer des types partagés** (`src/rbac/rbac.types.ts`) :
   ```typescript
   export interface ScopeContext {
     resourceTenantId?: string;
     actorTenantId: string;
     resourceOwnerId?: string;
     actorUserId: string;
     resourceTeamId?: string;
     actorTeamIds?: string[];
   }
   ```

### Done quand

- ✅ On peut écrire un test ou script qui appelle `can()` sur quelques cas simples
- ✅ Les résultats sont corrects (user admin vs manager vs staff)
- ✅ On n'a pas encore branché ça sur les routes (l'ancien système fonctionne toujours)

---

## Phase 3 – Intégrer le nouveau moteur sur UN module (pilote)

**Objectif :** Prouver que le moteur d'autorisations fonctionne dans du vrai code, mais seulement sur un périmètre limité (ex : Events).

### Tâches

1. **Choisir le module pilote : Events**
   - Permissions : `event.read`, `event.create`, `event.update`, `event.delete`

2. **Migrer `src/modules/events/events.controller.ts`** :
   - Remplacer tous les checks manuels :
     - ❌ `if (user.role === 'SUPER_ADMIN')`
     - ❌ `const allowAny = req.user.permissions?.some(...)`
   - Par :
     - ✅ `@RequirePermission('event.read')`
     - ✅ Appels à `authorizationService.can()`

3. **Adapter le code pour fournir `ScopeContext` correct** :
   - `resourceTenantId = event.org_id`
   - `actorTenantId = req.user.currentOrgId`
   - `resourceOwnerId = event.created_by`
   - `actorUserId = req.user.id`

4. **Tester avec différents rôles** :
   - Admin tenant (scope any)
   - Manager tenant (scope org)
   - Staff tenant (scope team)
   - User support plateforme (scope assigned)
   - User custom (scope own)

### Done quand

- ✅ Le module Events n'utilise plus `if (user.is_admin)` ou `role === 'admin'`
- ✅ Utilise uniquement `requirePermission()` ou `authorizationService.can()`
- ✅ On peut passer d'un user à l'autre et voir la différence dans les autorisations

---

## Phase 4 – Rôles clés + PermissionRegistry + seeder

**Objectif :** Poser le socle standard Admin / Manager / Staff par org et préparer la propagation future.

### Tâches

1. **Finaliser le `PermissionRegistry`** :
   - Définir toutes les 315+ permissions en TypeScript
   - Grouper par module (events, attendees, badges, users, organizations, etc.)
   - Définir `defaultScopesByRoleType` pour chaque permission

2. **Créer `scripts/sync-permissions.ts`** qui :
   - Lit `PERMISSION_REGISTRY`
   - Upsert les permissions dans la table `Permission`
   - Pour chaque org :
     - Crée les rôles clés si absents (Admin, Manager, Staff)
     - `role_type = tenant_admin/tenant_manager/tenant_staff`
     - `rank = 1/2/3`
     - `is_locked = true`
     - `managed_by_template = true`
     - Assigne les `role_permissions` selon `defaultScopesByRoleType`

3. **Créer un seeder pour nouvelle org** :
   - Hook après création d'une org (dans `organizations.service.ts`)
   - Appelle `syncPermissionsForOrg(orgId)`
   - Crée immédiatement Admin/Manager/Staff avec permissions correctes

4. **Mettre à jour `prisma/seeders/roles.seeder.ts`** :
   - Marquer `is_locked: true` pour Admin, Manager, Staff
   - Marquer `managed_by_template: true`
   - Remplir `role_type`, `rank`, `permission_ceiling_scope`

### Done quand

- ✅ Une nouvelle org reçoit automatiquement Admin/Manager/Staff avec permissions correctes
- ✅ On peut lancer `npm run permissions:sync` sans casser les orgs existantes
- ✅ Les rôles clés sont bien marqués `is_locked = true`

---

## Phase 5 – Multi-org réel + users plateforme

**Objectif :** Passer du "user dans une seule org" à "user global appartenant à plusieurs orgs + support plateforme".

### Tâches

1. **Migrer le modèle `User`** (BREAKING CHANGE) :
   - ❌ Supprimer `org_id` et `role_id` directs du modèle `User`
   - ✅ Utiliser les relations `orgUsers[]` et `userRoles[]`
   - Créer une migration Prisma pour cette modification

2. **Adapter `AuthService`** :
   - Au login : lister les orgs du user via `OrgUser`
   - Stocker l'org active dans le JWT (`currentOrgId`)
   - Créer endpoint `POST /auth/switch-org` pour changer d'org active
   - Régénérer le token avec les permissions de la nouvelle org

3. **Adapter `can()` pour utiliser** :
   - `OrgUser` pour les users tenant (vérifier appartenance à l'org)
   - `PlatformUserOrgAccess` pour les users plateforme (vérifier accès spécifique)
   - Gérer `is_platform` flag

4. **Créer UI backend (ou API) pour** :
   - `GET /api/me/orgs` - Voir les orgs d'un user
   - `POST /admin/users/:id/orgs/:orgId` - Donner accès à une org (pour user plateforme)
   - `DELETE /admin/users/:id/orgs/:orgId` - Retirer accès

5. **Mettre à jour tous les services** :
   - Remplacer `user.org_id` par `user.currentOrgId` (du JWT)
   - Remplacer `user.role_id` par lookup via `UserRole`
   - Adapter `UsersService`, `EventsService`, etc.

### Done quand

- ✅ Un même compte peut être dans 2 orgs avec des rôles différents
- ✅ Un user plateforme peut avoir accès à plusieurs orgs (ou pas)
- ✅ `can()` fait bien la différence tenant vs platform vs root
- ✅ L'app fonctionne entièrement avec le nouveau modèle multi-org

---

## Phase 6 – Gating par plan / modules

**Objectif :** Empêcher une org d'utiliser un module qui n'est pas dans son plan, même si elle a un rôle configuré bizarre.

### Tâches

1. **Mettre à jour `Permission` pour avoir `module_key` partout** :
   - Vérifier que toutes les 315+ permissions ont un `module_key`
   - Groupes logiques : `events`, `attendees`, `badges`, `users`, `organizations`, `roles`, `permissions`, `reports`, etc.

2. **Implémenter `ModulesService.isModuleEnabledForTenant(tenantId, moduleKey)`** :
   - Lire le plan de l'org (`Organization.plan_id`)
   - Lire `PlanModule` pour ce plan
   - Prendre en compte `OrgModuleOverride` (priorité sur le plan)
   - Retourner `boolean`

3. **Brancher dans `authorizationService.can()`** :
   - Extraire `moduleKey` de la permission
   - Appeler `isModuleEnabledForTenant()`
   - Refuser si module désactivé (même avec permission)

4. **Ajouter API back-office** (admin seulement) :
   - `GET /admin/plans` - Liste des plans
   - `POST /admin/plans` - Créer un plan
   - `GET /admin/plans/:id/modules` - Modules d'un plan
   - `POST /admin/plans/:id/modules/:key` - Activer un module dans un plan
   - `DELETE /admin/plans/:id/modules/:key` - Désactiver un module
   - `PUT /admin/orgs/:id/modules/:key` - Override module pour une org spécifique

5. **Seeder les plans de base** :
   - Plan "Free" : modules de base (events, attendees)
   - Plan "Pro" : + badges, reports
   - Plan "Enterprise" : tous les modules

### Done quand

- ✅ On peut désactiver un module pour une org
- ✅ Même si un rôle a la permission, `can()` refuse si module désactivé
- ✅ On peut activer un module pour un client spécifique via `OrgModuleOverride`
- ✅ API back-office permet de gérer plans/modules

---

## Phase 7 – Refactor UI / Front

**Objectif :** Que le front respecte les mêmes règles que le backend et n'affiche pas des actions impossibles.

### Tâches

1. **Créer `src/services/ability.service.ts` côté front** :
   - `can(permissionKey: string, ctx?: ScopeContext): boolean`
   - `canUse(moduleKey: string): boolean`
   - `canSee(componentKey: string): boolean`

2. **Ajouter endpoint backend** :
   - `GET /api/me/permissions` - Retourner les permissions effectives du user courant
   - `GET /api/me/modules` - Retourner les modules activés pour son org
   - Format :
     ```json
     {
       "permissions": [
         { "key": "event.read", "scope": "org" },
         { "key": "event.create", "scope": "org" }
       ],
       "modules": ["events", "attendees", "badges"]
     }
     ```

3. **Remplacer progressivement les checks dans l'UI** :
   - ❌ `if (user.role === 'admin')` 
   - ✅ `if (can('event.create'))`
   - Cacher les boutons / menus non autorisés
   - Désactiver les actions impossibles

4. **Gérer les 403 côté UI** :
   - Interceptor HTTP pour détecter 403
   - Afficher message clair : "Vous n'avez pas la permission [permission.key]"
   - Optionnel : Redirection vers page d'erreur ou refresh permissions

5. **Migrer le module Events en pilote côté front** :
   - Liste events : vérifier `can('event.read')`
   - Bouton créer : vérifier `can('event.create')`
   - Bouton modifier : vérifier `can('event.update')`
   - Bouton supprimer : vérifier `can('event.delete')`

### Done quand

- ✅ Sur le module Events (pilote), l'UI ne montre plus des actions que le backend refuserait
- ✅ On n'écrit plus `isAdmin` en dur dans le front
- ✅ Les 403 sont bien gérés avec messages clairs

---

## Considérations Importantes

### 1. Migration User model = Breaking Change

**Impact :** Tous les services qui utilisent `user.org_id` / `user.role_id`

**Mitigation :**
- Option A : Migration progressive avec période de compatibilité (getter/setter temporaires)
- Option B : Migration atomique avec tests complets avant déploiement
- Estimer 3-5 jours de refactoring

### 2. Performance et cache des permissions

**Problème :** Avec multi-tenant, queries complexes `User → OrgUser → UserRole → RolePermission`

**Solution :**
- Indexes composites sur `(user_id, org_id)`, `(role_id, org_id)`, etc.
- Cache Redis pour `getEffectivePermissions(userId, orgId)`
- TTL : 5-15 minutes
- Invalidation : sur changement de rôle/permission

### 3. Taille du JWT

**Problème :** Actuellement, toutes les permissions sont dans le JWT. Avec plusieurs orgs, risque de dépasser 4KB.

**Solution :**
- Stocker uniquement les permissions de l'org active
- JWT minimal : `{ userId, currentOrgId, isRoot, isPlatform }`
- Alternative : JWT minimal + endpoint `/api/me/permissions` côté front

### 4. Tests à mettre à jour

**Impact :** Tous les tests qui mockent `user.org_id` / `user.role_id`

**Actions :**
- Créer des helpers de test : `createUserInOrg(orgId, roleType)`
- Mettre à jour les fixtures
- Tests e2e : vérifier multi-org, switch org, permissions effectives

### 5. Documentation continue

**À maintenir :**
- `docs/ARCHITECTURE_RBAC.md` - À jour avec implémentation
- `docs/RBAC_GUIDE.md` - Guide utilisateur/développeur
- `README.md` - Section RBAC avec exemples
- Migration guides pour les développeurs

---

## Estimation Globale

| Phase | Durée estimée | Complexité | Risque |
|-------|---------------|------------|--------|
| Phase 0 - Architecture | 2-3 jours | Faible | Faible |
| Phase 1 - Modèle BDD | 3-5 jours | Moyenne | Moyen |
| Phase 2 - Moteur auth | 5-7 jours | Élevée | Moyen |
| Phase 3 - Module pilote | 3-4 jours | Moyenne | Faible |
| Phase 4 - Rôles clés | 4-5 jours | Moyenne | Moyen |
| Phase 5 - Multi-org | 10-15 jours | Très élevée | Élevé |
| Phase 6 - Gating modules | 4-6 jours | Moyenne | Faible |
| Phase 7 - Refactor UI | 10-12 jours | Élevée | Moyen |

**Total : 8-10 semaines** (en full-time, 1 développeur)

---

## Checklist de Validation par Phase

### Phase 0 ✅
- [ ] `docs/ARCHITECTURE_RBAC.md` créé et complet
- [ ] DBML/Schéma documenté
- [ ] Invariants listés clairement

### Phase 1 ✅
- [ ] Toutes les migrations passent
- [ ] Seeders remplissent tous les champs RBAC
- [ ] App tourne avec ancien système

### Phase 2 ✅
- [ ] `permission-registry.ts` créé
- [ ] `authorization.service.ts` implémenté
- [ ] Tests unitaires `can()` passent

### Phase 3 ✅
- [ ] Module Events migré
- [ ] Aucun check manuel restant
- [ ] Tests avec différents rôles OK

### Phase 4 ✅
- [ ] `sync-permissions.ts` fonctionnel
- [ ] Nouvelle org reçoit rôles clés auto
- [ ] Rôles clés marqués `is_locked`

### Phase 5 ✅
- [ ] User peut être dans plusieurs orgs
- [ ] Switch org fonctionne
- [ ] Users plateforme gérés
- [ ] Tous les services migrés

### Phase 6 ✅
- [ ] `isModuleEnabledForTenant()` implémenté
- [ ] Gating intégré dans `can()`
- [ ] API back-office plans/modules OK
- [ ] Plans de base seedés

### Phase 7 ✅
- [ ] Service ability front créé
- [ ] Endpoint `/api/me/permissions` OK
- [ ] Module Events migré côté UI
- [ ] Gestion 403 propre

---

## Ressources et Références

- **Schema Prisma** : `prisma/schema.prisma` (1025 lignes, très complet)
- **Seeders actuels** : `prisma/seeders/` (permissions.seeder.ts, roles.seeder.ts)
- **Guards existants** : `src/common/guards/` (permissions.guard.ts, org-scope.guard.ts)
- **CASL Factory** : `src/rbac/casl-ability.factory.ts`
- **Docs existantes** : `docs/ARCHITECTURE_RBAC.md`, `docs/RBAC_GUIDE.md`, `docs/ROLE_HIERARCHY.md`

---

## Support et Questions

Pour toute question sur l'implémentation, référez-vous à :
1. `docs/ARCHITECTURE_RBAC.md` - Vision architecturale
2. `docs/RBAC_GUIDE.md` - Guide pratique
3. Code existant dans `src/rbac/` et `src/common/guards/`

**Bon courage pour l'implémentation ! 🚀**
