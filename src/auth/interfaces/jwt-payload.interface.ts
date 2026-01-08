/**
 * JWT Payload minimal (STEP 2)
 * 
 * Les permissions ne sont PAS dans le JWT.
 * Elles sont chargées dynamiquement via GET /auth/me/ability
 * 
 * iat et exp sont gérés automatiquement par JwtModule
 * 
 * @see https://datatracker.ietf.org/doc/html/rfc8725
 */
export interface JwtPayload {
  sub: string;                      // userId
  mode: 'tenant' | 'platform';      // Mode utilisateur
  currentOrgId?: string;            // Org active (seulement si mode=tenant)
  iat?: number;                     // Issued at (timestamp Unix) - géré par JwtModule
  exp?: number;                     // Expiration (timestamp Unix) - géré par JwtModule
}

/**
 * Réponse de GET /auth/me/ability
 * Contient les permissions de l'utilisateur pour l'org active
 */
export interface UserAbility {
  orgId: string | null;             // Org active (null si platform mode)
  modules: string[];                // Modules accessibles (ex: ['events', 'attendees'])
  grants: Grant[];                  // Permissions avec leurs scopes
}

/**
 * Permission individuelle (grant)
 */
export interface Grant {
  key: string;                      // ex: 'event.create', 'attendee.read'
  scope: 'any' | 'org' | 'own';     // Portée de la permission
}

/**
 * Organisation disponible pour l'utilisateur
 * Utilisé par GET /auth/me/orgs
 */
export interface AvailableOrg {
  orgId: string;
  orgSlug: string;
  orgName: string;
  role: string;                     // Nom du rôle (ex: 'Admin', 'Manager')
  roleLevel: number;                // Niveau du rôle (1=plus haut)
  isPlatform: boolean;              // Accès via platform role ou tenant membership
}
