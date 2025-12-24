import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory } from '../../authorization/casl-ability.factory';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Action, Subjects } from '../../authorization/rbac.types';

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
      console.log('❌ PermissionsGuard: User not authenticated');
      throw new ForbiddenException('User not authenticated');
    }

    console.log('🔍 PermissionsGuard DEBUG:', {
      userId: user.sub,
      role: user.role,
      permissions: user.permissions,
      requiredPermissions,
    });

    const ability = this.caslAbilityFactory.createForUser(user);

    const hasPermission = requiredPermissions.some(permission => {
      const [action, subject] = this.parsePermission(permission);
      const canAccess = ability.can(action, subject);
      console.log(`🔍 Permission check: ${permission} -> ${action} on ${subject} = ${canAccess}`);
      return canAccess;
    });

    console.log('🔍 Final permission result:', hasPermission);

    if (!hasPermission) {
      console.log('❌ PermissionsGuard: Insufficient permissions');
      throw new ForbiddenException('Insufficient permissions');
    }

    // Add authorization flags for multi-tenancy
    request.authz = {
      canAttendeesAny:
        user.isPlatformAdmin ||
        user.permissions?.some(
          (p: string) => p.startsWith('attendees.') && p.endsWith(':any'),
        ),
    };

    return true;
  }

  /**
   * Parse une permission pour extraire action et subject
   * Ignore le scope (:any, :org, :assigned) - gating binaire uniquement
   * Ex: "events.read:any" -> [Action.Read, 'Event']
   * Ex: "events.create" -> [Action.Create, 'Event']
   */
  private parsePermission(permission: string): [Action, Subjects] {
    const parts = permission.split('.');
    if (parts.length !== 2) {
      throw new Error(`Invalid permission format: ${permission}`);
    }

    const [resource, actionWithScope] = parts;
    
    // Extraire l'action en supprimant le scope (:own, :any, :org, :assigned, etc.)
    const action = actionWithScope.split(':')[0];
    
    const actionMap: Record<string, Action> = {
      'create': Action.Create,
      'read': Action.Read,
      'update': Action.Update,
      'delete': Action.Delete,
      'manage': Action.Manage,
      'assign': Action.Manage,
      'checkin': Action.Update,
      'export': Action.Read,
      'publish': Action.Update,
      'cancel': Action.Delete,
      'view': Action.Read,
    };

    const subjectMap: Record<string, Subjects> = {
      'users': 'User',
      'organizations': 'Organization',
      'roles': 'Role',
      'permissions': 'Permission',
      'events': 'Event',
      'attendees': 'Attendee',
      'registrations': 'Registration',
      'invitations': 'Invitation',
      'analytics': 'Analytics',
      'reports': 'Report',
    };

    return [actionMap[action] || Action.Read, subjectMap[resource] || 'all'];
  }
}
