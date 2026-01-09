/**
 * Require Permission Guard
 * Guard NestJS qui vérifie les permissions via le Core RBAC
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthorizationService } from '../../../core/authorization.service';
import { AuthContextPort, AUTH_CONTEXT_PORT, JwtPayload } from '../../../ports/auth-context.port';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';

@Injectable()
export class RequirePermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authorizationService: AuthorizationService,
    @Inject(AUTH_CONTEXT_PORT) private authContextPort: AuthContextPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Récupérer la permission requise depuis le decorator
    const requiredPermission = this.reflector.get<string>(
      REQUIRE_PERMISSION_KEY,
      context.getHandler(),
    );

    if (!requiredPermission) {
      // Pas de permission requise = autoriser
      return true;
    }

    // 2. Récupérer le JWT payload depuis la request
    const request = context.switchToHttp().getRequest<Request>();
    const jwtPayload = request.user as JwtPayload;

    if (!jwtPayload) {
      throw new ForbiddenException('Authentication required');
    }

    // 3. Construire l'AuthContext depuis le JWT minimal
    const authContext = await this.authContextPort.buildAuthContext(jwtPayload);

    // 4. Extraire le RbacContext depuis la request (params, body, etc.)
    const rbacContext = this.extractRbacContext(request);

    // 5. Vérifier la permission via le Core RBAC
    const decision = await this.authorizationService.can(
      requiredPermission,
      authContext,
      rbacContext,
    );

    if (!decision.allowed) {
      throw new ForbiddenException({
        message: 'Access denied',
        code: decision.code,
        details: decision.details,
      });
    }

    return true;
  }

  /**
   * Extrait le contexte RBAC depuis la request
   * (resourceOwnerId, assignedUserIds, etc.)
   */
  private extractRbacContext(request: Request): any {
    // MVP: contexte vide
    // TODO: Extraire depuis params/body/query
    const context: any = {};

    // Si route avec :id, on peut charger le resource
    if (request.params.id) {
      context.resourceId = request.params.id;
    }

    // Si route avec :orgId
    if (request.params.orgId) {
      context.resourceOrgId = request.params.orgId;
    }

    return context;
  }
}
