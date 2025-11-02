import { Ability } from '@casl/ability';

export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
}

/**
 * Tous les subjects (ressources) du système EMS
 */
export type Subjects = 
  | 'all' 
  | 'User' 
  | 'Organization' 
  | 'Role' 
  | 'Permission'
  | 'Event'
  | 'Attendee'
  | 'Registration'
  | 'Invitation'
  | 'Analytics'
  | 'Report'
  | 'BadgeTemplate' // Templates de badges
  | 'Badge';         // Badges générés

export type AppAbility = Ability<[Action, Subjects]>;
