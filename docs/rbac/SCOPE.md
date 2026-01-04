
1. Déterminer orgId cible
2. Vérifier accès à l’org (membership tenant OU tenantAccessScope platform)
3. Vérifier permission + resource scope


Scope de sélection des tenants (sur quelles orgs je peux agir ?)
Scope sur les ressources dans un tenant (sur quelles ressources de cette org je peux agir ?)

## Niveau A — “Tenant scope” (cross-tenant)

Ça ne concerne que les users platform (ou ceux qui peuvent agir cross-tenant).
Exemples :

TENANT_ANY : peut agir sur tous les tenants
TENANT_ASSIGNED : seulement tenants présents dans platform_user_org_access

## Niveau B — “Resource scope” (dans un tenant)

Ça concerne l’accès aux ressources dans l’org.
Exemples :

OWN : ressources dont il est owner
ASSIGNED : ressources assignées (event_access)
ANY : toutes les ressources de l’org

