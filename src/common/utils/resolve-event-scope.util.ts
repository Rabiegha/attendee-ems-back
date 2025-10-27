/**
 * Types de scope pour les opérations Events
 */
export type EventScope = 'any' | 'org' | 'assigned';

/**
 * Résout le scope effectif pour les opérations de lecture d'events
 * basé sur le rôle et les permissions de l'utilisateur
 * 
 * Règles:
 * - SUPER_ADMIN: 'any' (cross-tenant)
 * - ADMIN: 'org' (son organisation uniquement)
 * - Utilisateur avec permission events.read:any: 'any'
 * - Utilisateur avec permission events.read:org: 'org'
 * - Autres (PARTNER, HOSTESS): 'assigned' (via EventAccess)
 */
export function resolveEventReadScope(user: any): EventScope {
  // SUPER_ADMIN voit tout (cross-tenant)
  if (user.role === 'SUPER_ADMIN') {
    return 'any';
  }

  // Vérifier si l'utilisateur a une permission explicite avec scope
  if (user.permissions && Array.isArray(user.permissions)) {
    // Chercher events.read:any
    if (user.permissions.some((p: string) => p === 'events.read:any')) {
      return 'any';
    }
    
    // Chercher events.read:org ou si ADMIN
    if (user.role === 'ADMIN' || user.permissions.some((p: string) => p === 'events.read:org')) {
      return 'org';
    }
  }

  // ADMIN par défaut = org
  if (user.role === 'ADMIN') {
    return 'org';
  }

  // Par défaut: assigned (PARTNER, HOSTESS, etc.)
  return 'assigned';
}

/**
 * Résout le scope effectif pour les opérations d'écriture (create, update, delete)
 * 
 * Règles:
 * - SUPER_ADMIN: 'any' (cross-tenant)
 * - ADMIN ou permission avec :any: 'any'
 * - Autres: 'org' (organisation uniquement)
 */
export function resolveEventWriteScope(user: any): EventScope {
  // SUPER_ADMIN peut tout faire cross-tenant
  if (user.role === 'SUPER_ADMIN') {
    return 'any';
  }

  // Vérifier si l'utilisateur a une permission explicite avec scope :any
  if (user.permissions && Array.isArray(user.permissions)) {
    const hasAnyScope = user.permissions.some((p: string) => 
      p.startsWith('events.') && p.endsWith(':any')
    );
    if (hasAnyScope) {
      return 'any';
    }
  }

  // ADMIN par défaut = any (mais sera limité à son org au niveau Prisma)
  // Pour les autres, scope org
  return user.role === 'ADMIN' ? 'any' : 'org';
}
