/**
 * Permission Registry
 * Registry centralisé de toutes les permissions du système
 */

export interface PermissionDefinition {
  key: string;
  module: string;
  description: string;
  defaultScope?: 'own' | 'org' | 'assigned' | 'any';
}

/**
 * Toutes les permissions disponibles dans le système
 */
export const PERMISSIONS: PermissionDefinition[] = [
  // ========== EVENTS ==========
  {
    key: 'event.create',
    module: 'events',
    description: 'Créer un événement',
    defaultScope: 'org',
  },
  {
    key: 'event.read',
    module: 'events',
    description: 'Voir les événements',
    defaultScope: 'org',
  },
  {
    key: 'event.update',
    module: 'events',
    description: 'Modifier un événement',
    defaultScope: 'assigned',
  },
  {
    key: 'event.delete',
    module: 'events',
    description: 'Supprimer un événement',
    defaultScope: 'own',
  },
  {
    key: 'event.publish',
    module: 'events',
    description: 'Publier un événement',
    defaultScope: 'assigned',
  },

  // ========== ATTENDEES ==========
  {
    key: 'attendee.create',
    module: 'attendees',
    description: 'Créer un participant',
    defaultScope: 'org',
  },
  {
    key: 'attendee.read',
    module: 'attendees',
    description: 'Voir les participants',
    defaultScope: 'org',
  },
  {
    key: 'attendee.update',
    module: 'attendees',
    description: 'Modifier un participant',
    defaultScope: 'assigned',
  },
  {
    key: 'attendee.delete',
    module: 'attendees',
    description: 'Supprimer un participant',
    defaultScope: 'assigned',
  },
  {
    key: 'attendee.checkin',
    module: 'attendees',
    description: 'Effectuer un check-in',
    defaultScope: 'org',
  },
  {
    key: 'attendee.export',
    module: 'attendees',
    description: 'Exporter les participants',
    defaultScope: 'org',
  },

  // ========== REGISTRATIONS ==========
  {
    key: 'registration.create',
    module: 'registrations',
    description: 'Créer une inscription',
    defaultScope: 'org',
  },
  {
    key: 'registration.read',
    module: 'registrations',
    description: 'Voir les inscriptions',
    defaultScope: 'org',
  },
  {
    key: 'registration.update',
    module: 'registrations',
    description: 'Modifier une inscription',
    defaultScope: 'assigned',
  },
  {
    key: 'registration.delete',
    module: 'registrations',
    description: 'Supprimer une inscription',
    defaultScope: 'assigned',
  },
  {
    key: 'registration.approve',
    module: 'registrations',
    description: 'Approuver une inscription',
    defaultScope: 'assigned',
  },

  // ========== BADGES ==========
  {
    key: 'badge.create',
    module: 'badges',
    description: 'Créer un badge',
    defaultScope: 'org',
  },
  {
    key: 'badge.read',
    module: 'badges',
    description: 'Voir les badges',
    defaultScope: 'org',
  },
  {
    key: 'badge.update',
    module: 'badges',
    description: 'Modifier un badge',
    defaultScope: 'assigned',
  },
  {
    key: 'badge.delete',
    module: 'badges',
    description: 'Supprimer un badge',
    defaultScope: 'assigned',
  },
  {
    key: 'badge.print',
    module: 'badges',
    description: 'Imprimer un badge',
    defaultScope: 'org',
  },

  // ========== USERS ==========
  {
    key: 'user.invite',
    module: 'users',
    description: 'Inviter un utilisateur',
    defaultScope: 'org',
  },
  {
    key: 'user.read',
    module: 'users',
    description: 'Voir les utilisateurs',
    defaultScope: 'org',
  },
  {
    key: 'user.manage',
    module: 'users',
    description: 'Gérer les utilisateurs (roles, etc.)',
    defaultScope: 'org',
  },
  {
    key: 'user.remove',
    module: 'users',
    description: 'Retirer un utilisateur',
    defaultScope: 'org',
  },

  // ========== ANALYTICS ==========
  {
    key: 'analytics.view',
    module: 'analytics',
    description: 'Voir les analytics basiques',
    defaultScope: 'org',
  },
  {
    key: 'analytics.advanced',
    module: 'analytics',
    description: 'Voir les analytics avancées',
    defaultScope: 'org',
  },
  {
    key: 'analytics.export',
    module: 'analytics',
    description: 'Exporter les analytics',
    defaultScope: 'org',
  },

  // ========== ORGANIZATIONS ==========
  {
    key: 'org.read',
    module: 'organizations',
    description: 'Voir les infos de l\'organisation',
    defaultScope: 'org',
  },
  {
    key: 'org.update',
    module: 'organizations',
    description: 'Modifier l\'organisation',
    defaultScope: 'org',
  },
  {
    key: 'org.manage',
    module: 'organizations',
    description: 'Gérer l\'organisation (plan, modules, etc.)',
    defaultScope: 'org',
  },
  {
    key: 'org.delete',
    module: 'organizations',
    description: 'Supprimer l\'organisation',
    defaultScope: 'org',
  },

  // ========== PLATFORM (Root/Support) ==========
  {
    key: 'platform.admin',
    module: 'platform',
    description: 'Administration plateforme',
    defaultScope: 'any',
  },
  {
    key: 'platform.view_all_orgs',
    module: 'platform',
    description: 'Voir toutes les organisations',
    defaultScope: 'any',
  },
  {
    key: 'platform.impersonate',
    module: 'platform',
    description: 'Se connecter en tant qu\'utilisateur',
    defaultScope: 'any',
  },
];

/**
 * Helper pour trouver une permission par key
 */
export function getPermission(key: string): PermissionDefinition | undefined {
  return PERMISSIONS.find((p) => p.key === key);
}

/**
 * Helper pour lister les permissions d'un module
 */
export function getPermissionsByModule(module: string): PermissionDefinition[] {
  return PERMISSIONS.filter((p) => p.module === module);
}

/**
 * Valide qu'une clé de permission existe
 */
export function isValidPermissionKey(key: string): boolean {
  return PERMISSIONS.some((p) => p.key === key);
}
