import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';

/**
 * Guard pour contrôler les modifications de rôles
 * 
 * RÈGLES:
 * 1. SUPER_ADMIN peut modifier tous les rôles (y compris ADMIN)
 * 2. ADMIN peut modifier tous les rôles SAUF le sien propre
 * 3. Autres rôles ne peuvent PAS modifier les rôles
 */
@Injectable()
export class RoleModificationGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // Récupérer l'ID de l'utilisateur cible depuis les paramètres ou le body
    const targetUserId = request.params?.id || request.body?.userId;
    
    if (!targetUserId) {
      // Si pas d'ID cible, laisser passer (sera géré par d'autres validations)
      return true;
    }

    // Vérifier si le body contient une modification de rôle
    const newRoleId = request.body?.role_id || request.body?.roleId;
    
    if (!newRoleId) {
      // Pas de modification de rôle, laisser passer
      return true;
    }

    // SUPER_ADMIN peut tout modifier
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    // ADMIN ne peut pas modifier son propre rôle
    if (user.role === 'ADMIN') {
      if (user.sub === targetUserId) {
        throw new ForbiddenException(
          'Administrators cannot modify their own role. Contact a SUPER_ADMIN for role changes.'
        );
      }
      
      // ADMIN peut modifier les rôles des autres utilisateurs de son organisation
      const targetUser = await this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: { org_id: true },
      });

      if (!targetUser) {
        throw new ForbiddenException('Target user not found');
      }

      // Vérifier que l'utilisateur cible est dans la même organisation
      if (targetUser.org_id !== user.org_id) {
        throw new ForbiddenException('Cannot modify users from other organizations');
      }

      return true;
    }

    // Tous les autres rôles ne peuvent pas modifier les rôles
    throw new ForbiddenException(
      'You do not have permission to modify user roles. Only SUPER_ADMIN and ADMIN can assign roles.'
    );
  }
}
