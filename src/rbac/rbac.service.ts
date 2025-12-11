import { Injectable } from "@nestjs/common";

// src/rbac/rbac.service.ts
export type RbacScope = 'own' | 'assigned' | 'any';

export interface RbacContext {
  accountType: 'tenant' | 'platform';
  orgId?: string;
  bypass?: boolean; // root / SUPER_ADMIN
  // plus tard: resourceOwnerId, isAssignedToResource, allowedOrgIds, moduleKey, etc.
}

@Injectable()
export class RbacService {
  async can(user: any, permissionKey: string, ctx: RbacContext): Promise<boolean> {
    // 1. bypass root / super admin
    if (ctx?.bypass || user?.is_root || user?.role === 'SUPER_ADMIN') {
      return true;
    }

    // 2. vérifier que l'utilisateur possède la permission
    const { hasPermission, scope } = this.hasPermissionWithScope(user, permissionKey);
    if (!hasPermission || !scope) return false;

    // 3. (plus tard) gating par module ici si tu as moduleKey

    // 4. appliquer la logique tenant / platform + scope
    if (ctx.accountType === 'tenant') {
      return this.canAsTenant(user, permissionKey, scope, ctx);
    } else {
      return this.canAsPlatform(user, permissionKey, scope, ctx);
    }
  }

  private hasPermissionWithScope(
    user: any,
    permissionKey: string,
  ): { hasPermission: boolean; scope?: RbacScope } {
    const userPermissions: string[] = user?.permissions || [];
    const matches = userPermissions.filter((perm) => {
      const [resourceAction] = perm.split(':');
      return resourceAction === permissionKey;
    });

    if (matches.length === 0) {
      return { hasPermission: false };
    }

    let bestScope: RbacScope = 'own';

    for (const perm of matches) {
      const [, scopePart] = perm.split(':');
      const scope = (scopePart as RbacScope) || 'own';

      if (scope === 'any') {
        bestScope = 'any';
        break;
      } else if (scope === 'assigned' && bestScope === 'own') {
        bestScope = 'assigned';
      }
    }

    return { hasPermission: true, scope: bestScope };
  }

    private canAsTenant(
    user: any,
    permissionKey: string,
    scope: RbacScope,
    ctx: RbacContext,
    ): boolean {
    // Sécurité : un tenant ne doit jamais agir hors de son org actuelle
    if (!ctx.orgId) return false;

    // (Plus tard : vérifier qu'il appartient bien à cette org)

    // Pour l'instant, on ne fait pas de contrôle ultra fin
    // on peut déjà faire une base comme :
    switch (scope) {
        case 'any':
        // il peut agir sur n'importe quelle ressource de cette org
        return true;

        case 'assigned':
        // il doit être assigné à la ressource ou à l'event
        // ctx devra contenir l'info (ex: ctx.assigned = true / ctx.isAssignedToResource)
        if (ctx['isAssignedToResource'] === true) {
            return true;
        }
        return false;

        case 'own':
        // il doit être owner de la ressource (ex: created_by)
        if (ctx['resourceOwnerId'] && ctx['resourceOwnerId'] === user.id) {
            return true;
        }
        return false;

        default:
        return false;
    }
    }


    private canAsPlatform(
    user: any,
    permissionKey: string,
    scope: RbacScope,
    ctx: RbacContext,
    ): boolean {
    // Si pas d'org ciblée, dépend de l'action (ex: liste des orgs)
    // MVP : on accepte pour l'instant si le user a la permission
    if (!ctx.orgId) {
        return true;
    }

    switch (scope) {
        case 'any':
        // support L3 / ops / root (hors bypass) → accès à toutes les orgs
        return true;

        case 'assigned':
        // il ne peut agir que sur les orgs auxquelles il est assigné
        // par ex via platform_user_org_access, préchargées dans ctx
        const allowedOrgIds: string[] = ctx['allowedOrgIds'] || [];
        return allowedOrgIds.includes(ctx.orgId);

        case 'own':
        // pour certains outils internes, own peut vouloir dire "ce que j'ai créé"
        // ici, pour des actions sur une org, c'est rarement utilisé, mais tu peux gérer comme :
        if (ctx['resourceOwnerId'] && ctx['resourceOwnerId'] === user.id) {
            return true;
        }
        return false;

        default:
        return false;
    }
    }

}
