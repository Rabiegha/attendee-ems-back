import { Module, MiddlewareConsumer } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './infra/db/prisma.module';
import { AuthModule } from './auth/auth.module';
// import { RbacModule } from './authorization/rbac.module'; // ⚠️ LEGACY
// import { UsersModule } from './modules/users/users.module'; // ⚠️ LEGACY: à refactorer (STEP 4)
// import { OrganizationsModule } from './modules/organizations/organizations.module'; // ⚠️ LEGACY
// import { RolesModule } from './modules/roles/roles.module'; // ⚠️ LEGACY
// import { PermissionsModule } from './modules/permissions/permissions.module'; // ⚠️ LEGACY
// import { InvitationModule } from './modules/invitation/invitation.module'; // ⚠️ LEGACY
// import { AttendeesModule } from './modules/attendees/attendees.module'; // ⚠️ LEGACY
import { HealthModule } from './health/health.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { appRoutes } from './router/app.routes';
// import { EventsModule } from './modules/events/events.module'; // ⚠️ LEGACY
// import { PublicModule } from './modules/public/public.module'; // ⚠️ LEGACY
// import { RegistrationsModule } from './modules/registrations/registrations.module'; // ⚠️ LEGACY
// import { TagsModule } from './modules/tags/tags.module'; // ⚠️ LEGACY
// import { StorageModule } from './infra/storage/storage.module'; // ⚠️ LEGACY
// import { BadgeTemplatesModule } from './modules/badge-templates/badge-templates.module'; // ⚠️ LEGACY
// import { BadgeGenerationModule } from './modules/badge-generation/badge-generation.module'; // ⚠️ LEGACY
// import { BadgesModule } from './modules/badges/badges.module'; // ⚠️ LEGACY

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    // RbacModule, // ⚠️ LEGACY
    // UsersModule, // ⚠️ LEGACY: à refactorer (STEP 4)
    // OrganizationsModule, // ⚠️ LEGACY
    // RolesModule, // ⚠️ LEGACY
    // PermissionsModule, // ⚠️ LEGACY
    // InvitationModule, // ⚠️ LEGACY
    // AttendeesModule, // ⚠️ LEGACY
    HealthModule,
    // StorageModule, // ⚠️ LEGACY
    // BadgeTemplatesModule, // ⚠️ LEGACY
    // BadgeGenerationModule, // ⚠️ LEGACY
    // BadgesModule, // ⚠️ LEGACY
    RouterModule.register(appRoutes),
    // EventsModule, // ⚠️ LEGACY
    // PublicModule, // ⚠️ LEGACY
    // RegistrationsModule, // ⚠️ LEGACY
    // TagsModule, // ⚠️ LEGACY
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
