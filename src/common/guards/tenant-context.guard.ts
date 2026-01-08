import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';

/**
 * Guard qui vérifie que currentOrgId est présent dans le JWT
 * À utiliser sur les routes qui nécessitent un contexte tenant
 */
@Injectable()
export class TenantContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // JwtPayload injecté par JwtAuthGuard

    if (!user) {
      throw new BadRequestException('No user in request');
    }

    // Vérifier le mode et la présence de l'org
    if (user.mode !== 'tenant' || !user.currentOrgId) {
      throw new BadRequestException(
        'No organization context. Please switch to an organization first.',
      );
    }

    return true;
  }
}