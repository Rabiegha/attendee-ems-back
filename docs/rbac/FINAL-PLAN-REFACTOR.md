Plan d’execution
## 📐 Architecture Hexagonal Light

Livrables 🎉
1. Modèle multi-tenant : user global, plusieurs orgs, un seul role par org par user, (user pourrais avoir un role platform et tenant)
2. Un core d’autorisation (AuthorizationService) + ports/adapters, appliqué via des guards (adapters d’entrée)
3. Hiérarchie et structure des rôles (rank, rôle types, rôles clés) 
4. Permissions alignées métier + PermissionRegistry 
5. Refactor front-end (ability service CASL)
6. Provisioning automatique des rôles / permissions par org 
7. Propagation / mise à jour à grande échelle 
8. Gating par plan / modules (accès + fetch) 

Urgence Avant Lundi
1. Modèle multi-tenant : user global, plusieurs orgs, un seul role par org par user, (user pourrais avoir des roles platform et tenant)
2. Un core d’autorisation (AuthorizationService) + ports/adapters, appliqué via des guards (adapters d’entrée)
3. Hiérarchie et structure des rôles (rank, rôle types, rôles clés) 
4. Permissions alignées métier + PermissionRegistry
5. Refactor front-end (ability service CASL)


À préparer (mais pas “implémenter complètement”)
6. Provisioning automatique des rôles / permissions par org 
7. Propagation / mise à jour à grande échelle 
8. Gating par plan / modules (accès + fetch)


## 1 MODEL MULTITENANT

On modélise :

