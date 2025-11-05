import { Routes } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../modules/users/users.module';
import { OrganizationsModule } from '../modules/organizations/organizations.module';
import { RolesModule } from '../modules/roles/roles.module';
import { PermissionsModule } from '../modules/permissions/permissions.module';
import { InvitationModule } from '../modules/invitation/invitation.module';
import { AttendeesModule } from '../modules/attendees/attendees.module';
import { EventsModule } from '../modules/events/events.module';
import { RegistrationsModule } from '../modules/registrations/registrations.module';
import { BadgeTemplatesModule } from '../modules/badge-templates/badge-templates.module';

export const appRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: 'auth',
        module: AuthModule,
      },
      {
        path: 'users',
        module: UsersModule,
      },
      {
        path: 'organizations',
        module: OrganizationsModule,
      },
      {
        path: 'roles',
        module: RolesModule,
      },
      {
        path: 'permissions',
        module: PermissionsModule,
      },
      {
        path: 'invitations',
        module: InvitationModule,
      },
      {
        path: 'attendees',
        module: AttendeesModule,
      },
      {
        path: 'events',
        module: EventsModule,
      },
      {
        path: 'registrations',
        module: RegistrationsModule,
      },
      {
        path: 'badge-templates',
        module: BadgeTemplatesModule,
      },
    ],
  },
];
