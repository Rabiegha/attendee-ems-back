import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { Action, AppAbility, Subjects } from './rbac.types';

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: any): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (!user.permissions || !Array.isArray(user.permissions)) {
      return build();
    }

    // Parse permissions and grant abilities
    user.permissions.forEach((permission: string) => {
      const ability = this.parsePermissionToAbility(permission);
      if (ability) {
        can(ability.action, ability.subject);
      }
    });

    // Special case for org_admin role - can manage all
    if (user.role === 'org_admin') {
      can(Action.Manage, 'all');
    }

    return build();
  }

  private parsePermissionToAbility(permission: string): { action: Action; subject: Subjects } | null {
    const parts = permission.split('.');
    if (parts.length !== 2) {
      return null;
    }

    const [subject, action] = parts;

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
    };

    const mappedAction = actionMap[action];
    const mappedSubject = subjectMap[subject] || 'all';

    if (!mappedAction) {
      return null;
    }

    return { action: mappedAction, subject: mappedSubject };
  }
}
