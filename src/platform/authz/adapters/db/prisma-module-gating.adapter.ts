/**
 * Prisma Module Gating Adapter
 * Implémentation du port ModuleGatingPort avec Prisma
 * MVP: retourne toujours true (implémentation réelle dans STEP 6)
 */

import { Injectable } from '@nestjs/common';
import { ModuleGatingPort } from '../../ports/module-gating.port';

@Injectable()
export class PrismaModuleGatingAdapter implements ModuleGatingPort {
  async isModuleEnabledForOrg(orgId: string, module: string): Promise<boolean> {
    // MVP: tous les modules sont activés par défaut
    // TODO STEP 6: implémenter la vraie logique avec plans/features
    return true;
  }
}
