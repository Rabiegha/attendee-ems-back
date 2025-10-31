import { Module, MiddlewareConsumer } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './infra/db/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RbacModule } from './rbac/rbac.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { InvitationModule } from './modules/invitation/invitation.module';
import { AttendeesModule } from './modules/attendees/attendees.module';
import { HealthModule } from './health/health.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { appRoutes } from './router/app.routes';
import { EventsModule } from './modules/events/events.module';
import { PublicModule } from './modules/public/public.module';
import { RegistrationsModule } from './modules/registrations/registrations.module';
import { TagsModule } from './modules/tags/tags.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    RbacModule,
    UsersModule,
    OrganizationsModule,
    RolesModule,
    PermissionsModule,
    InvitationModule,
    AttendeesModule,
    HealthModule,
    RouterModule.register(appRoutes),
    EventsModule,
    PublicModule,
    RegistrationsModule,
    TagsModule,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
