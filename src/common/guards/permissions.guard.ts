import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory } from '../../rbac/casl-ability.factory';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Action, Subjects } from '../../rbac/rbac.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const ability = this.caslAbilityFactory.createForUser(user);

    const hasPermission = requiredPermissions.some(permission => {
      const [action, subject] = this.parsePermission(permission);
      return ability.can(action, subject);
    });

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }

  private parsePermission(permission: string): [Action, Subjects] {
    const parts = permission.split('.');
    if (parts.length !== 2) {
      throw new Error(`Invalid permission format: ${permission}`);
    }

    const [subject, actionWithCondition] = parts;
    
    // Extraire l'action en supprimant les conditions (:own, :any, etc.)
    const action = actionWithCondition.split(':')[0];
    
    const actionMap: Record<string, Action> = {
      'create': Action.Create,
      'read': Action.Read,
      'update': Action.Update,
      'delete': Action.Delete,
      'manage': Action.Manage,
    };

    const subjectMap: Record<string, Subjects> = {
      'users': 'User',
      'organizations': 'Organization',
      'roles': 'Role',
      'permissions': 'Permission',
      'attendee': 'Attendee',
    };

    return [actionMap[action] || Action.Read, subjectMap[subject] || 'all'];
  }
}
