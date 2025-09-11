import { Module, MiddlewareConsumer } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './infra/db/sequelize.module';
import { AuthModule } from './auth/auth.module';
import { RbacModule } from './rbac/rbac.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { appRoutes } from './router/app.routes';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuthModule,
    RbacModule,
    UsersModule,
    OrganizationsModule,
    RolesModule,
    PermissionsModule,
    RouterModule.register(appRoutes),
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
