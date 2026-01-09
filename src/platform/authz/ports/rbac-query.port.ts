/**
 * Port RBAC Query
 * Interface pour les requêtes RBAC (séparation explicite tenant/platform)
 */

import { Grant, TenantRole, PlatformRole } from '../core/types';

export const RBAC_QUERY_PORT = Symbol('RBAC_QUERY_PORT');

export interface RbacQueryPort {
  /**
   * Récupère le rôle tenant d'un user dans une org spécifique
   */
  getTenantRoleForUserInOrg(userId: string, orgId: string): Promise<TenantRole | null>;

  /**
   * Récupère le rôle platform d'un user (global)
   */
  getPlatformRoleForUser(userId: string): Promise<PlatformRole | null>;

  /**
   * Récupère les grants d'un rôle tenant
   */
  getGrantsForTenantRole(roleId: string): Promise<Grant[]>;

  /**
   * Récupère les grants d'un rôle platform
   */
  getGrantsForPlatformRole(roleId: string): Promise<Grant[]>;
}
