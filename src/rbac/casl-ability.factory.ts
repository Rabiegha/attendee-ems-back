import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import { Action, AppAbility, Subjects } from './rbac.types';

/**
 * Factory CASL pour créer les abilities selon les permissions utilisateur
 * 
 * GATING BINAIRE UNIQUEMENT (capability check):
 * - SUPER_ADMIN: Accès total cross-tenant (manage all)
 * - ADMIN: Accès total (manage all) - scope org géré au niveau Prisma
 * - Autres: Permissions granulaires SANS conditions CASL
 * 
 * Les scopes (:any, :org, :assigned) sont résolus au niveau contrôleur/service,
 * pas dans CASL. CASL vérifie uniquement la capacité (capability).
 */
@Injectable()
export class CaslAbilityFactory {
  createForUser(user: any): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    // SUPER_ADMIN a accès à TOUT sans restriction
    if (user.role === 'SUPER_ADMIN') {
      can(Action.Manage, 'all');
      return build();
    }

    // ADMIN a accès à tout (scope org sera géré au niveau Prisma)
    if (user.role === 'ADMIN') {
      can(Action.Manage, 'all');
      return build();
    }

    // Pour les autres rôles, parser les permissions individuellement
    // SANS conditions - gating binaire uniquement
    if (!user.permissions || !Array.isArray(user.permissions)) {
      return build();
    }

    user.permissions.forEach((permission: string) => {
      const ability = this.parsePermissionToAbility(permission);
      if (ability) {
        can(ability.action, ability.subject);
      }
    });

    return build();
  }

  /**
   * Parse une permission du format "resource.action:scope" vers une ability CASL
   * GATING BINAIRE: ignore le scope, retourne uniquement action + subject
   * Ex: "events.read:any" -> { action: 'read', subject: 'Event' }
   * Ex: "events.read:org" -> { action: 'read', subject: 'Event' }
   * Ex: "events.create" -> { action: 'create', subject: 'Event' }
   */
  private parsePermissionToAbility(permission: string): { 
    action: Action; 
    subject: Subjects; 
  } | null {
    const parts = permission.split('.');
    if (parts.length !== 2) {
      return null;
    }

    const [resource, actionWithScope] = parts;
    // Extraire l'action en ignorant le scope (:any, :org, :assigned, etc.)
    const [action] = actionWithScope.split(':');

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
      'registrations': 'Registration',
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

    // Pas de conditions - gating binaire uniquement
    return { action: mappedAction, subject: mappedSubject };
  }
}

