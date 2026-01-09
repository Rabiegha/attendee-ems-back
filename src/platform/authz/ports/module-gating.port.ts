/**
 * Port Module Gating
 * Interface pour vérifier si un module est activé pour une org
 */

export const MODULE_GATING_PORT = Symbol('MODULE_GATING_PORT');

export interface ModuleGatingPort {
  /**
   * Vérifie si un module est activé pour une organisation
   * MVP: retourne toujours true (implémentation réelle dans STEP 6)
   */
  isModuleEnabledForOrg(orgId: string, module: string): Promise<boolean>;
}
