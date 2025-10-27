/**
 * Types de scope pour les opérations Attendees
 */
export type AttendeeScope = 'any' | 'org';

/**
 * Résout le scope effectif pour les opérations de lecture d'attendees
 * basé sur le rôle et les permissions de l'utilisateur
 * 
 * Règles:
 * - SUPER_ADMIN: 'any' (cross-tenant)
 * - Tous les autres: 'org' (son organisation uniquement)
 * 
 * Note: Contrairement aux events, les attendees n'ont pas de scope 'assigned'
 * car ils sont toujours accessibles au niveau organisation
 */
export function resolveAttendeeReadScope(user: any): AttendeeScope {
  // SUPER_ADMIN voit tout (cross-tenant)
  if (user.role === 'SUPER_ADMIN') {
    return 'any';
  }

  // Vérifier si l'utilisateur a une permission explicite avec scope :any
  if (user.permissions && Array.isArray(user.permissions)) {
    if (user.permissions.some((p: string) => p === 'attendees.read:any')) {
      return 'any';
    }
  }

  // Par défaut: org (tous les autres rôles)
  return 'org';
}

/**
 * Résout le scope effectif pour les opérations d'écriture (create, update, delete)
 * 
 * Règles:
 * - SUPER_ADMIN: 'any' (cross-tenant)
 * - Autres: 'org' (organisation uniquement)
 */
export function resolveAttendeeWriteScope(user: any): AttendeeScope {
  // SUPER_ADMIN peut tout faire cross-tenant
  if (user.role === 'SUPER_ADMIN') {
    return 'any';
  }

  // Vérifier si l'utilisateur a une permission explicite avec scope :any
  if (user.permissions && Array.isArray(user.permissions)) {
    const hasAnyScope = user.permissions.some((p: string) => 
      p.startsWith('attendees.') && p.endsWith(':any')
    );
    if (hasAnyScope) {
      return 'any';
    }
  }

  // Par défaut: org
  return 'org';
}
