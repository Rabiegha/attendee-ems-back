/**
 * Permission Resolver
 * Résout les grants (permissions) pour un user dans un contexte donné
 */

import { AuthContext, Grant, ResolvedPermissions } from './types';
import { RbacQueryPort } from '../ports/rbac-query.port';

export class PermissionResolver {
  constructor(private rbacQueryPort: RbacQueryPort) {}

  /**
   * Résout les permissions pour un user tenant dans une org
   */
  async resolveTenantPermissions(
    userId: string,
    orgId: string,
  ): Promise<ResolvedPermissions> {
    const role = await this.rbacQueryPort.getTenantRoleForUserInOrg(userId, orgId);

    if (!role) {
      return { grants: [], role: null };
    }

    const grants = await this.rbacQueryPort.getGrantsForTenantRole(role.id);

    return { grants, role };
  }

  /**
   * Résout les permissions pour un user platform
   */
  async resolvePlatformPermissions(userId: string): Promise<ResolvedPermissions> {
    const role = await this.rbacQueryPort.getPlatformRoleForUser(userId);

    if (!role) {
      return { grants: [], role: null };
    }

    const grants = await this.rbacQueryPort.getGrantsForPlatformRole(role.id);

    return { grants, role };
  }

  /**
   * Résout les permissions selon le mode (tenant ou platform)
   */
  async resolve(authContext: AuthContext): Promise<ResolvedPermissions> {
    if (authContext.mode === 'platform') {
      return this.resolvePlatformPermissions(authContext.userId);
    }

    // Tenant mode
    if (!authContext.currentOrgId) {
      return { grants: [], role: null };
    }

    return this.resolveTenantPermissions(authContext.userId, authContext.currentOrgId);
  }

  /**
   * Trouve un grant spécifique parmi une liste de grants
   */
  findGrant(grants: Grant[], permissionKey: string): Grant | undefined {
    return grants.find((g) => g.key === permissionKey);
  }
}
