/**
 * Scope Evaluator
 * Évalue si un scope est satisfait dans un contexte donné
 */

import { Scope, AuthContext, RbacContext } from './types';

export class ScopeEvaluator {
  /**
   * Évalue si le scope requis est satisfait
   */
  static evaluate(
    requiredScope: Scope,
    authContext: AuthContext,
    rbacContext: RbacContext,
  ): boolean {
    switch (requiredScope) {
      case 'any':
        // Scope le plus large : toujours autorisé
        return true;

      case 'org':
        // Accès à toutes les ressources de l'org
        if (authContext.mode === 'platform' && authContext.isRoot) {
          return true; // Root bypass tout
        }
        // Pour tenant-mode : vérifié au niveau du contexte (currentOrgId)
        return true;

      case 'assigned':
        // Accès uniquement aux ressources assignées
        if (authContext.isRoot) {
          return true; // Root bypass
        }
        const { assignedUserIds } = rbacContext;
        return assignedUserIds ? assignedUserIds.includes(authContext.userId) : false;

      case 'own':
        // Accès uniquement aux ressources dont on est propriétaire
        if (authContext.isRoot) {
          return true; // Root bypass
        }
        const { resourceOwnerId } = rbacContext;
        return resourceOwnerId === authContext.userId;

      default:
        return false;
    }
  }

  /**
   * Retourne le scope effectif le plus large autorisé pour un user
   */
  static getEffectiveScope(grantedScope: Scope, authContext: AuthContext): Scope {
    if (authContext.isRoot) {
      return 'any'; // Root a toujours scope any
    }
    return grantedScope;
  }
}
