/**
 * Port Membership
 * Interface pour vérifier les memberships et accès aux organisations
 */

export const MEMBERSHIP_PORT = Symbol('MEMBERSHIP_PORT');

export interface MembershipPort {
  /**
   * Vérifie si un user est membre d'une org (via org_users)
   */
  isMemberOfOrg(userId: string, orgId: string): Promise<boolean>;

  /**
   * Récupère les orgs accessibles pour un user platform assigned
   * Retourne null si le user n'a pas de rôle platform ou si scope = 'all'
   */
  getPlatformOrgAccess(userId: string): Promise<string[] | null>;
}