un compte global
des appartenances à des organisations (tenants)
1 rôle par user par org + (possibilite d'1 rôle platform “actif” par user)
user_roles a une contrainte unique (user_id, org_id) et une contrainte unique user (si ogr est null)
un user a un seul rôle actif dans une org
un root (cas spécial) comme un rôle/platform-level

Modèle final (simple et cohérent)
users (global)
org_users (membership tenant)
roles (tenant roles: org_id non null, platform roles: org_id null)
user_roles (assign roles, org_id null ou non)
  UNIQUE(user_id, org_id) WHERE org_id IS NOT NULL (rôle tenant unique)
  UNIQUE(user_id) WHERE org_id IS NULL (rôle platform unique)
platform_user_org_access (si platform scope=TENANT_ASSIGNED)

## Un core d’autorisation RBAC Et Scopes

Ce que tu construis réellement?
Un domaine RBAC/Authz avec :

CORE
Authorization Service (core) : le composant qui calcule allow/deny sur la base de RBAC + scopes.
Policies / Rules (core) : des règles pures (scope covers, role rank, etc.)
Ports (core) : ce dont le core a besoin (lire rôles, permissions, membership, plan/modules) (RbacQueryPort : getTenantRoleForUserInOrg(userId, orgId), getPlatformRoleForUser(userId), getGrantsForRole(roleId), MembershipPort, ModuleGatingPort) implémentés par des adapters (Prisma).

Les règles sont testables et indépendantes de NestJS/Prisma.

INFRA
Un adapter d’entrée transversal (guards/décorateurs) consommé par tous les modules
adapters/http/guards/* (transversal)
Adapter Prisma

Des endpoints admin (CRUD roles/assign) pour gérer RBAC
adapters/http/admin/* (module “normal” RBAC management)

Structure minimale (hexagonal light) pour RBAC :


src/platform/authz/
  core/
    authorization.service.ts     # decision engine (RBAC + scopes + rank + gating MVP)
    decision.ts                  # { allowed, code, details? }
    types.ts                     # AuthContext, RbacContext, Scope
    scope-evaluator.ts           # logique pure own/assigned/team/any (simple)
  ports/                         # SPI (interfaces)
    rbac-query.port.ts           # lire roles/permissions/scope_limit
    membership.port.ts           # vérifier org_users / accès platform
    module-gating.port.ts        # MVP: module activé pour org
  adapters/
    db/
       prisma-rbac-query.adapter.ts
      prisma-membership.adapter.ts
      prisma-module-gating.adapter.ts
    http/
      decorators/require-permission.decorator.ts
      guards/require-permission.guard.ts
      guards/tenant-context.guard.ts
      controllers/rbac-admin.controller.ts   # gestion roles/assign minimal
      controllers/me-ability.controller.ts   # GET /me/ability
  permission-registry.ts
  authz.module.ts



Ce que tu dois mettre en place pour le point 1 (V1 réaliste)

1. Entrées du core (ce qu’il reçoit)
AuthContext: { userId }
RequestContext: { orgId?: string } (venant de X-Org-Id)
Le core récupère ensuite :
tenantRole pour cet org
platformRole (si présent)
puis décide
Tu peux garder un orgId dans le contexte, mais pas isPlatform.

permissionKey : ex event.create
RbacContext : sur quoi ? (resourceOwnerId, resourceOrgId, assignedUserIds, teamIds…)

2. Sorties (mise à jour)

Decision :
{ allowed: boolean, code: DecisionCode, details?: any }
DecisionCode (enum) :
OK | NO_TENANT_CONTEXT | NOT_TENANT_MEMBER | PLATFORM_TENANT_ACCESS_DENIED | MODULE_DISABLED | MISSING_PERMISSION | SCOPE_DENIED

assert() : wrapper qui appelle can() et :

si allowed === true → retourne OK

sinon → throw ForbiddenException (403) en incluant code

Petit exemple mental :

can() sert pour tests / logique interne

assert() sert pour guards / controllers (où tu veux throw directement)

3. Règles internes minimales (scopes) — version adaptée
A) Règles “Tenant Access” (cross-tenant)
Ces règles déterminent si l’utilisateur a le droit d’agir sur cette organisation.
TENANT_ANY : accès à toutes les orgs
→ true
TENANT_ASSIGNED : accès uniquement aux orgs assignées
→ vérifier platform_user_org_access contient (user_id, org_id)
Remarque : pour un user tenant (non platform), l’accès tenant est géré par org_users (membership obligatoire).

B) Règles “Resource Scope” (dans une org)
Ces règles déterminent si l’utilisateur a le droit d’agir sur la ressource dans l’org ciblée.
any / org : accès à toutes les ressources de l’org
→ true
assigned : accès uniquement aux ressources assignées
→ vérifier la relation d’assignation (ex: event_access, attendee_access, etc.)
own : accès uniquement aux ressources dont il est propriétaire
→ resourceOwnerId === actorUserId

4. Ports minimaux (SPI) dont le core dépend
Tu n’en fais pas 12. Tu en fais 3 :
RbacQueryPort
    roles d’un user dans une org
    getRoleForUserInOrg(userId, orgId) (et pas “roles”)
    getRolePermissions(roleId) ou direct getGrantsForRole(roleId)
    permissions+scope_limit de ces roles

MembershipPort
    user appartient à org ?
    (si platform/assigned) accès à org ?

ModuleGatingPort (optionnel V1)
    module activé pour org ?


5. Adapters
Adapter DB Prisma qui implémente ces ports
Guard RequirePermissionGuard qui appelle authz.assert(...)
Decorator @RequirePermission('event.create', options?)

6. Ajoute un “PermissionResolver” dans le core (petit mais stratégique)

Tu veux être scalable (overrides futurs). Même si tu ne l’implémentes pas, structure le core ainsi :
PermissionResolver.resolveGrants(userId, orgId) → [{key, scopeLimit, moduleKey}]
En V1, il lit juste role_permissions.
En V2, tu ajoutes overrides sans refactor.
C’est un ajout minimal mais très rentable.

7. Définis un DecisionCode minimal (sinon debug impossible)

Ton Decision doit avoir un code. Fixe une liste très courte :

OK
NO_TENANT_CONTEXT (orgId manquant)
NOT_TENANT_MEMBER
PLATFORM_TENANT_ACCESS_DENIED
MODULE_DISABLED
MISSING_PERMISSION
SCOPE_DENIED

Ça va t’aider pour logs, front (403 propre), tests.


