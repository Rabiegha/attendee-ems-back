import { Ability } from '@casl/ability';

export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
}

export type Subjects = 'all' | 'User' | 'Organization' | 'Role' | 'Permission' | 'Attendee';

export type AppAbility = Ability<[Action, Subjects]>;
