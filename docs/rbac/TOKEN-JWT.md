## Mettre un petit JWL au lien de meyttre un gros token JWL pour eviter:

Taille JWT (surtout si user a beaucoup d’orgs ou beaucoup de permissions).

Staleness : si un admin change les permissions/roles, ton JWT devient faux jusqu’au prochain refresh/switch.

tu gardes JWT minimal et tu relies l’UI à GET /me/ability

“JWT minimal”, ça veut dire quoi ?

Typiquement :

Tenant-mode token (après switch-org)

{
  "sub": "user-123",
  "currentOrgId": "org-abc",
  "mode": "tenant",
  "iat": 123,
  "exp": 456
}

Platform-mode token

{
  "sub": "user-123",
  "mode": "platform",
  "iat": 123,
  "exp": 456
}

Ensuite, le backend lit en DB le rôle/permissions au moment de la requête via tes ports.

En bref : JWT minimal = “identité + org active”, pas “toute la matrice RBAC”.


Endpoint dédié : GET /me/ability
Le backend renvoie un JSON simple :

{
  "orgId": "org-abc",
  "modules": ["events", "attendees"],
  "grants": [
    { "key": "event.read", "scope": "any" },
    { "key": "event.create", "scope": "org" },
    { "key": "attendee.import", "scope": "org" }
  ]
}

Le front utilise ce JSON pour construire une “ability” CASL (ou même sans CASL, juste un can("event.create")). (a voir comment le front est gere, pour voir c'est quoi le meilleur choix a choisir, ce que je veux dire par la c'est que moi j'ai pas eu le temps de voir le front, et comment c'est gerer, mais j'imagine que c'est gerer par CASL, du coup c'est a toi de voir comment le front est gerer, et me dire si ce que j'ai propsé comme solution est bien ou pas, pour le  GET /me/ability)



switch-org (le moment clé)
Front

user choisit une org dans la UI

appelle : POST /auth/switch-org { orgId }

Back (très important)

vérifie que l’org est accessible :

si user a un platform_user_role :

scope=TENANT-ALL → ok

scope=TANNAT-ASIGNED → check platform_user_org_access

sinon (tenant normal) :

check org_users membership

émet un nouveau JWT tenant-mode avec currentOrgId

Réponse
{
  "accessToken": "<jwt tenant-mode>",
  "mode": "tenant"
}



du coup ca va etre quoi le flow?

A) Auth/Login
Front

envoie POST /auth/login { email, password }

Back

vérifie credentials

décide si tu donnes :

Cas A — User “tenant-only”

membre d’1 org (ou org par défaut déterminable)

pas de platform role
➡️ on renvoie directement un token tenant-mode avec currentOrgId

S’il est membre de plusieurs orgs :
➡️ on renvoie un token “tenant-no-org” (voir plus bas) + on force selection org

Cas B — User “platform” (support/root) (qu’il ait aussi des orgs ou non)

➡️ token platform-mode (sans currentOrgId) + il doit choisir une org quand il veut agir sur des données tenant

Cas C — User multi-tenant (plusieurs orgs) sans platform role

➡️ tu as 2 choix propres :

si tu as un default org (dans org_users.is_default ou users.default_org_id) : token tenant-mode direct

sinon : token “tenant-no-org” (pas platform) + écran de choix org + switch-org

Et c’est ça la nuance importante : “pas d’org active” ne veut pas dire “platform-mode”.

Nouveau modèle de tokens (clair et sécurisé)
1) Tenant-mode (org active)
{
  "sub": "user-123",
  "mode": "tenant",
  "currentOrgId": "org-abc",
  "iat": 123,
  "exp": 456
}

2) Platform-mode (support/root)
{
  "sub": "user-123",
  "mode": "platform",
  "iat": 123,
  "exp": 456
}
3) Tenant-no-org (user tenant multi-org sans org active)
{
  "sub": "user-123",
  "mode": "tenant",
  "currentOrgId": null,
  "iat": 123,
  "exp": 456
}
Ou mieux (si tu veux éviter null) :

{
  "sub": "user-123",
  "mode": "tenant",
  "iat": 123,
  "exp": 456
}



Flow complet au login (backend)

À POST /auth/login, le backend fait :

Charger :

platformRole (existe ?)

liste des org memberships (org_users)

éventuellement defaultOrgId (is_default)

Décider :

Si platformRole existe → token mode=platform

Sinon si membership count = 0 → erreur / onboarding (pas d’org)

Sinon si membership count = 1 → token tenant-mode avec cette org

Sinon (>=2) :

si defaultOrgId existe → token tenant-mode avec defaultOrgId

sinon → token tenant-no-org (mode tenant, sans org active)

Ça correspond exactement à ce que tu veux : un token “intelligent”.

switch-org ensuite (toujours utile)

Même si tu donnes un tenant-mode direct aux users “1 org”, le switch-org reste utile :

users multi-org

support/root

“changer d’org” dans l’UI



et ca c'est pour plu tard D) Appeler les endpoints métier (events, attendees, etc.)
Front

appelle des routes normales : GET /events, POST /events, etc.

envoie juste : Authorization: Bearer <jwt tenant-mode>

pas de header orgId, pas de param orgId

Back

JwtAuthGuard → te donne sub

