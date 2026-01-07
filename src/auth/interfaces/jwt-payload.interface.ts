/**
 * JWT Payload minimal
 * Les permissions sont chargées dynamiquement via GET /me/ability
 */
export interface JwtPayload {
  sub: string;                      // userId
  mode: 'tenant' | 'platform';      // Mode utilisateur
  currentOrgId?: string;            // Org active (seulement si mode=tenant)
  iat: number;                      // Issued at
  exp: number;                      // Expiration
}

/**
 * Réponse de GET /me/ability
 */
export interface UserAbility {
  orgId: string | null;
  modules: string[];                // Modules accessibles
  grants: Grant[];                  // Permissions avec scopes
}

export interface Grant {
  key: string;                      // ex: 'event.create'
  scope: 'any' | 'own' | 'assigned'; // Portée de la permission
}

/**
 * Organisation disponible pour un user
 */
export interface AvailableOrg {
  orgId: string;
  orgSlug: string;
  orgName: string;
  role: string;
  roleLevel: number;
  isPlatform: boolean;
}
