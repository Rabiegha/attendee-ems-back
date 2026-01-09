/**
 * Authorization Service
 * Moteur de décision RBAC - Cœur du système d'autorisation
 */

import { AuthContext, RbacContext } from './types';
import { Decision, Decisions } from './decision';
import { PermissionResolver } from './permission-resolver';
import { ScopeEvaluator } from './scope-evaluator';
import { MembershipPort } from '../ports/membership.port';

export class AuthorizationService {
  constructor(
    private permissionResolver: PermissionResolver,
    private membershipPort: MembershipPort,
  ) {}

  /**
   * Vérifie si un user peut effectuer une action
   * C'est la méthode principale du moteur RBAC
   */
  async can(
    permissionKey: string,
    authContext: AuthContext,
    rbacContext: RbacContext = {},
  ): Promise<Decision> {
    // 1. Root bypass tout
    if (authContext.isRoot) {
      return Decisions.allow();
    }

    // 2. Vérifications contextuelles
    const contextCheck = await this.checkContext(authContext, rbacContext);
    if (!contextCheck.allowed) {
      return contextCheck;
    }

    // 3. Résoudre les permissions
    const { grants } = await this.permissionResolver.resolve(authContext);

    // 4. Chercher le grant correspondant
    const grant = this.permissionResolver.findGrant(grants, permissionKey);

    if (!grant) {
      return Decisions.denyNoPermission(permissionKey);
    }

    // 5. Évaluer le scope
    const scopeSatisfied = ScopeEvaluator.evaluate(grant.scope, authContext, rbacContext);

    if (!scopeSatisfied) {
      return Decisions.denyScopeMismatch(
        permissionKey,
        grant.scope,
        'insufficient',
      );
    }

    return Decisions.allow();
  }

  /**
   * Vérifie le contexte d'exécution
   */
  private async checkContext(
    authContext: AuthContext,
    rbacContext: RbacContext,
  ): Promise<Decision> {
    // Mode tenant : vérifier le contexte org
    if (authContext.mode === 'tenant') {
      if (!authContext.currentOrgId) {
        return Decisions.denyNoRole();
      }

      // Vérifier que le user est membre de l'org
      const isMember = await this.membershipPort.isMemberOfOrg(
        authContext.userId,
        authContext.currentOrgId,
      );

      if (!isMember) {
        return Decisions.denyNoOrgAccess(authContext.currentOrgId);
      }
    }

    // Mode platform : vérifier les accès assigned si applicable
    if (authContext.mode === 'platform' && rbacContext.resourceOrgId) {
      // Si platform assigned, vérifier l'accès à cette org
      const allowedOrgs = await this.membershipPort.getPlatformOrgAccess(authContext.userId);

      if (allowedOrgs !== null && !allowedOrgs.includes(rbacContext.resourceOrgId)) {
        return Decisions.denyNoOrgAccess(rbacContext.resourceOrgId);
      }
    }

    return Decisions.allow();
  }

  /**
   * Vérifie plusieurs permissions à la fois (pour optimisation)
   */
  async canAll(
    permissionKeys: string[],
    authContext: AuthContext,
    rbacContext: RbacContext = {},
  ): Promise<Map<string, Decision>> {
    const results = new Map<string, Decision>();

    for (const key of permissionKeys) {
      const decision = await this.can(key, authContext, rbacContext);
      results.set(key, decision);
    }

    return results;
  }

  /**
   * Vérifie si AU MOINS une des permissions est accordée (OR logic)
   */
  async canAny(
    permissionKeys: string[],
    authContext: AuthContext,
    rbacContext: RbacContext = {},
  ): Promise<Decision> {
    for (const key of permissionKeys) {
      const decision = await this.can(key, authContext, rbacContext);
      if (decision.allowed) {
        return decision;
      }
    }

    return Decisions.denyNoPermission(permissionKeys.join(' OR '));
  }
}
