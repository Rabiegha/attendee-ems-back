/**
 * Types de scope pour les opérations Registrations
 */
export type RegistrationScope = 'any' | 'org';

/**
 * Résout le scope effectif pour les opérations de lecture de registrations
 * basé sur le rôle et les permissions de l'utilisateur
 * 
 * Règles:
 * - SUPER_ADMIN: 'any' (cross-tenant)
 * - Tous les autres: 'org' (son organisation uniquement)
 */
export function resolveRegistrationReadScope(user: any): RegistrationScope {
  // SUPER_ADMIN voit tout (cross-tenant)
  if (user.role === 'SUPER_ADMIN') {
    return 'any';
  }

  // Vérifier si l'utilisateur a une permission explicite avec scope :any
  if (user.permissions && Array.isArray(user.permissions)) {
    if (user.permissions.some((p: string) => p === 'registrations.read:any')) {
      return 'any';
    }
  }

  // Par défaut: org (tous les autres rôles)
  return 'org';
}

/**
 * Résout le scope effectif pour les opérations d'écriture (create, update, import)
 * 
 * Règles:
 * - SUPER_ADMIN: 'any' (cross-tenant)
 * - Autres: 'org' (organisation uniquement)
 */
export function resolveRegistrationWriteScope(user: any): RegistrationScope {
  // SUPER_ADMIN peut tout faire cross-tenant
  if (user.role === 'SUPER_ADMIN') {
    return 'any';
  }

  // Vérifier si l'utilisateur a une permission explicite avec scope :any
  if (user.permissions && Array.isArray(user.permissions)) {
    const hasAnyScope = user.permissions.some((p: string) => 
      p.startsWith('registrations.') && p.endsWith(':any')
    );
    if (hasAnyScope) {
      return 'any';
    }
  }

  // Par défaut: org
  return 'org';
}
