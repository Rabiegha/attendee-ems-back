import { Routes } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
// import { UsersModule } from '../modules/users/users.module'; // ⚠️ LEGACY
// import { OrganizationsModule } from '../modules/organizations/organizations.module'; // ⚠️ LEGACY
// import { RolesModule } from '../modules/roles/roles.module'; // ⚠️ LEGACY
// import { PermissionsModule } from '../modules/permissions/permissions.module'; // ⚠️ LEGACY
// import { InvitationModule } from '../modules/invitation/invitation.module'; // ⚠️ LEGACY
// import { AttendeesModule } from '../modules/attendees/attendees.module'; // ⚠️ LEGACY
// import { EventsModule } from '../modules/events/events.module'; // ⚠️ LEGACY
// import { RegistrationsModule } from '../modules/registrations/registrations.module'; // ⚠️ LEGACY
// import { BadgeTemplatesModule } from '../modules/badge-templates/badge-templates.module'; // ⚠️ LEGACY

export const appRoutes: Routes = [
  {
    path: '',
    children: [
      {
        path: '', // Pas de préfixe pour auth (accessible directement via /login, /me/orgs, etc.)
        module: AuthModule,
      },
      // ⚠️ LEGACY: Routes commentées temporairement pour STEP 2
      // {
      //   path: 'users',
      //   module: UsersModule,
      // },
      // {
      //   path: 'organizations',
      //   module: OrganizationsModule,
      // },
      // {
      //   path: 'roles',
      //   module: RolesModule,
      // },
      // {
      //   path: 'permissions',
      //   module: PermissionsModule,
      // },
      // {
      //   path: 'invitations',
      //   module: InvitationModule,
      // },
      // {
      //   path: 'attendees',
      //   module: AttendeesModule,
      // },
      // {
      //   path: 'events',
      //   module: EventsModule,
      // },
      // {
      //   path: 'registrations',
      //   module: RegistrationsModule,
      // },
      // {
      //   path: 'badge-templates',
      //   module: BadgeTemplatesModule,
      // },
    ],
  },
];
