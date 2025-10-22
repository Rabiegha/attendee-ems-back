import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { Action, AppAbility, Subjects } from './rbac.types';

/**
 * Factory CASL pour créer les abilities selon les permissions utilisateur
 * 
 * RÈGLES SIMPLIFIÉES:
 * - SUPER_ADMIN: Accès total cross-tenant (manage all)
 * - ADMIN: Accès total dans son organisation (manage all dans org)
 * - Autres: Permissions granulaires selon leur rôle
 */
@Injectable()
export class CaslAbilityFactory {
  createForUser(user: any): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    // SUPER_ADMIN a accès à TOUT sans restriction
    if (user.role === 'SUPER_ADMIN') {
      can(Action.Manage, 'all');
      return build();
    }

    // ADMIN a accès à tout dans son organisation
    if (user.role === 'ADMIN') {
      can(Action.Manage, 'all', { orgId: user.org_id });
      
      // Parsing additionnel des permissions pour plus de granularité si nécessaire
      if (user.permissions && Array.isArray(user.permissions)) {
        user.permissions.forEach((permission: string) => {
          const ability = this.parsePermissionToAbility(permission);
          if (ability) {
            can(ability.action, ability.subject, ability.conditions);
          }
        });
      }
      
      return build();
    }

    // Pour les autres rôles, parser les permissions individuellement
    if (!user.permissions || !Array.isArray(user.permissions)) {
      return build();
    }

    user.permissions.forEach((permission: string) => {
      const ability = this.parsePermissionToAbility(permission);
      if (ability) {
        can(ability.action, ability.subject, ability.conditions);
      }
    });

    return build();
  }

  /**
   * Parse une permission du format "resource.action:scope" vers une ability CASL
   * Ex: "users.read:own" -> { action: 'read', subject: 'User', conditions: { userId: user.id } }
   * Ex: "events.create" -> { action: 'create', subject: 'Event' }
   */
  private parsePermissionToAbility(permission: string): { 
    action: Action; 
    subject: Subjects; 
    conditions?: any 
  } | null {
    const parts = permission.split('.');
    if (parts.length !== 2) {
      return null;
    }

    const [resource, actionWithScope] = parts;
    const [action, scope] = actionWithScope.split(':');

    // Mapping des actions
    const actionMap: Record<string, Action> = {
      'create': Action.Create,
      'read': Action.Read,
      'update': Action.Update,
      'delete': Action.Delete,
      'manage': Action.Manage,
      'assign': Action.Manage,  // assign = manage pour les rôles
      'checkin': Action.Update,  // checkin = update pour les attendees
      'export': Action.Read,     // export = read avancé
      'publish': Action.Update,  // publish = update pour les events
      'cancel': Action.Delete,   // cancel = delete pour les invitations
      'view': Action.Read,       // view = read pour analytics
    };

    // Mapping des ressources vers subjects CASL
    const subjectMap: Record<string, Subjects> = {
      'users': 'User',
      'organizations': 'Organization',
      'events': 'Event',
      'attendees': 'Attendee',
      'roles': 'Role',
      'invitations': 'Invitation',
      'analytics': 'Analytics',
      'reports': 'Report',
    };

    const mappedAction = actionMap[action];
    const mappedSubject = subjectMap[resource];

    if (!mappedAction || !mappedSubject) {
      return null;
    }

    // Gérer les scopes (own, any)
    let conditions: any = undefined;
    
    if (scope === 'own') {
      // Pour "own", ajouter condition sur l'ownership
      conditions = { ownerId: '$user.id' }; // Sera résolu lors du check
    }
    // 'any' ou pas de scope = pas de conditions supplémentaires

    return { action: mappedAction, subject: mappedSubject, conditions };
  }
}

