/**
 * Me Ability Controller
 * Endpoint pour récupérer les permissions dynamiques de l'utilisateur connecté
 */

import { Controller, Get, UseGuards, Req, Inject } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { AuthContextPort, AUTH_CONTEXT_PORT, JwtPayload } from '../../../ports/auth-context.port';
import { PermissionResolver } from '../../../core/permission-resolver';
import { UserAbility } from '../../../core/types';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeAbilityController {
  constructor(
    @Inject(AUTH_CONTEXT_PORT) private authContextPort: AuthContextPort,
    private permissionResolver: PermissionResolver,
  ) {}

  /**
   * GET /me/ability
   * Retourne les permissions dynamiques de l'utilisateur connecté
   */
  @Get('ability')
  async getAbility(@Req() request: Request): Promise<UserAbility> {
    const jwtPayload = request.user as JwtPayload;

    // 1. Construire AuthContext
    const authContext = await this.authContextPort.buildAuthContext(jwtPayload);

    // 2. Résoudre les permissions
    const { grants, role } = await this.permissionResolver.resolve(authContext);

    // 3. Construire la réponse
    return {
      orgId: authContext.currentOrgId,
      mode: authContext.mode,
      role: {
        code: role?.code || 'NONE',
        name: role?.name || 'No Role',
        isPlatform: authContext.isPlatform,
        isRoot: authContext.isRoot,
      },
      grants,
    };
  }
}