TenantContextGuard → lit currentOrgId dans le JWT, le met dans req.auth.currentOrgId

RequirePermissionGuard → appelle AuthorizationService.assert(...)

Le core RBAC utilise :

sub + currentOrgId pour charger le rôle tenant (ou vérifier platform+accès si tu autorises support en tenant-mode)

puis charge les grants du rôle (getGrantsForRole)

puis applique scopes

E) UI conditionnelle (CASL ou simple) : /me/ability
Front

À chaque fois que :

tu fais switch-org

ou au refresh de page (token tenant-mode présent)

Tu appelles :
GET /me/ability

Back

prend sub + currentOrgId

calcule :

modules enabled (MVP)

grants (permissions + scope_limit)

Réponse
{
  "orgId": "org-abc",
  "modules": ["events", "attendees"],
  "grants": [
    { "key": "event.read", "scope": "any" },
    { "key": "event.create", "scope": "org" }
  ]
}

Front

stocke ça (Redux/Zustand)

expose can(permissionKey) et canUse(moduleKey)

l’UI masque/affiche menus/boutons












## A voir aprés 


2) Gros trou actuel : “platform actions sans org” vs ton core RBAC

Dans STEP 3, AuthorizationService.can() refuse si currentOrgId est null : NO_TENANT_CONTEXT. 

STEP_3_CORE_RBAC


Donc toutes les permissions passent par “tenant context requis”.

Problème : tu as explicitement un mode platform (support/root) dans le JWT (isPlatform, isRoot). 

STEP_2_JWT_MULTI_ORG


Mais ton core actuel ne supporte pas proprement :

des routes platform-only (ex: gestion globale des orgs, support tools)

un support qui fait une action “platform” sans currentOrgId.

Tu as 2 solutions (choisis une et fige-la) :

Option A (recommandée pour V1) : tout passe en “tenant-mode”
Même le support doit switch-org avant d’agir sur /events /attendees. Ton STEP 2 est déjà conçu pour ça. 

STEP_2_JWT_MULTI_ORG


Et tu gardes des routes platform-only très rares, séparées (ex: /platform/orgs), protégées par un guard différent.

Option B : RBAC supporte des permissions “platform.” sans org*
Il faut alors :

marquer certaines permissions comme requiresOrg=false

faire une branche dans can() : si permission platform et isPlatform||isRoot, pas besoin de org.

Aujourd’hui ton doc mélange les deux (flags platform dans JWT, mais core qui exige org). Il faut corriger ça sinon tu vas te bloquer en implémentation.

3) STEP 3 : ports/adapters OK, mais le “RbacQueryPort” doit gérer tenant + platform

Tu as PermissionResolver.resolveGrants(userId, orgId) qui suppose un contexte org. 

STEP_3_CORE_RBAC


Or ton modèle a :

tenant role par org

platform role global

Donc ton port doit être explicite, du style :

getTenantRoleForUserInOrg(userId, orgId)

getPlatformRoleForUser(userId)

getGrantsForRole(roleId)

Et resolveGrants() doit choisir : tenant role si org, sinon platform role (ou refuser selon Option A vs B au-dessus).

4) DecisionCode : c’est bien, garde-le minimal et stable

Ton core renvoie Decision { allowed, code, details } et assert() throw un 403 avec code+details. 

STEP_3_CORE_RBAC


C’est exactement ce qu’il te faut pour :

debug

tests

front (gestion propre des 403)

Assure-toi juste que :

les codes sont une API contractuelle (ne pas les renommer toutes les semaines)

tu journalises decision.code côté backend sur les denies importants

5) STEP 4 : c’est là que tu vas “payer” si tu ne scopes pas

Ton STEP 4 dit clairement : la DB/JWT/core sont prêts mais “pas utilisés”, donc gros refactor applicatif. 

STEP_4_REFACTOR_SERVICES


Le piège : vouloir adapter 100% des modules.

Plan réaliste (si tu as peu de temps) :

AuthService + JwtStrategy + TenantContextGuard d’abord 

STEP_2_JWT_MULTI_ORG

puis 1 module métier critique (events) comme modèle

puis clone pattern pour attendees

Ce que tu as possiblement “zappé” (à décider maintenant)

Règle de vérité UI : JWT.permissions ou /me/ability ? (choisir une source)

Cas platform sans org : Option A (support switch-org obligatoire) ou Option B (permissions platform sans org).

Quand roles/permissions changent : comment le front se met à jour (refresh token, forced re-login, versioning).

Cache (optionnel) : getGrantsForRole et “resolveGrants” seront appelés souvent. Même un cache mémoire simple peut aider, mais pas obligatoire en V1.

Migration front CASL : tu as “MeAbilityController” prévu, mais il faut décider le format exact retourné (actions/scope/resource) et comment CASL le consomme. 

STEP_3_CORE_RBAC

Comment on continue (sans te noyer)

Tu m’as dit : tu vas envoyer les fichiers un par un. Fais ça, dans cet ordre :

STEP 2

STEP 3

STEP 4

STEP 5

À chaque fichier, je te dis :

ce qui est bon

ce qui est dangereux

ce qui manque

et “ce que tu vas obtenir” une fois appliqué.

Envoie-moi STEP 2 en premier (le contenu que tu suis réellement, pas juste un extrait).