/**
 * Port Auth Context
 * Construit un AuthContext complet depuis le JWT minimal
 */

import { AuthContext } from '../core/types';

export const AUTH_CONTEXT_PORT = Symbol('AUTH_CONTEXT_PORT');

/**
 * Payload minimal du JWT (STEP 2)
 */
export interface JwtPayload {
  sub: string;                      // userId
  mode: 'tenant' | 'platform';      // Mode d'exécution
  currentOrgId?: string;            // Org active (si tenant-mode)
  iat: number;
  exp: number;
}

export interface AuthContextPort {
  /**
   * Construit un AuthContext complet depuis un JWT minimal
   * Effectue une requête DB pour récupérer isPlatform et isRoot
   */
  buildAuthContext(jwtPayload: JwtPayload): Promise<AuthContext>;
}
