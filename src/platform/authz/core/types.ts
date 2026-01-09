/**
 * Types Core du système RBAC
 * Architecture Hexagonale - Domaine Pur (0 dépendance infra)
 */

/**
 * Mode d'exécution de l'utilisateur
 */
export type AuthMode = 'tenant' | 'platform';

/**
 * Contexte d'authentification (construit depuis JWT minimal via AuthContextPort)
 */
export interface AuthContext {
  userId: string;
  mode: AuthMode;
  isPlatform: boolean;
  isRoot: boolean;
  currentOrgId: string | null;
}

/**
 * Contexte RBAC enrichi pour l'évaluation des permissions
 */
export interface RbacContext {
  resourceOrgId?: string;        // Org du resource ciblé
  resourceOwnerId?: string;      // Owner du resource
  assignedUserIds?: string[];    // Users assignés au resource
  [key: string]: any;            // Contexte custom additionnel
}

/**
 * Scope d'une permission
 */
export type Scope = 'own' | 'org' | 'assigned' | 'any';

/**
 * Grant (permission accordée)
 */
export interface Grant {
  key: string;                   // ex: 'event.create'
  scope: Scope;                  // Portée de la permission
}

/**
 * Rôle tenant avec ses grants
 */
export interface TenantRole {
  id: string;
  orgId: string;
  code: string;
  name: string;
  level: number;
  rank: number;
  grants: Grant[];
}

/**
 * Rôle platform avec ses grants
 */
export interface PlatformRole {
  id: string;
  code: string;
  name: string;
  isRoot: boolean;
  orgAccessLevel: 'GLOBAL' | 'LIMITED';  // Accès aux organisations (aligné sur la DB)
  grants: Grant[];
}

/**
 * Ability complète d'un user (pour GET /me/ability)
 */
export interface UserAbility {
  orgId: string | null;
  mode: AuthMode;
  role: {
    code: string;
    name: string;
    isPlatform: boolean;
    isRoot: boolean;
  };
  grants: Grant[];
}

/**
 * Résultat de résolution des permissions
 */
export interface ResolvedPermissions {
  grants: Grant[];
  role: TenantRole | PlatformRole | null;
}
