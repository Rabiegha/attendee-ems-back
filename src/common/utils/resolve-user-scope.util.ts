/**
 * Types de scope pour les opérations Users
 */
export type UserScope = 'any' | 'org' | 'own';

/**
 * Résout le scope effectif pour les opérations de lecture d'users
 * basé sur le rôle et les permissions de l'utilisateur
 * 
 * Règles:
 * - SUPER_ADMIN: 'any' (cross-tenant)
 * - ADMIN, MANAGER: 'org' (son organisation uniquement)
 * - VIEWER, PARTNER, HOSTESS: 'own' (uniquement son propre profil)
 */
export function resolveUserReadScope(user: any): UserScope {
  // SUPER_ADMIN voit tout (cross-tenant)
  if (user.role === 'SUPER_ADMIN') {
    return 'any';
  }

  // Vérifier si l'utilisateur a une permission explicite avec scope
  if (user.permissions && Array.isArray(user.permissions)) {
    // Chercher users.read:any
    if (user.permissions.some((p: string) => p === 'users.read:any')) {
      return 'any';
    }
    
    // Chercher users.read:org
    if (user.permissions.some((p: string) => p === 'users.read:org')) {
      return 'org';
    }
    
    // Chercher users.read:own
    if (user.permissions.some((p: string) => p === 'users.read:own')) {
      return 'own';
    }
  }

  // ADMIN et MANAGER par défaut = org
  if (user.role === 'ADMIN' || user.role === 'MANAGER') {
    return 'org';
  }

  // Par défaut: own (VIEWER, PARTNER, HOSTESS, etc.)
  return 'own';
}

/**
 * Résout le scope effectif pour les opérations d'écriture (create, update, delete)
 * 
 * Règles:
 * - SUPER_ADMIN: 'any' (cross-tenant)
 * - Autres: 'org' (organisation uniquement)
 */
export function resolveUserWriteScope(user: any): UserScope {
  // SUPER_ADMIN peut tout faire cross-tenant
  if (user.role === 'SUPER_ADMIN') {
    return 'any';
  }

  // Vérifier si l'utilisateur a une permission explicite avec scope :any
  if (user.permissions && Array.isArray(user.permissions)) {
    const hasAnyScope = user.permissions.some((p: string) => 
      p.startsWith('users.') && p.endsWith(':any')
    );
    if (hasAnyScope) {
      return 'any';
    }
  }

  // Par défaut: org
  return 'org';
}
